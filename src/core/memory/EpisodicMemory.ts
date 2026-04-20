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
// ✅ 新增：引入重构后的模块
import { IndexManager } from './IndexManager';
import { SearchEngine } from './SearchEngine';
import { MemoryCleaner } from './MemoryCleaner';
import type { Database } from 'sql.js';
import { CONFIDENCE_THRESHOLDS } from '../../constants';

// 重新导出类型，保持向后兼容
export type { TaskType, TaskOutcome, EpisodicMemoryRecord, MemoryQueryOptions, MemoryTier } from './types';

@injectable()
export class EpisodicMemory {
  private readonly decayLambda: number;
  private readonly retentionDays: number;

  // ========== 意图感知与自适应权重 ==========
  private intentAnalyzer: IntentAnalyzer;
  private expertSelector: ExpertSelector;

  // ========== 解耦模块 ==========
  private tierManager: MemoryTierManager;
  private deduplicator: MemoryDeduplicator;
  
  // ✅ 重构后的模块
  private indexManager: IndexManager;
  private searchEngine: SearchEngine;
  private memoryCleaner: MemoryCleaner;

  // ========== 初始化控制 ==========
  private initPromise: Promise<void> | null = null;
  private isInitializing = false; // ✅ 初始化标志

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
    
    // ✅ 重构后的模块
    this.indexManager = new IndexManager();
    this.searchEngine = new SearchEngine();
    this.memoryCleaner = new MemoryCleaner(this.dbManager, this.auditLogger);
    
    // 注意：不在构造函数中启动异步操作，由initialize()显式控制
  }

  /**
   * 记录情景记忆
   * @returns 记忆ID，失败时返回空字符串（不阻断功能）
   */
  async record(memory: Omit<EpisodicMemoryRecord, 'id' | 'projectFingerprint' | 'timestamp' | 'finalWeight'>): Promise<string> {
    const startTime = Date.now();
    try {
      // ✅ 容错处理：数据库未初始化时跳过记录，不阻断功能
      if (!this.dbManager) {
        await this.auditLogger.log('memory_record', 'failure', 0, {
          parameters: { reason: 'DatabaseManager not initialized' }
        });
        return '';
      }
      
      const db = this.dbManager.getDatabase();
      if (!db) {
        await this.auditLogger.logError('memory_record', new Error('Database not available'), 0);
        return '';
      }
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

      // ✅ 使用智能run()方法，自动持久化
      this.dbManager.run(
        `INSERT INTO episodic_memory (
          id, project_fingerprint, timestamp, task_type, summary,
          entities, decision, outcome, final_weight, model_id, latency_ms, memory_tier, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          memoryTier,
          memory.metadata ? JSON.stringify(memory.metadata) : null  // 新增：保存metadata
        ]
      );

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_record', 'success', duration, {
        parameters: { id, taskType: memory.taskType, memoryTier }
      });
      
      // ✅ 委托给IndexManager进行增量索引更新
      const newMemory: EpisodicMemoryRecord = {
        id,
        projectFingerprint,
        timestamp,
        ...memory,
        finalWeight,
        memoryTier
      };
      this.indexManager.addMemoryToIndex(newMemory);
      
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
      // ✅ 容错处理：数据库未初始化时返回空数组
      if (!this.dbManager) {
        return [];
      }
      
      const db = this.dbManager.getDatabase();
      const projectFingerprint = options.projectFingerprint ||
        await this.projectFingerprint.getCurrentProjectFingerprint();

      if (!projectFingerprint) {
        return [];
      }

      // 使用白名单验证防止SQL注入（仅用于ORDER BY子句）
      const sortBy = options.sortBy === 'finalWeight' ? 'final_weight' : 'timestamp';
      const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
      const limit = options.limit !== undefined ? Math.min(Math.max(options.limit, 0), 100) : 20;  // 修复：支持limit=0
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
        const limit = options.limit !== undefined ? Math.min(Math.max(options.limit, 0), 20) : 3;
        const recentMemories = await this.getRecentMemoriesFromDB(limit, options.memoryTier);
        // 去重前按 timestamp 降序排序
        const sortedMemories = recentMemories.sort((a, b) => b.timestamp - a.timestamp);
        return this.deduplicator.deduplicate(sortedMemories).slice(0, 20); // 最多返回20条
      }
      
      // 1.5 久远时间意图检测：强制检索 LONG_TERM 层级
      const intent = this.intentAnalyzer.analyze(query);
      // 远程时间查询使用长期记忆
      if (intent.distantTemporal > CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE) {
        options.memoryTier = 'LONG_TERM';
      }

      // 2. 使用语义检索（混合评分）
      const limit = options.limit !== undefined ? Math.min(Math.max(options.limit, 0), 20) : 5;  // 修复：支持limit=0
      const memories = await this.searchSemantic(query, limit);
      
      // 3. 去重前按 timestamp 降序排序，确保较新的记忆优先保留
      const sortedMemories = memories.sort((a, b) => b.timestamp - a.timestamp);
      const deduplicatedMemories = this.deduplicator.deduplicate(sortedMemories);
      
      // 4. 限制最大返回数量（防止一次性返回过多记忆）
      const maxResults = 20;
      const limitedResults = deduplicatedMemories.slice(0, maxResults);
      
      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_search', 'success', duration, {
        parameters: { 
          query, 
          count: limitedResults.length,
          originalCount: memories.length,
          method: 'hybrid' 
        }
      });

      return limitedResults;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_search', error as Error, duration);
      console.error('[EpisodicMemory] Search error:', error);
      return [];
    }
  }

  /**
   * 使用 LIKE 查询（关键词匹配）
   */
  private async searchWithLike(
    db: Database,
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
   * 清理搜索查询（防止注入和语法错误）
   */
  private sanitizeSearchQuery(query: string): string {
    if (!query || query.trim().length === 0) {
      return '';
    }

    // 移除特殊字符（保留字母、数字、中文、空格）
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
  /**
   * ✅ 委托给MemoryCleaner清理过期记忆
   */
  async cleanupExpired(): Promise<number> {
    const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
    if (!projectFingerprint) {
      return 0;
    }
    
    // ✅ 先查询要删除的记忆ID，同步更新索引
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const db = this.dbManager.getDatabase();
    const selectStmt = db.prepare(
      'SELECT id FROM episodic_memory WHERE project_fingerprint = ? AND memory_tier = ? AND timestamp < ?'
    );
    selectStmt.bind([projectFingerprint, 'SHORT_TERM', sevenDaysAgo]);
    
    const idsToRemove: string[] = [];
    while (selectStmt.step()) {
      const row = selectStmt.get();
      idsToRemove.push(row[0] as string);
    }
    selectStmt.free();
    
    // ✅ 从索引中移除
    for (const id of idsToRemove) {
      this.indexManager.removeFromIndex(id);
    }
    
    // ✅ 委托给MemoryCleaner执行数据库删除
    return await this.memoryCleaner.cleanupExpired(projectFingerprint);
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
  /**
   * ✅ 委托给MemoryCleaner获取统计信息
   */
  async getStats(): Promise<{
    totalCount: number;
    byTaskType: Record<string, number>;
    byOutcome: Record<string, number>;
    averageWeight: number;
    byTier: Record<string, number>; // 按层级统计
  }> {
    const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
    if (!projectFingerprint) {
      return { totalCount: 0, byTaskType: {}, byOutcome: {}, averageWeight: 0, byTier: {} };
    }
    const cleanerStats = await this.memoryCleaner.getStats(projectFingerprint);
    
    // 补充byOutcome和averageWeight（MemoryCleaner未提供）
    const db = this.dbManager.getDatabase();
    
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

    return {
      totalCount: cleanerStats.total,
      byTaskType: cleanerStats.byTaskType,
      byOutcome,
      averageWeight,
      byTier: {
        SHORT_TERM: cleanerStats.shortTerm,
        LONG_TERM: cleanerStats.longTerm
      }
    };
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
      id: row.id ?? '',
      projectFingerprint: row.project_fingerprint ?? '',
      timestamp: row.timestamp ?? 0,
      taskType: row.task_type ?? 'unknown',
      summary: row.summary ?? '',
      entities: JSON.parse((row.entities as string) || '[]'),
      decision: row.decision as string | undefined,
      outcome: row.outcome ?? 'success',
      finalWeight: row.final_weight ?? 0,
      modelId: row.model_id ?? 'unknown',
      durationMs: (row.latency_ms as number) || 0,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,  // 新增：读取metadata
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
      metadata: row[15] ? JSON.parse(row[15] as string) : undefined,  // 新增：读取metadata
      memoryTier: (row[13] as MemoryTier) || 'LONG_TERM'
    };
  }

  // ========== 混合检索核心方法 ==========

  /**
   * 从数据库加载记忆，建立倒排索引
   */
  /**
   * ✅ 使用IndexManager构建索引
   */
  private async buildIndex(): Promise<void> {
    return this.buildIndexWithNewManager();
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
   * 检测时间指代查询
   */
  private isTemporalQuery(query: string): boolean {
    const patterns = [/^刚才/, /^上次/, /^前一个/, /^刚刚/, /^最近/, /^上一个/];
    return patterns.some(p => p.test(query));
  }

  /**
   * ✅ 重构：使用SearchEngine进行语义检索
   */
  private async searchSemantic(query: string, limit: number = 5): Promise<EpisodicMemoryRecord[]> {
    // 1. 从 IndexManager 获取候选ID
    const candidateIds = this.indexManager.getCandidateIds(query);
    
    if (candidateIds.size === 0) {
      console.log('[EpisodicMemory] No candidates found, returning recent memories');
      return this.getRecentMemoriesFromDB(limit);
    }

    // 2. 批量加载候选记忆
    const candidateMemories = await this.getMemoriesByIds(Array.from(candidateIds));
    
    if (candidateMemories.length === 0) {
      console.log('[EpisodicMemory] No candidate memories loaded, returning recent memories');
      return this.getRecentMemoriesFromDB(limit);
    }

    // 3. 使用 SearchEngine 评分和排序
    const options: MemoryQueryOptions = { limit };
    const results = this.searchEngine.rankAndRetrieve(candidateIds, candidateMemories, query, options);
    
    console.log(`[EpisodicMemory] SearchEngine returned ${results.length} results`);
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
   * 批量获取记忆（性能优化：避免N+1查询）
   */
  private async getMemoriesByIds(ids: string[]): Promise<EpisodicMemoryRecord[]> {
    if (ids.length === 0) return [];
    
    try {
      const db = this.dbManager.getDatabase();
      // 使用 IN 子句一次性查询多条记录
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT * FROM episodic_memory WHERE id IN (${placeholders})`;
      const stmt = db.prepare(sql);
      stmt.bind(ids);
      
      const results: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(this.objectToMemory(row));
      }
      stmt.free();
      
      // 保持传入ID的顺序
      const memoryMap = new Map(results.map(m => [m.id, m]));
      return ids.map(id => memoryMap.get(id)).filter((m): m is EpisodicMemoryRecord => m !== undefined);
    } catch (error) {
      console.error('[EpisodicMemory] getMemoriesByIds error:', error);
      return [];
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
  private async getRecentMemoriesFromDB(limit: number, memoryTier?: MemoryTier): Promise<EpisodicMemoryRecord[]> {
    try {
      const db = this.dbManager.getDatabase();
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      if (!projectFingerprint) return [];

      let sql = `
        SELECT em.* FROM episodic_memory em
        WHERE em.project_fingerprint = ?
      `;
      
      const params: any[] = [projectFingerprint];
      
      // 如果指定了 memoryTier，添加过滤条件
      if (memoryTier) {
        sql += ` AND em.memory_tier = ?`;
        params.push(memoryTier);
      }
      
      sql += ` ORDER BY em.timestamp DESC LIMIT ?`;
      params.push(limit);

      const stmt = db.prepare(sql);
      stmt.bind(params);
      
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
    if (this.initPromise) {
      return;
    }
    
    // ✅ 设置初始化标志
    this.isInitializing = true;
    
    // ✅ 使用IndexManager构建索引，失败时重置initPromise以允许重试
    this.initPromise = this.buildIndexWithNewManager().catch(err => {
      // 索引初始化失败，重置状态以允许后续重试
      this.initPromise = null;
      this.isInitializing = false;
      throw err;
    });
    await this.initPromise;
    
    // ✅ 初始化成功，重置标志
    this.isInitializing = false;
  }

  /**
   * 确保已初始化（检索前自动调用）
   */
  private async ensureInitialized(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.initPromise) {
      return;
    }
  
    // ✅ 如果正在初始化，等待完成
    if (this.isInitializing) {
      await this.initPromise;
      return;
    }
    
    // 如果从未初始化，立即触发初始化
    try {
      await this.initialize();
    } catch (error) {
      // ✅ 容错处理：数据库未就绪时不阻断功能
      // 重置标志，允许下次重试
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  /**
   * 清理资源（插件停用时调用）
   */
  async dispose(): Promise<void> {
    // ✅ 委托给IndexManager清理
    this.indexManager.clear();
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
   * ✅ 委托给MemoryCleaner迁移短期记忆到长期记忆
   */
  async migrateShortToLongTerm(): Promise<number> {
    const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
    if (!projectFingerprint) {
      return 0;
    }
    
    // ✅ 先查询要迁移的记忆ID，同步更新索引
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const db = this.dbManager.getDatabase();
    const selectStmt = db.prepare(
      `SELECT id FROM episodic_memory 
       WHERE project_fingerprint = ? 
         AND memory_tier = 'SHORT_TERM' 
         AND timestamp < ? 
         AND final_weight >= 7.0`
    );
    selectStmt.bind([projectFingerprint, sevenDaysAgo]);
    
    const idsToMigrate: string[] = [];
    while (selectStmt.step()) {
      const row = selectStmt.get();
      idsToMigrate.push(row[0] as string);
    }
    selectStmt.free();
    
    // ✅ 从索引中移除（迁移后权重变化，需要重新索引）
    for (const id of idsToMigrate) {
      this.indexManager.removeFromIndex(id);
    }
    
    // ✅ 委托给MemoryCleaner执行数据库更新
    const migratedCount = await this.memoryCleaner.migrateShortToLongTerm(projectFingerprint);
    
    // ✅ 重新添加已迁移的记忆到索引（LONG_TERM权重不同）
    for (const id of idsToMigrate) {
      const memory = await this.getMemoryById(id);
      if (memory) {
        this.indexManager.addMemoryToIndex(memory);
      }
    }
    
    return migratedCount;
  }

  /**
   * ✅ 新增：使用IndexManager构建索引
   */
  private async buildIndexWithNewManager(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 从数据库加载所有记忆
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      const db = this.dbManager.getDatabase();
      
      const stmt = db.prepare('SELECT * FROM episodic_memory WHERE project_fingerprint = ? ORDER BY timestamp DESC LIMIT 2000');
      stmt.bind([projectFingerprint]);
      
      const memories: EpisodicMemoryRecord[] = [];
      while (stmt.step()) {
        const row = stmt.get() as any;
        memories.push({
          id: row.id,
          projectFingerprint: row.project_fingerprint,
          timestamp: row.timestamp,
          taskType: row.task_type,
          summary: row.summary,
          entities: JSON.parse(row.entities || '[]'),
          decision: row.decision,
          outcome: row.outcome,
          finalWeight: row.final_weight,
          modelId: row.model_id,
          durationMs: row.latency_ms,
          memoryTier: row.memory_tier || 'SHORT_TERM',
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        });
      }
      stmt.free();
      
      // 2. 使用IndexManager构建索引
      this.indexManager.buildIndex(memories, 2000);
      
      const duration = Date.now() - startTime;
      console.log(`[EpisodicMemory] Index built with IndexManager: ${memories.length} memories in ${duration}ms`);
    } catch (error) {
      console.error('[EpisodicMemory] Failed to build index with IndexManager:', error);
      throw error;
    }
  }
}
