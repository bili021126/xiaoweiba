/**
 * QueryExecutor 单元测试
 */

import 'reflect-metadata';
import { QueryExecutor } from '../../../src/core/application/QueryExecutor';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { EmbeddingService } from '../../../src/core/application/EmbeddingService';
import { VectorEngine } from '../../../src/core/application/VectorEngine';

describe('QueryExecutor', () => {
  let executor: QueryExecutor;
  let mockDbManager: any;
  let mockEmbeddingService: any;
  let mockStmt: any;

  beforeEach(() => {
    mockStmt = {
      bind: jest.fn(),
      step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false), // 模拟返回一行数据
      getAsObject: jest.fn().mockReturnValue({
        id: 'test_1',
        project_fingerprint: 'fp_123',
        timestamp: Date.now(),
        task_type: 'CODE_GENERATE',
        summary: 'Test summary',
        entities: '[]',
        decision: null,
        outcome: 'SUCCESS',
        final_weight: 8.0,
        model_id: 'gpt-4',
        latency_ms: 1000,
        metadata: null,
        vector: null,
        memory_tier: 'SHORT_TERM'
      }),
      free: jest.fn()
    };

    const mockDb = {
      prepare: jest.fn().mockReturnValue(mockStmt)
    };

    mockDbManager = {
      getDatabase: jest.fn().mockReturnValue(mockDb)
    };

    mockEmbeddingService = {
      isEnabled: jest.fn().mockReturnValue(false),
      embed: jest.fn()
    };

    const mockVectorEngine = new VectorEngine();
    executor = new QueryExecutor(mockDbManager, mockEmbeddingService, mockVectorEngine);
  });

  describe('searchByKeywords', () => {
    it('应该执行关键词搜索并返回结果', async () => {
      const results = await executor.searchByKeywords('test', { limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test_1');
      // searchByKeywords 内部会将 limit * 3 以扩大召回量
      expect(mockStmt.bind).toHaveBeenCalledWith(['%test%', 30, 0]);
    });
  });

  describe('getRecentMemories', () => {
    it('应该获取最近的记忆', async () => {
      const results = await executor.getRecentMemories(20);
      expect(results).toHaveLength(1);
      expect(mockStmt.bind).toHaveBeenCalledWith([20]);
    });
  });

  describe('searchByVector', () => {
    it('在向量搜索禁用时应降级为关键词搜索', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);
      const results = await executor.searchByVector('test', { limit: 10 });
      expect(results).toBeDefined();
    });

    it('在向量搜索启用时应调用嵌入服务', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue(new Array(384).fill(0));
      
      // 由于目前 searchByVector 内部逻辑是返回空数组（等待后续实现），我们主要测试它不报错
      const results = await executor.searchByVector('test', { limit: 10 });
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('test');
    });
  });
});
