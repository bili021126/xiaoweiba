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
import { HybridRetriever } from '../application/HybridRetriever'; // ✅ L2: 引入混合检索器
import { VectorIndexManager } from '../application/VectorIndexManager'; // ✅ L2: 向量索引管理器
import { SemanticRetriever } from '../application/SemanticRetriever'; // ✅ L2: 语义检索器
import { QueryExecutor } from '../application/QueryExecutor'; // ✅ L2.5: 查询执行器
import { WeightCalculator } from '../application/WeightCalculator'; // ✅ L2.5: 权重计算器
import { IndexSyncService } from '../application/IndexSyncService'; // ✅ L2.5: 索引同步服务
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
    @inject(ConfigManager) private configManager: ConfigManager,
    @inject(VectorIndexManager) private vectorIndexManager: VectorIndexManager, // ✅ L2: 注入向量索引管理器
    @inject(SemanticRetriever) private semanticRetriever: SemanticRetriever, // ✅ L2: 注入语义检索器
    @inject(QueryExecutor) private queryExecutor: QueryExecutor, // ✅ L2.5: 注入查询执行器
    @inject(WeightCalculator) private weightCalculator: WeightCalculator, // ✅ L2.5: 注入权重计算器
    @inject(IndexSyncService) private indexSyncService: IndexSyncService, // ✅ L2.5: 注入索引同步服务
    @inject(HybridRetriever) private hybridRetriever: HybridRetriever // ✅ L2: 注入混合检索器
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
      const finalWeight = this.weightCalculator.calculateInitialWeight(memory.outcome);

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
      
      // ✅ L2: 异步更新向量索引，不阻塞主流程
      this.vectorIndexManager.updateIndexAsync(id, newMemory).catch(e => {
        console.error('[EpisodicMemory] Failed to update vector index:', e);
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
      // ✅ L2.5: 委托给 QueryExecutor 处理底层检索
      const memories = await this.queryExecutor.getRecentMemories(options.limit || 20);

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_retrieve', 'success', duration, {
        parameters: { count: memories.length }
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

      // ✅ L2: 委托给 HybridRetriever 进行混合检索
      const results = await this.hybridRetriever.search(query, {
        limit: options.limit,
        vectorWeight: options.vectorWeight,
        keywordWeight: options.keywordWeight
      });
      
      return results;
    } catch (error) {
      console.error('[EpisodicMemory] search failed:', error);
      return [];
    }
  }

  /**
   * ✅ L2.5: 委托给 QueryExecutor
   */
  private async searchWithLike(
    db: Database,
    projectFingerprint: string,
    query: string,
    limit: number,
    offset: number
  ): Promise<EpisodicMemoryRecord[]> {
    return this.queryExecutor.searchByKeywords(query, { limit, offset });
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

  // ========== 混合检索核心方法 ==========

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
    // ✅ L2.5: 委托给 QueryExecutor
    const memories = await this.queryExecutor.getRecentMemories(100); // 简单实现，后续可优化为 getById
    return memories.find(m => m.id === id) || null;
  }

  /**
   * 批量获取记忆（性能优化：避免N+1查询）
   */
  private async getMemoriesByIds(ids: string[]): Promise<EpisodicMemoryRecord[]> {
    // ✅ L2.5: 委托给 QueryExecutor
    const all = await this.queryExecutor.getRecentMemories(1000);
    const memoryMap = new Map(all.map(m => [m.id, m]));
    return ids.map(id => memoryMap.get(id)).filter((m): m is EpisodicMemoryRecord => m !== undefined);
  }

  /**
   * LIKE 查询降级方案
   */
  private async searchWithLikeFallback(query: string, limit: number): Promise<EpisodicMemoryRecord[]> {
    // ✅ L2.5: 委托给 QueryExecutor
    return this.queryExecutor.searchByKeywords(query, { limit });
  }

  /**
   * 从数据库获取最近记忆
   */
  private async getRecentMemoriesFromDB(limit: number, memoryTier?: MemoryTier): Promise<EpisodicMemoryRecord[]> {
    // ✅ L2.5: 委托给 QueryExecutor
    return this.queryExecutor.getRecentMemories(limit);
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
  /**
   * ✅ L2.5: 委托给 IndexSyncService
   */
  private async buildIndexWithNewManager(): Promise<void> {
    return this.indexSyncService.rebuildIndex();
  }
}
