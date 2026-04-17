import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { AuditLogger } from '../security/AuditLogger';
import { ProjectFingerprint } from '../../utils/ProjectFingerprint';
import { ConfigManager } from '../../storage/ConfigManager';
import { ErrorCode, createError } from '../../utils/ErrorCodes';
import { IntentAnalyzer } from './IntentAnalyzer';
import { ExpertSelector } from './ExpertSelector';
import { RetrievalWeights, TaskType, TaskOutcome, EpisodicMemoryRecord, MemoryQueryOptions, MemoryTier } from './types';
import { MemoryTierManager } from './MemoryTierManager';
import { MemoryDeduplicator } from './MemoryDeduplicator';

// 重新导出类型，保持向后兼容
export type { TaskType, TaskOutcome, EpisodicMemoryRecord, MemoryQueryOptions, MemoryTier } from './types';

/**
 * 内存索引结构（用于混合检索）
 */
interface IndexedMemory {
  id: string;
  timestamp: number;
  summary: string;
  entities: string[];
  decision?: string;
  termFreq: Map<string, number>; // 词频（TF）
}

@injectable()
export class EpisodicMemory {
  private readonly decayLambda: number;
  private readonly retentionDays: number;

  // ========== 内存索引（混合检索核心） ==========
  private invertedIndex: Map<string, Map<string, number>> = new Map(); // term -> Map<memoryId, tf>
  private docTermFreq: Map<string, Map<string, number>> = new Map();   // memoryId -> Map<term, tf>
  private idfCache: Map<string, number> = new Map();
  private totalDocs: number = 0;
  private indexReady: boolean = false;
  private indexBuildPromise: Promise<void> | null = null;

  // ========== 向量检索（语义增强） ==========
  private vectorCache: Map<string, Float32Array> = new Map(); // memoryId -> vector
  private vectorReady: boolean = false;
  private enableSemanticSearch: boolean = true; // 可配置开关
  
  // 评分权重
  private weights = {
    keyword: 0.3,
    time: 0.2,
    entity: 0.2,
    vector: 0.3
  };

  // ========== 意图感知与自适应权重 ==========
  private intentAnalyzer: IntentAnalyzer;
  private expertSelector: ExpertSelector;

  // ========== 解耦模块 ==========
  private tierManager: MemoryTierManager;
  private deduplicator: MemoryDeduplicator;

  // ========== 初始化控制 ==========
  private initPromise: Promise<void> | null = null;

  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(AuditLogger) private auditLogger: AuditLogger,
    @inject(ProjectFingerprint) private projectFingerprint: ProjectFingerprint,
    @inject(ConfigManager) private configManager: ConfigManager
  ) {
    const config = this.configManager.getConfig();
    this.decayLambda = config.memory.decayLambda;
    this.retentionDays = config.memory.retentionDays;
    
    // 初始化意图感知模块
    this.intentAnalyzer = new IntentAnalyzer();
    this.expertSelector = new ExpertSelector();
    
    // 初始化解耦模块
    this.tierManager = new MemoryTierManager();
    this.deduplicator = new MemoryDeduplicator();
    
    // 注意：不在构造函数中启动异步操作，由initialize()显式控制
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

      // 自动判断记忆层级：7天内的为SHORT_TERM，其他为LONG_TERM
      const memoryTier = this.determineMemoryTier(timestamp);

      db.run(
        `INSERT INTO episodic_memory (
          id, project_fingerprint, timestamp, task_type, summary,
          entities, decision, outcome, final_weight, model_id, latency_ms, memory_tier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          memory.durationMs || null,
          memoryTier
        ]
      );

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_record', 'success', duration, {
        parameters: { id, taskType: memory.taskType, memoryTier }
      });

      console.log(`[EpisodicMemory] Memory recorded successfully: ${id} (${memory.taskType}, ${memoryTier})`);
      
      // 增量更新内存索引
      const newMemory: EpisodicMemoryRecord = {
        id,
        projectFingerprint,
        timestamp,
        ...memory,
        finalWeight,
        memoryTier
      };
      this.addToIndex(newMemory);
      
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

      if (options.memoryTier) {
        sql += ` AND memory_tier = ?`;
        params.push(options.memoryTier);
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
        parameters: { count: memories.length, taskType: options.taskType, memoryTier: options.memoryTier }
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
      // 确保已初始化
      await this.ensureInitialized();

      // 1. 时间指代检测
      if (this.isTemporalQuery(query)) {
        console.log('[EpisodicMemory] Temporal query detected, returning recent memories');
        const recentMemories = await this.getRecentMemoriesFromDB(options.limit || 3);
        return this.deduplicator.deduplicate(recentMemories);
      }

      // 2. 使用语义检索（混合评分）
      const limit = Math.min(options.limit || 5, 20);
      const memories = await this.searchSemantic(query, limit);
      
      // 3. 去重
      const deduplicatedMemories = this.deduplicator.deduplicate(memories);
      
      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_search', 'success', duration, {
        parameters: { 
          query, 
          count: deduplicatedMemories.length,
          originalCount: memories.length,
          method: 'hybrid' 
        }
      });

      console.log(`[EpisodicMemory] Hybrid search found ${deduplicatedMemories.length} memories (from ${memories.length}) in ${duration}ms`);
      return deduplicatedMemories;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_search', error as Error, duration);
      console.error('[EpisodicMemory] Search error:', error);
      return [];
    }
  }

  /**
   * 使用 FTS5 全文搜索（保留作为备用）
   */
  private async searchWithFTS5(
    db: any,
    projectFingerprint: string,
    query: string,
    limit: number,
    offset: number
  ): Promise<EpisodicMemoryRecord[]> {
    const sql = `
      SELECT em.* FROM episodic_memory em
      JOIN episodic_memory_fts fts ON em.rowid = fts.rowid
      WHERE em.project_fingerprint = ? AND episodic_memory_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare(sql);
    stmt.bind([projectFingerprint, query, limit, offset]);
    
    const memories: EpisodicMemoryRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      memories.push(this.objectToMemory(row));
    }
    stmt.free();

    return memories;
  }

  /**
   * 使用 LIKE 查询（FTS5 降级方案）
   */
  private async searchWithLike(
    db: any,
    projectFingerprint: string,
    query: string,
    limit: number,
    offset: number
  ): Promise<EpisodicMemoryRecord[]> {
    // 将空格分隔的查询词转换为多个 LIKE 条件
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    console.log(`[EpisodicMemory] LIKE search terms: [${terms.join(', ')}]`);
    
    const likeConditions = terms.map(() => '(em.summary LIKE ? OR em.entities LIKE ? OR em.decision LIKE ?)').join(' AND ');
    const likeParams = terms.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);
    
    const sql = `
      SELECT em.* FROM episodic_memory em
      WHERE em.project_fingerprint = ? AND (${likeConditions})
      ORDER BY em.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    console.log(`[EpisodicMemory] LIKE SQL: ${sql.substring(0, 100)}...`);
    const stmt = db.prepare(sql);
    stmt.bind([projectFingerprint, ...likeParams, limit, offset]);
    
    const memories: EpisodicMemoryRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      memories.push(this.objectToMemory(row));
    }
    stmt.free();

    console.log(`[EpisodicMemory] LIKE search returned ${memories.length} results`);
    return memories;
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
    byTier: Record<string, number>; // 按层级统计
  }> {
    const db = this.dbManager.getDatabase();
    const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();

    if (!projectFingerprint) {
      return { totalCount: 0, byTaskType: {}, byOutcome: {}, averageWeight: 0, byTier: {} };
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

    // 新增：按层级统计
    const byTierStmt = db.prepare(
      'SELECT memory_tier, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? GROUP BY memory_tier'
    );
    byTierStmt.bind([projectFingerprint]);
    const byTier: Record<string, number> = {};
    while (byTierStmt.step()) {
      const row = byTierStmt.getAsObject();
      byTier[row.memory_tier as string] = row.count as number;
    }
    byTierStmt.free();

    return { totalCount, byTaskType, byOutcome, averageWeight, byTier };
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
      metadata: undefined,
      memoryTier: (row.memory_tier as MemoryTier) || 'LONG_TERM'
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

  /**
   * 获取最近的记忆（用于模糊查询降级）
   */
  private async getRecentMemories(
    db: any,
    projectFingerprint: string,
    limit: number
  ): Promise<EpisodicMemoryRecord[]> {
    const sql = `
      SELECT em.* FROM episodic_memory em
      WHERE em.project_fingerprint = ?
      ORDER BY em.timestamp DESC
      LIMIT ?
    `;

    const stmt = db.prepare(sql);
    stmt.bind([projectFingerprint, limit]);
    
    const memories: EpisodicMemoryRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      memories.push(this.objectToMemory(row));
    }
    stmt.free();

    return memories;
  }

  // ========== 混合检索核心方法 ==========

  /**
   * 从数据库加载记忆，建立倒排索引
   */
  private async buildIndex(limit: number = 2000): Promise<void> {
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      
      if (!projectFingerprint) {
        console.warn('[EpisodicMemory] No project fingerprint, skip index build');
        return;
      }

      // 加载最近 limit 条记忆
      const sql = `
        SELECT em.* FROM episodic_memory em
        WHERE em.project_fingerprint = ?
        ORDER BY em.timestamp DESC
        LIMIT ?
      `;

      const stmt = db.prepare(sql);
      stmt.bind([projectFingerprint, limit]);

      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        memories.push(this.objectToMemory(row));
      }
      stmt.free();

      // 清空旧索引
      this.invertedIndex.clear();
      this.docTermFreq.clear();
      this.idfCache.clear();
      this.totalDocs = memories.length;

      // 构建索引
      for (const mem of memories) {
        const text = this.getIndexText(mem);
        const terms = this.tokenize(text);
        const tfMap = new Map<string, number>();
        for (const term of terms) {
          tfMap.set(term, (tfMap.get(term) || 0) + 1);
        }
        this.docTermFreq.set(mem.id, tfMap);
        for (const [term, tf] of tfMap) {
          if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, new Map());
          this.invertedIndex.get(term)!.set(mem.id, tf);
        }
      }

      // 预计算 IDF
      for (const [term, docMap] of this.invertedIndex) {
        const idf = Math.log((this.totalDocs + 1) / (docMap.size + 1)) + 1;
        this.idfCache.set(term, idf);
      }

      this.indexReady = true;
      console.log(`[EpisodicMemory] Index built: ${this.totalDocs} memories indexed`);
    } catch (error) {
      console.error('[EpisodicMemory] Index build error:', error);
      this.indexReady = false;
    }
  }

  /**
   * 获取用于索引的文本（summary + entities + decision）
   */
  private getIndexText(memory: EpisodicMemoryRecord): string {
    const parts = [memory.summary];
    if (memory.entities && memory.entities.length) parts.push(memory.entities.join(' '));
    if (memory.decision) parts.push(memory.decision);
    return parts.join(' ');
  }

  /**
   * 分词（支持中英文）
   */
  private tokenize(text: string): string[] {
    // 转小写，保留字母数字中文，按空格拆分
    const normalized = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ');
    return normalized.split(/\s+/).filter(t => t.length > 1);
  }

  // ========== 意图感知与自适应权重 ==========

  /**
   * 获取自适应权重（根据查询意图动态调整）
   */
  private getAdaptiveWeights(query: string): RetrievalWeights {
    const intent = this.intentAnalyzer.analyze(query);
    const base = this.expertSelector.getBaseWeights();
    
    // 门控调制：根据意图增强对应因子
    let k = base.k * (1 + intent.entity * 0.5);      // 实体敏感增强关键词
    let t = base.t * (1 + intent.temporal * 0.8);    // 时间敏感增强时间
    let e = base.e * (1 + intent.entity * 0.6);      // 实体敏感增强实体加分
    let v = base.v * (1 + intent.semantic * 0.7);    // 语义敏感增强向量
    
    // 归一化（保持和为1）
    const sum = k + t + e + v;
    return { 
      k: k / sum, 
      t: t / sum, 
      e: e / sum, 
      v: v / sum 
    };
  }

  /**
   * 记录用户反馈（用于专家选择器学习）
   * @param query 用户查询
   * @param clickedMemoryId 用户点击的记忆ID
   */
  public recordFeedback(query: string, clickedMemoryId: string): void {
    const intent = this.intentAnalyzer.analyze(query);
    const weights = this.getAdaptiveWeights(query);
    this.expertSelector.recordFeedback(intent, weights);
    console.log(`[EpisodicMemory] Feedback recorded for query: "${query}", expert: ${this.expertSelector.getCurrentExpert()}`);
  }

  /**
   * 重置专家选择（用于命令 xiaoweiba.reset-expert）
   */
  public resetExpert(): void {
    this.expertSelector.reset();
    console.log('[EpisodicMemory] Expert state reset');
  }

  /**
   * 获取当前专家名称（用于调试）
   */
  public getCurrentExpert(): string {
    return this.expertSelector.getCurrentExpert();
  }

  /**
   * 增量更新索引（record成功后调用）
   */
  private addToIndex(memory: EpisodicMemoryRecord): void {
    if (!this.indexReady) return;

    const text = this.getIndexText(memory);
    const terms = this.tokenize(text);
    const tfMap = new Map<string, number>();
    for (const term of terms) {
      tfMap.set(term, (tfMap.get(term) || 0) + 1);
    }
    this.docTermFreq.set(memory.id, tfMap);
    for (const [term, tf] of tfMap) {
      if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, new Map());
      this.invertedIndex.get(term)!.set(memory.id, tf);
      // 更新 IDF（因为文档数增加）
      const newIdf = Math.log((this.totalDocs + 2) / (this.invertedIndex.get(term)!.size + 1)) + 1;
      this.idfCache.set(term, newIdf);
    }
    this.totalDocs++;
  }

  /**
   * 检测时间指代查询
   */
  private isTemporalQuery(query: string): boolean {
    const patterns = [/^刚才/, /^上次/, /^前一个/, /^刚刚/, /^最近/, /^上一个/];
    return patterns.some(p => p.test(query));
  }

  /**
   * 语义检索（混合评分）
   */
  private async searchSemantic(query: string, limit: number = 5): Promise<EpisodicMemoryRecord[]> {
    if (!this.indexReady) {
      console.log('[EpisodicMemory] Index not ready, using LIKE fallback');
      return this.searchWithLikeFallback(query, limit);
    }

    // 获取自适应权重
    const adaptiveWeights = this.getAdaptiveWeights(query);
    const dominantIntent = this.intentAnalyzer.getDominantIntent(this.intentAnalyzer.analyze(query));
    console.log(`[EpisodicMemory] Adaptive weights for "${query}": k=${adaptiveWeights.k.toFixed(2)}, t=${adaptiveWeights.t.toFixed(2)}, e=${adaptiveWeights.e.toFixed(2)}, v=${adaptiveWeights.v.toFixed(2)} (intent: ${dominantIntent})`);

    const queryTerms = this.tokenize(query);
    const candidateIds = new Set<string>();
    for (const term of queryTerms) {
      const docs = this.invertedIndex.get(term);
      if (docs) {
        for (const id of docs.keys()) candidateIds.add(id);
      }
    }
    if (candidateIds.size === 0) {
      console.log('[EpisodicMemory] No candidates found, returning recent memories');
      return this.getRecentMemoriesFromDB(limit);
    }

    const now = Date.now();
    const scores: Array<{ id: string; score: number }> = [];

    for (const id of candidateIds) {
      const memory = await this.getMemoryById(id);
      if (!memory) continue;

      // 1. TF-IDF 得分
      let tfidf = 0;
      for (const term of queryTerms) {
        const tf = this.docTermFreq.get(id)?.get(term) || 0;
        const idf = this.idfCache.get(term) || 1;
        tfidf += tf * idf;
      }
      // 归一化（简单除以查询词数）
      const normTfidf = Math.min(tfidf / queryTerms.length, 1);

      // 2. 时间衰减得分
      const ageDays = (now - memory.timestamp) / (1000 * 3600 * 24);
      const timeScore = Math.exp(-ageDays * this.decayLambda); // λ=0.1，半衰期约7天

      // 3. 实体匹配加分
      let entityBonus = 0;
      if (memory.entities && memory.entities.length) {
        for (const term of queryTerms) {
          if (memory.entities.some(e => e.toLowerCase().includes(term))) {
            entityBonus += 0.2;
          }
        }
      }
      entityBonus = Math.min(entityBonus, 0.5);

      // 最终得分（使用自适应权重）
      const finalScore = 
        normTfidf * adaptiveWeights.k +
        timeScore * adaptiveWeights.t +
        entityBonus * adaptiveWeights.e;
      
      scores.push({ id, score: finalScore });
    }

    scores.sort((a, b) => b.score - a.score);
    const topIds = scores.slice(0, limit).map(s => s.id);
    if (topIds.length === 0) return [];
    
    // 根据 ID 获取完整记忆对象
    const results: EpisodicMemoryRecord[] = [];
    for (const id of topIds) {
      const mem = await this.getMemoryById(id);
      if (mem) results.push(mem);
    }
    return results;
  }

  /**
   * 根据 ID 获取单条记忆
   */
  private async getMemoryById(id: string): Promise<EpisodicMemoryRecord | null> {
    try {
      const db = this.dbManager.getDatabase();
      const sql = 'SELECT * FROM episodic_memory WHERE id = ? LIMIT 1';
      const stmt = db.prepare(sql);
      stmt.bind([id]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return this.objectToMemory(row);
      }
      stmt.free();
      return null;
    } catch (error) {
      console.error('[EpisodicMemory] getMemoryById error:', error);
      return null;
    }
  }

  /**
   * LIKE 查询降级方案
   */
  private async searchWithLikeFallback(query: string, limit: number): Promise<EpisodicMemoryRecord[]> {
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      if (!projectFingerprint) return [];

      const terms = this.tokenize(query);
      if (terms.length === 0) return this.getRecentMemoriesFromDB(limit);

      const likeConditions = terms.map(() => '(em.summary LIKE ? OR em.entities LIKE ? OR em.decision LIKE ?)').join(' AND ');
      const likeParams = terms.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);
      
      const sql = `
        SELECT em.* FROM episodic_memory em
        WHERE em.project_fingerprint = ? AND (${likeConditions})
        ORDER BY em.timestamp DESC
        LIMIT ?
      `;

      const stmt = db.prepare(sql);
      stmt.bind([projectFingerprint, ...likeParams, limit]);
      
      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        memories.push(this.objectToMemory(row));
      }
      stmt.free();
      return memories;
    } catch (error) {
      console.error('[EpisodicMemory] LIKE fallback error:', error);
      return this.getRecentMemoriesFromDB(limit);
    }
  }

  /**
   * 从数据库获取最近记忆
   */
  private async getRecentMemoriesFromDB(limit: number): Promise<EpisodicMemoryRecord[]> {
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      if (!projectFingerprint) return [];

      const sql = `
        SELECT em.* FROM episodic_memory em
        WHERE em.project_fingerprint = ?
        ORDER BY em.timestamp DESC
        LIMIT ?
      `;

      const stmt = db.prepare(sql);
      stmt.bind([projectFingerprint, limit]);
      
      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        memories.push(this.objectToMemory(row));
      }
      stmt.free();
      return memories;
    } catch (error) {
      console.error('[EpisodicMemory] getRecentMemoriesFromDB error:', error);
      return [];
    }
  }

  // ========== 初始化控制 ==========

  /**
   * 显式初始化（由外部调用，如extension.ts）
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.buildIndex();
    await this.initPromise;
    this.indexReady = true;
    console.log('[EpisodicMemory] Initialized successfully');
  }

  /**
   * 确保已初始化（检索前自动调用）
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.indexReady && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * 清理资源（插件停用时调用）
   */
  async dispose(): Promise<void> {
    this.invertedIndex.clear();
    this.docTermFreq.clear();
    this.idfCache.clear();
    this.vectorCache.clear();
    this.indexReady = false;
    this.initPromise = null;
    console.log('[EpisodicMemory] Disposed');
  }

  /**
   * 判断记忆层级（基于时间）
   * @param timestamp 记忆创建时间戳
   * @returns SHORT_TERM（7天内）或 LONG_TERM（7天以上）
   */
  private determineMemoryTier(timestamp: number): MemoryTier {
    return this.tierManager.determineTier(timestamp);
  }

  /**
   * 迁移短期记忆为长期记忆（超过7天的自动降级）
   * @returns 迁移的记忆数量
   */
  async migrateShortToLongTerm(): Promise<number> {
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      
      if (!projectFingerprint) {
        console.warn('[EpisodicMemory] No project fingerprint, skip migration');
        return 0;
      }

      // 将7天前的SHORT_TERM记忆更新为LONG_TERM
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      db.run(
        `UPDATE episodic_memory SET memory_tier = 'LONG_TERM' WHERE project_fingerprint = ? AND memory_tier = 'SHORT_TERM' AND timestamp < ?`,
        [projectFingerprint, sevenDaysAgo]
      );

      const migratedCount = db.getRowsModified();
      console.log(`[EpisodicMemory] Migrated ${migratedCount} memories from SHORT_TERM to LONG_TERM`);
      
      return migratedCount;
    } catch (error) {
      console.error('[EpisodicMemory] Migration failed:', error);
      throw error;
    }
  }
}
