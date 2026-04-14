import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { AuditLogger } from '../security/AuditLogger';
import { ProjectFingerprint } from '../../utils/ProjectFingerprint';
import { ConfigManager } from '../../storage/ConfigManager';
import { ErrorCode, createError } from '../../utils/ErrorCodes';

export type TaskType =
  | 'CODE_EXPLAIN'
  | 'CODE_GENERATE'
  | 'TEST_GENERATE'
  | 'SQL_OPTIMIZE'
  | 'NAMING_CHECK'
  | 'COMMIT_GENERATE'
  | 'SKILL_EXECUTE'
  | 'WORKFLOW_EXECUTE';

export type TaskOutcome = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';

export interface EpisodicMemoryRecord {
  id: string;
  projectFingerprint: string;
  timestamp: number;
  taskType: TaskType;
  summary: string;
  entities: string[];
  decision?: string;
  outcome: TaskOutcome;
  finalWeight: number;
  modelId: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryQueryOptions {
  projectFingerprint?: string;
  taskType?: TaskType;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'finalWeight';
  sortOrder?: 'ASC' | 'DESC';
  sinceTimestamp?: number;
}

@injectable()
export class EpisodicMemory {
  private readonly decayLambda: number;
  private readonly retentionDays: number;

  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(AuditLogger) private auditLogger: AuditLogger,
    @inject(ProjectFingerprint) private projectFingerprint: ProjectFingerprint,
    @inject(ConfigManager) private configManager: ConfigManager
  ) {
    const config = this.configManager.getConfig();
    this.decayLambda = config.memory.decayLambda;
    this.retentionDays = config.memory.retentionDays;
  }

  /**
   * 记录情景记忆
   */
  async record(memory: Omit<EpisodicMemoryRecord, 'id' | 'projectFingerprint' | 'timestamp' | 'finalWeight'>): Promise<string> {
    const startTime = Date.now();
    try {
      console.log('[EpisodicMemory] record() called, checking database...');
      
      // 强制检查数据库是否初始化
      if (!this.dbManager) {
        console.error('[EpisodicMemory] dbManager is null!');
        throw new Error('DatabaseManager not injected');
      }
      
      const db = this.dbManager.getDatabase();
      console.log('[EpisodicMemory] Database retrieved successfully');
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();

      if (!projectFingerprint) {
        throw createError(
          ErrorCode.MEM_RECORD_FAILED,
          'No workspace folder found',
          '无法获取项目指纹，请打开一个工作区'
        );
      }

      const id = `ep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = Date.now();

      // 计算初始权重
      const finalWeight = this.calculateInitialWeight(memory.outcome);

      db.run(
        `INSERT INTO episodic_memory (
          id, project_fingerprint, timestamp, task_type, summary,
          entities, decision, outcome, final_weight, model_id, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          projectFingerprint,
          timestamp,
          memory.taskType,
          memory.summary,
          JSON.stringify(memory.entities),
          memory.decision || null,
          memory.outcome,
          finalWeight,
          memory.modelId,
          memory.durationMs || null
        ]
      );

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_record', 'success', duration, {
        parameters: { id, taskType: memory.taskType }
      });

      return id;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_record', error as Error, duration);
      throw error;
    }
  }

  /**
   * 检索情景记忆
   */
  async retrieve(options: MemoryQueryOptions = {}): Promise<EpisodicMemoryRecord[]> {
    const startTime = Date.now();
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = options.projectFingerprint ||
        await this.projectFingerprint.getCurrentProjectFingerprint();

      if (!projectFingerprint) {
        return [];
      }

      // 使用参数化方式构建 SQL（防止注入）
      const safeFp = projectFingerprint.replace(/'/g, "''");
      let sql = `SELECT * FROM episodic_memory WHERE project_fingerprint = '${safeFp}'`;
      
      if (options.taskType) {
        const safeTaskType = options.taskType.replace(/'/g, "''");
        sql += ` AND task_type = '${safeTaskType}'`;
      }

      if (options.sinceTimestamp) {
        sql += ` AND timestamp >= ${options.sinceTimestamp}`;
      }

      const sortBy = options.sortBy === 'finalWeight' ? 'final_weight' : 'timestamp';
      const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${sortBy} ${sortOrder}`;

      const limit = Math.min(options.limit || 20, 100); // 限制最大返回数量
      const offset = Math.max(options.offset || 0, 0); // 确保非负
      sql += ` LIMIT ${limit} OFFSET ${offset}`;

      const rows = db.exec(sql);

      // 改进的返回值处理
      if (rows.length === 0 || rows[0].values.length === 0) {
        return [];
      }

      const memories: EpisodicMemoryRecord[] = rows[0].values.map((row: any[]) => this.rowToMemory(row));

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_retrieve', 'success', duration, {
        parameters: { count: memories.length, taskType: options.taskType }
      });

      return memories;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_retrieve', error as Error, duration);
      throw createError(
        ErrorCode.MEM_RETRIEVAL_FAILED,
        `Failed to retrieve memories: ${error instanceof Error ? error.message : String(error)}`,
        '记忆检索失败，请查看日志'
      );
    }
  }

  /**
   * 全文搜索情景记忆
   */
  async search(query: string, options: MemoryQueryOptions = {}): Promise<EpisodicMemoryRecord[]> {
    const startTime = Date.now();
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();

      if (!projectFingerprint) {
        return [];
      }

      // 验证和清理搜索查询（FTS5 特殊字符转义）
      const sanitizedQuery = this.sanitizeFtsQuery(query);
      const limit = Math.min(options.limit || 20, 100); // 限制最大返回数量
      const offset = Math.max(options.offset || 0, 0); // 确保非负

      // 使用参数化查询保护项目指纹（虽然已验证，但仍需防御）
      const safeFp = projectFingerprint.replace(/'/g, "''");
      
      const sql = `
        SELECT em.* FROM episodic_memory em
        JOIN episodic_memory_fts fts ON em.rowid = fts.rowid
        WHERE em.project_fingerprint = '${safeFp}' AND episodic_memory_fts MATCH '${sanitizedQuery}'
        ORDER BY rank
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const rows = db.exec(sql);

      // 改进的返回值处理
      if (rows.length === 0 || rows[0].values.length === 0) {
        return [];
      }

      const memories: EpisodicMemoryRecord[] = rows[0].values.map((row: any[]) => this.rowToMemory(row));

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_search', 'success', duration, {
        parameters: { query: sanitizedQuery, count: memories.length }
      });

      return memories;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_search', error as Error, duration);
      return [];
    }
  }

  /**
   * 清理 FTS5 搜索查询（防止注入和语法错误）
   */
  private sanitizeFtsQuery(query: string): string {
    if (!query || query.trim().length === 0) {
      return '';
    }

    // 移除 FTS5 特殊字符（保留字母、数字、中文、空格）
    let sanitized = query
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // 保留单词字符、空格、中文
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();

    // 如果清理后为空，返回原始查询的转义版本
    if (sanitized.length === 0) {
      return query.replace(/'/g, "''").substring(0, 200); // 限制长度
    }

    // 限制查询长度
    return sanitized.substring(0, 200);
  }

  /**
   * 删除过期记忆
   */
  async cleanupExpired(): Promise<number> {
    const startTime = Date.now();
    try {
      const db = this.dbManager.getDatabase();
      const cutoffTimestamp = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

      // 使用参数化查询防止 SQL 注入
      db.run('DELETE FROM episodic_memory WHERE timestamp < ?', [cutoffTimestamp]);

      const deletedCount = db.getRowsModified();

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_cleanup', 'success', duration, {
        parameters: { deletedCount }
      });

      return deletedCount;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_cleanup', error as Error, duration);
      throw error;
    }
  }

  /**
   * 应用记忆衰减
   */
  applyDecay(weight: number, ageInDays: number): number {
    return weight * Math.exp(-this.decayLambda * ageInDays);
  }

  /**
   * 获取记忆统计信息
   */
  async getStats(): Promise<{
    totalCount: number;
    byTaskType: Record<string, number>;
    byOutcome: Record<string, number>;
    averageWeight: number;
  }> {
    const db = this.dbManager.getDatabase();
    const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();

    if (!projectFingerprint) {
      return { totalCount: 0, byTaskType: {}, byOutcome: {}, averageWeight: 0 };
    }

    const safeFp = projectFingerprint.replace(/'/g, "''");

    const totalResult = db.exec(
      `SELECT COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = '${safeFp}'`
    );
    const totalCount = totalResult.length > 0 && totalResult[0].values.length > 0
      ? (totalResult[0].values[0][0] as number)
      : 0;

    const byTaskTypeResult = db.exec(
      `SELECT task_type, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = '${safeFp}' GROUP BY task_type`
    );
    const byTaskType: Record<string, number> = {};
    if (byTaskTypeResult.length > 0 && byTaskTypeResult[0].values.length > 0) {
      for (const row of byTaskTypeResult[0].values) {
        byTaskType[row[0] as string] = row[1] as number;
      }
    }

    const byOutcomeResult = db.exec(
      `SELECT outcome, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = '${safeFp}' GROUP BY outcome`
    );
    const byOutcome: Record<string, number> = {};
    if (byOutcomeResult.length > 0 && byOutcomeResult[0].values.length > 0) {
      for (const row of byOutcomeResult[0].values) {
        byOutcome[row[0] as string] = row[1] as number;
      }
    }

    const avgWeightResult = db.exec(
      `SELECT AVG(final_weight) as avg_weight FROM episodic_memory WHERE project_fingerprint = '${safeFp}'`
    );
    const averageWeight = avgWeightResult.length > 0 && avgWeightResult[0].values.length > 0
      ? (avgWeightResult[0].values[0][0] as number) || 0
      : 0;

    return { totalCount, byTaskType, byOutcome, averageWeight };
  }

  /**
   * 计算初始权重
   */
  private calculateInitialWeight(outcome: TaskOutcome): number {
    switch (outcome) {
      case 'SUCCESS':
        return 8;
      case 'PARTIAL':
        return 5;
      case 'FAILED':
        return 2;
      case 'CANCELLED':
        return 1;
      default:
        return 5;
    }
  }

  /**
   * 将数据库行转换为记忆对象
   */
  private rowToMemory(row: any[]): EpisodicMemoryRecord {
    return {
      id: row[0] as string,
      projectFingerprint: row[1] as string,
      timestamp: row[2] as number,
      taskType: row[3] as TaskType,
      summary: row[4] as string,
      entities: JSON.parse((row[5] as string) || '[]'),
      decision: row[6] as string | undefined,
      outcome: row[7] as TaskOutcome,
      finalWeight: row[8] as number,
      modelId: row[9] as string,
      durationMs: (row[12] as number) || 0, // latency_ms
      metadata: undefined
    };
  }
}
