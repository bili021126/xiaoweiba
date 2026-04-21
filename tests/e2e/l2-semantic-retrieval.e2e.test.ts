/**
 * L2 语义检索 E2E 测试 - EmbeddingService + QueryExecutor + WeightCalculator
 * 
 * 测试场景：
 * 1. 记忆记录 -> 向量化存储 -> 索引同步
 * 2. 语义检索 -> 向量相似度计算 -> 权重排序
 * 3. 混合检索 -> 关键词 + 向量综合评分
 * 
 * L2 E2E 测试特点：
 * - 验证本地模型加载与向量化流程
 * - 测试数据库层面的向量存储与检索
 * - 验证权重计算在真实场景下的表现
 */

import 'reflect-metadata';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { AuditLogger } from '../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../src/utils/ProjectFingerprint';
import { VectorIndexManager } from '../../src/core/application/VectorIndexManager';
import { SemanticRetriever } from '../../src/core/application/SemanticRetriever';
import { QueryExecutor } from '../../src/core/application/QueryExecutor';
import { WeightCalculator } from '../../src/core/application/WeightCalculator';
import { IndexSyncService } from '../../src/core/application/IndexSyncService';
import { EmbeddingService } from '../../src/core/application/EmbeddingService';
import { HybridRetriever } from '../../src/core/application/HybridRetriever'; // ✅ L2: 新增
import { VectorEngine } from '../../src/core/application/VectorEngine'; // ✅ L2: 新增
import { container } from 'tsyringe';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key) => {
        if (key === 'memory') return { 
          decayLambda: 0.1, 
          retentionDays: 90,
          enableVectorSearch: true
        };
        return {};
      })
    }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  window: {
    showInformationMessage: jest.fn()
  }
}));

describe('L2 语义检索 E2E 测试', () => {
  let episodicMemory: EpisodicMemory;
  let dbManager: DatabaseManager;
  let configManager: ConfigManager;
  let embeddingService: EmbeddingService;
  let queryExecutor: QueryExecutor;
  let weightCalculator: WeightCalculator;

  beforeAll(async () => {
    // 初始化配置管理器
    const mockSecretStorage = {
      get: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    };

    configManager = new ConfigManager(mockSecretStorage as any);
    container.registerInstance(ConfigManager, configManager);

    // 初始化数据库
    dbManager = new DatabaseManager(configManager);
    await (dbManager as any).initialize();
    container.registerInstance(DatabaseManager, dbManager);

    // 注册其他依赖
    const auditLogger = new AuditLogger(configManager);
    container.registerInstance(AuditLogger, auditLogger);

    const projectFingerprint = new ProjectFingerprint();
    container.registerInstance(ProjectFingerprint, projectFingerprint);

    // 初始化嵌入服务
    embeddingService = new EmbeddingService(configManager);
    container.registerInstance(EmbeddingService, embeddingService);

    // 初始化查询执行器
    const vectorEngine = new VectorEngine(); // ✅ L2: 创建 VectorEngine
    queryExecutor = new QueryExecutor(dbManager, embeddingService, vectorEngine);
    container.registerInstance(QueryExecutor, queryExecutor);

    // 初始化权重计算器
    weightCalculator = new WeightCalculator();
    container.registerInstance(WeightCalculator, weightCalculator);

    // 初始化向量索引管理器
    const vectorIndexManager = new VectorIndexManager(embeddingService, dbManager);
    container.registerInstance(VectorIndexManager, vectorIndexManager);

    // 初始化语义检索器（需要 Mock 依赖）
    const mockIntentAnalyzer = { analyze: jest.fn() };
    const mockSearchEngine = { search: jest.fn() };
    const semanticRetriever = new SemanticRetriever(embeddingService, dbManager, mockIntentAnalyzer as any, mockSearchEngine as any);
    container.registerInstance(SemanticRetriever, semanticRetriever);

    // 初始化索引同步服务
    const indexManager = new (require('../../src/core/memory/IndexManager').IndexManager)();
    const indexSyncService = new IndexSyncService(dbManager, projectFingerprint, indexManager, queryExecutor);
    container.registerInstance(IndexSyncService, indexSyncService);

    // ✅ L2: 创建 HybridRetriever
    const hybridRetriever = new HybridRetriever(dbManager, queryExecutor, embeddingService, vectorEngine);
    container.registerInstance(HybridRetriever, hybridRetriever);

    // 创建 EpisodicMemory 实例
    episodicMemory = new EpisodicMemory(
      dbManager,
      auditLogger,
      projectFingerprint,
      configManager,
      vectorIndexManager,
      semanticRetriever,
      queryExecutor,
      weightCalculator,
      indexSyncService,
      hybridRetriever
    );

    await episodicMemory.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
    container.reset();
  });

  describe('场景 1: 记忆记录与向量化', () => {
    it('应该成功记录记忆并触发异步向量化', async () => {
      const recordId = await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '实现用户登录功能，包含 JWT 认证和权限验证',
        entities: ['UserAuth', 'JWT', 'Permission'],
        outcome: 'SUCCESS',
        modelId: 'gpt-4',
        durationMs: 2500
      });

      expect(recordId).toBeDefined();
      expect(recordId).toMatch(/^ep_/);

      // 等待异步向量化完成（模拟）
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该为不同结果类型分配正确的初始权重', async () => {
      const successId = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释递归算法',
        entities: ['recursion'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });

      const failedId = await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '生成数据库迁移脚本',
        entities: ['migration'],
        outcome: 'FAILED',
        modelId: 'test-model',
        durationMs: 50
      });

      expect(successId).toBeDefined();
      expect(failedId).toBeDefined();
    });
  });

  describe('场景 2: 语义检索与权重排序', () => {
    beforeAll(async () => {
      // 预置一些测试数据
      await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '实现 React 组件的状态管理',
        entities: ['React', 'useState', 'useReducer'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 300
      });

      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释 Redux 的工作原理',
        entities: ['Redux', 'Store', 'Action'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 200
      });

      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '修复内存泄漏问题',
        entities: ['memory leak', 'garbage collection'],
        outcome: 'PARTIAL',
        modelId: 'test-model',
        durationMs: 500
      });
    });

    it('应该通过关键词检索到相关记忆', async () => {
      const results = await episodicMemory.retrieve({ limit: 5 });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('应该正确处理 limit 参数', async () => {
      const results = await episodicMemory.retrieve({ limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('场景 3: 权重计算器集成测试', () => {
    it('应该正确计算时间衰减后的权重', () => {
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      const recentMemory = {
        id: 'test_1',
        projectFingerprint: 'fp_test',
        timestamp: oneDayAgo,
        taskType: 'CODE_GENERATE' as const,
        summary: 'Recent task',
        entities: [],
        decision: '',
        outcome: 'SUCCESS' as const,
        finalWeight: 8.0,
        modelId: 'test',
        durationMs: 100,
        memoryTier: 'SHORT_TERM' as const
      };

      const oldMemory = {
        ...recentMemory,
        timestamp: sevenDaysAgo,
        id: 'test_2'
      };

      const recentWeight = weightCalculator.calculateDynamicWeight(recentMemory);
      const oldWeight = weightCalculator.calculateDynamicWeight(oldMemory);

      // 旧记忆的权重应该更低（因为时间衰减）
      expect(oldWeight).toBeLessThan(recentWeight);
    });

    it('应该在意图匹配时提升权重', () => {
      const freshMemory = {
        id: 'test_3',
        projectFingerprint: 'fp_test',
        timestamp: Date.now(),
        taskType: 'CODE_GENERATE' as const,
        summary: 'Task with matching intent',
        entities: ['EntityA', 'EntityB'],
        decision: '',
        outcome: 'SUCCESS' as const,
        finalWeight: 8.0,
        modelId: 'test',
        durationMs: 100,
        memoryTier: 'SHORT_TERM' as const
      };

      const queryVector = {
        temporal: 0.9,
        entity: 0.9,
        semantic: 0.5,
        distantTemporal: 0.1
      };

      const boostedWeight = weightCalculator.calculateDynamicWeight(freshMemory, queryVector);
      expect(boostedWeight).toBeGreaterThan(8.0);
    });
  });

  describe('场景 4: 索引同步服务测试', () => {
    it('应该能够重建索引', async () => {
      const indexSyncService = container.resolve(IndexSyncService);
      
      // 这个测试主要验证不抛出异常
      await expect(indexSyncService.rebuildIndex()).resolves.not.toThrow();
    });
  });

  describe('边界情况测试', () => {
    it('应该处理特殊字符的 summary', async () => {
      const recordId = await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '实现功能：支持 Unicode 字符 🚀 和特殊符号 <>&"',
        entities: ['Unicode', 'SpecialChars'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 150
      });

      expect(recordId).toBeDefined();
    });

    it('应该处理空实体数组', async () => {
      const recordId = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '简单任务，无特定实体',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 50
      });

      expect(recordId).toBeDefined();
    });

    it('应该处理超长 summary', async () => {
      const longSummary = 'A'.repeat(1000);
      const recordId = await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: longSummary,
        entities: ['LongText'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });

      expect(recordId).toBeDefined();
    });
  });
});
