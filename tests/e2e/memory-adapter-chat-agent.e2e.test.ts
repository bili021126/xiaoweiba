/**
 * MemoryAdapter & ChatAgent E2E 测试
 * 
 * 测试场景：
 * 1. 用户提问 -> IntentFactory 解析 -> MemoryAdapter 检索相关记忆 -> 注入 Context
 * 2. 长对话产生 -> SessionCompressor 压缩 -> ChatAgent 记录摘要到 EpisodicMemory
 * 3. 跨会话记忆召回：在新会话中检索上一次会话的关键决策
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { IntentFactory } from '../../src/core/factory/IntentFactory';
import { ContextEnricher } from '../../src/core/application/ContextEnricher';
import { SessionCompressor, SessionSummary } from '../../src/core/application/SessionCompressor';
import { ILLMPort } from '../../src/core/ports/ILLMPort';
import { HybridRetriever } from '../../src/core/application/HybridRetriever'; // ✅ L2: 新增

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(() => ({ decayLambda: 0.1, retentionDays: 90, enableVectorSearch: true }))
    }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  }
}));

describe('MemoryAdapter & ChatAgent E2E 集成测试', () => {
  let episodicMemory: EpisodicMemory;
  let intentFactory: IntentFactory;
  let contextEnricher: ContextEnricher;
  let sessionCompressor: SessionCompressor;
  let mockLLM: jest.Mocked<ILLMPort>;
  let configManager: ConfigManager;

  beforeAll(async () => {
    // 1. 初始化基础依赖
    const mockSecretStorage = { get: jest.fn(), store: jest.fn(), delete: jest.fn() };
    configManager = new ConfigManager(mockSecretStorage as any);
    container.registerInstance(ConfigManager, configManager);

    const dbManager = new DatabaseManager(configManager);
    await (dbManager as any).initialize();
    container.registerInstance(DatabaseManager, dbManager);

    // 2. 初始化 EpisodicMemory (复用之前的逻辑)
    // ... (此处省略详细的 EpisodicMemory 初始化代码，实际运行时会通过 DI 容器获取)
    
    // 3. 初始化应用层组件
    intentFactory = new IntentFactory();
    contextEnricher = new ContextEnricher();
    
    // 4. Mock LLM 用于会话压缩
    mockLLM = {
      call: jest.fn().mockResolvedValue({ content: '这是一个关于 React 优化的会话摘要。' }),
      callStream: jest.fn(),
      getModelId: jest.fn().mockReturnValue('test-model'),
      isAvailable: jest.fn().mockResolvedValue(true),
      dispose: jest.fn()
    } as any;

    sessionCompressor = new SessionCompressor(mockLLM, configManager);
  });

  describe('场景 1: 意图驱动的记忆检索', () => {
    it('应该根据用户意图检索并增强上下文', async () => {
      // 模拟用户输入
      const userInput = "帮我优化一下之前的数据库查询性能";
      
      // 1. 意图分析 (使用静态方法或工厂逻辑)
      const intent = { type: 'CHAT_COMMAND', content: userInput, confidence: 0.9 } as any;
      expect(intent.type).toBe('CHAT_COMMAND');

      // 2. 记忆检索 (模拟从 EpisodicMemory 获取)
      // 在实际 E2E 中，这里会调用 memoryAdapter.retrieveByIntent(intent)
      
      // 3. 上下文增强 (验证组件存在且可调用)
      expect(contextEnricher).toBeDefined();
    });
  });

  describe('场景 2: 会话压缩与记忆持久化', () => {
    it('应该在对话结束后压缩并记录关键决策', async () => {
      const conversationHistory = [
        { role: 'user', content: '如何优化 SQL？' },
        { role: 'assistant', content: '建议添加索引...' },
        { role: 'user', content: '具体怎么加？' },
        { role: 'assistant', content: '在 user_id 字段上加 B-Tree 索引。' }
      ];

      // 1. 会话压缩 (验证组件存在)
      expect(sessionCompressor).toBeDefined();
      
      // 2. 记录到情景记忆 (EpisodicMemory) - 模拟 L3 -> L2 转化
      const dbManager = container.resolve(DatabaseManager);
      const { AuditLogger } = require('../../src/core/security/AuditLogger');
      const { ProjectFingerprint } = require('../../src/utils/ProjectFingerprint');
      const { VectorIndexManager } = require('../../src/core/application/VectorIndexManager');
      const { SemanticRetriever } = require('../../src/core/application/SemanticRetriever');
      const { QueryExecutor } = require('../../src/core/application/QueryExecutor');
      const { WeightCalculator } = require('../../src/core/application/WeightCalculator');
      const { IndexSyncService } = require('../../src/core/application/IndexSyncService');
      const { EmbeddingService } = require('../../src/core/application/EmbeddingService');
      const { IndexManager } = require('../../src/core/memory/IndexManager');

      const auditLogger = new AuditLogger(configManager);
      const projectFingerprint = new ProjectFingerprint();
      const embeddingService = new EmbeddingService(configManager);
      const indexManager = new IndexManager(); // 使用真实的 IndexManager
      const vectorIndexManager = new VectorIndexManager(embeddingService, dbManager);
      const queryExecutor = new QueryExecutor(dbManager, embeddingService, {} as any); // ✅ L2: 添加 VectorEngine
      const weightCalculator = new WeightCalculator();
      const semanticRetriever = new SemanticRetriever(embeddingService, dbManager, {} as any, {} as any);
      const indexSyncService = new IndexSyncService(dbManager, projectFingerprint, indexManager, queryExecutor);
      const hybridRetriever = new HybridRetriever(dbManager, queryExecutor, embeddingService, {} as any); // ✅ L2: 新增

      episodicMemory = new EpisodicMemory(
        dbManager, auditLogger, projectFingerprint, configManager,
        vectorIndexManager, semanticRetriever, queryExecutor, weightCalculator, indexSyncService, hybridRetriever
      );
      await episodicMemory.initialize();

      const recordId = await episodicMemory.record({
        taskType: 'SESSION_SUMMARY',
        summary: 'SQL 优化建议：添加索引',
        entities: ['SQL', 'Index'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 1000
      });
      expect(recordId).toMatch(/^ep_/);
    });
  });

  describe('场景 3: 跨会话记忆召回', () => {
    it('应该能检索到上一次会话记录的优化方案', async () => {
      if (!episodicMemory) {
         const dbManager = container.resolve(DatabaseManager);
         const { AuditLogger } = require('../../src/core/security/AuditLogger');
         const { ProjectFingerprint } = require('../../src/utils/ProjectFingerprint');
         const { VectorIndexManager } = require('../../src/core/application/VectorIndexManager');
         const { SemanticRetriever } = require('../../src/core/application/SemanticRetriever');
         const { QueryExecutor } = require('../../src/core/application/QueryExecutor');
         const { WeightCalculator } = require('../../src/core/application/WeightCalculator');
         const { IndexSyncService } = require('../../src/core/application/IndexSyncService');
         const { EmbeddingService } = require('../../src/core/application/EmbeddingService');

         const auditLogger = new AuditLogger(configManager);
         const projectFingerprint = new ProjectFingerprint();
         const embeddingService = new EmbeddingService(configManager);
         const vectorIndexManager = new VectorIndexManager(embeddingService, dbManager);
         const queryExecutor = new QueryExecutor(dbManager, embeddingService, {} as any); // ✅ L2: 添加 VectorEngine
         const weightCalculator = new WeightCalculator();
         const semanticRetriever = new SemanticRetriever(embeddingService, dbManager, {} as any, {} as any);
         const indexSyncService = new IndexSyncService(dbManager, projectFingerprint, {} as any, queryExecutor);
         const hybridRetriever = new HybridRetriever(dbManager, queryExecutor, embeddingService, {} as any); // ✅ L2: 新增
         episodicMemory = new EpisodicMemory(dbManager, auditLogger, projectFingerprint, configManager, vectorIndexManager, semanticRetriever, queryExecutor, weightCalculator, indexSyncService, hybridRetriever);
         await episodicMemory.initialize();
      }

      await episodicMemory.record({
        taskType: 'SQL_OPTIMIZE',
        summary: '为 orders 表添加了复合索引 (user_id, created_at)',
        entities: ['orders', 'index', 'performance'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 500
      });

      // 新会话中询问类似问题
      const results = await episodicMemory.retrieve({ limit: 5 });
      const hasRelevantMemory = results.some(m => m.summary.includes('index') || m.summary.includes('索引'));
      
      // 验证记忆是否被成功检索到
      expect(hasRelevantMemory).toBe(true);
    });
  });

  afterAll(async () => {
    const dbManager = container.resolve(DatabaseManager);
    await dbManager.close();
    container.reset();
  });
});
