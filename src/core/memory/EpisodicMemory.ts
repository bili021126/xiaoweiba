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

      // 使用白名单验证防止SQL注入（仅用于ORDER BY子句）
      const sortBy = options.sortBy === 'finalWeight' ? 'final_weight' : 'timestamp';
      const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
      const limit = Math.min(options.limit || 20, 100);
      const offset = Math.max(options.offset || 0, 0);

      // 构建SQL（使用?占位符）
      let sql = `SELECT * FROM episodic_memory WHERE project_fingerprint = ?`;
      const params: any[] = [projectFingerprint];
      
      if (options.taskType) {
        sql += ` AND task_type = ?`;
        params.push(options.taskType);
      }

      if (options.sinceTimestamp) {
        sql += ` AND timestamp >= ?`;
        params.push(options.sinceTimestamp);
      }

      sql += ` ORDER BY ${sortBy} ${sortOrder}`; // 白名单验证，安全
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // 使用sql.js的真正参数化查询
      const stmt = db.prepare(sql);
      stmt.bind(params);
      
      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        memories.push(this.objectToMemory(row));
      }
      stmt.free();

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

      // 严格验证和清理搜索查询
      const sanitizedQuery = this.sanitizeFtsQuery(query);
      if (!sanitizedQuery || sanitizedQuery.trim().length === 0) {
        return []; // 空查询直接返回
      }

      const limit = Math.min(options.limit || 20, 100);
      const offset = Math.max(options.offset || 0, 0);

      // 使用真正的参数化查询（FTS5 MATCH也使用占位符）
      const sql = `
        SELECT em.* FROM episodic_memory em
        JOIN episodic_memory_fts fts ON em.rowid = fts.rowid
        WHERE em.project_fingerprint = ? AND episodic_memory_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;

      // 使用sql.js的真正参数化查询
      const stmt = db.prepare(sql);
      stmt.bind([projectFingerprint, sanitizedQuery, limit, offset]);
      
      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        memories.push(this.objectToMemory(row));
      }
      stmt.free();

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

    // 使用真正的参数化查询
    const totalStmt = db.prepare(
      'SELECT COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ?'
    );
    totalStmt.bind([projectFingerprint]);
    const totalCount = totalStmt.step() ? (totalStmt.getAsObject().count as number) : 0;
    totalStmt.free();

    const byTaskTypeStmt = db.prepare(
      'SELECT task_type, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? GROUP BY task_type'
    );
    byTaskTypeStmt.bind([projectFingerprint]);
    const byTaskType: Record<string, number> = {};
    while (byTaskTypeStmt.step()) {
      const row = byTaskTypeStmt.getAsObject();
      byTaskType[row.task_type as string] = row.count as number;
    }
    byTaskTypeStmt.free();

    const byOutcomeStmt = db.prepare(
      'SELECT outcome, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? GROUP BY outcome'
    );
    byOutcomeStmt.bind([projectFingerprint]);
    const byOutcome: Record<string, number> = {};
    while (byOutcomeStmt.step()) {
      const row = byOutcomeStmt.getAsObject();
      byOutcome[row.outcome as string] = row.count as number;
    }
    byOutcomeStmt.free();

    const avgWeightStmt = db.prepare(
      'SELECT AVG(final_weight) as avg_weight FROM episodic_memory WHERE project_fingerprint = ?'
    );
    avgWeightStmt.bind([projectFingerprint]);
    const averageWeight = avgWeightStmt.step() ? (avgWeightStmt.getAsObject().avg_weight as number) || 0 : 0;
    avgWeightStmt.free();

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
   * 将数据库对象转换为记忆对象（用于参数化查询）
   */
  private objectToMemory(row: any): EpisodicMemoryRecord {
    return {
      id: row.id as string,
      projectFingerprint: row.project_fingerprint as string,
      timestamp: row.timestamp as number,
      taskType: row.task_type as TaskType,
      summary: row.summary as string,
      entities: JSON.parse((row.entities as string) || '[]'),
      decision: row.decision as string | undefined,
      outcome: row.outcome as TaskOutcome,
      finalWeight: row.final_weight as number,
      modelId: row.model_id as string,
      durationMs: (row.latency_ms as number) || 0,
      metadata: undefined
    };
  }

  /**
   * 将数据库行转换为记忆对象（用于exec查询）
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
