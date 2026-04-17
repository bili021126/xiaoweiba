/**
 * MemoryService 高覆盖率测试
 * 针对统一记忆访问接口的深度测试
 */

import 'reflect-metadata';
import { MemoryService } from '../../../src/core/memory/MemoryService';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';

describe('MemoryService - High Coverage', () => {
  let memoryService: MemoryService;
  let mockEpisodicMemory: any;

  beforeEach(() => {
    // 创建mock EpisodicMemory
    mockEpisodicMemory = {
      record: jest.fn().mockResolvedValue('ep_test_123'),
      retrieve: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({ totalCount: 0 })
    };

    memoryService = new MemoryService(mockEpisodicMemory as EpisodicMemory);
  });

  describe('searchMemories - 搜索功能', () => {
    it('应该使用query搜索', async () => {
      const memories = await memoryService.searchMemories('test query', 'CODE_EXPLAIN', 5);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('test query', { limit: 5 });
    });

    it('应该仅使用taskType搜索当query为空', async () => {
      const memories = await memoryService.searchMemories('', 'CODE_GENERATE', 3);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.retrieve).toHaveBeenCalled();
    });

    it('应该处理null query', async () => {
      const memories = await memoryService.searchMemories(null as any, 'CODE_EXPLAIN', 5);
      
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理undefined taskType', async () => {
      const memories = await memoryService.searchMemories('test', undefined, 5);
      
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该使用默认limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('test', { limit: 5 });
    });

    it('应该处理自定义limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', 10);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('test', { limit: 10 });
    });

    it('应该在搜索失败时返回空数组', async () => {
      mockEpisodicMemory.search.mockRejectedValue(new Error('Search failed'));
      
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', 5);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
  });

  describe('recordMemory - 记录功能', () => {
    it('应该成功记录记忆', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test summary',
        entities: ['entity1'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
      expect(mockEpisodicMemory.record).toHaveBeenCalledWith({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test summary',
        entities: ['entity1'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
    });

    it('应该处理空entities', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_GENERATE',
        summary: 'No entities',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 200
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理FAILURE outcome', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Failed task',
        entities: ['error'],
        outcome: 'FAILURE',
        modelId: 'test-model',
        durationMs: 50
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理PARTIAL outcome', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Partial task',
        entities: ['partial'],
        outcome: 'PARTIAL',
        modelId: 'test-model',
        durationMs: 150
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该在记录失败时返回null', async () => {
      mockEpisodicMemory.record.mockRejectedValue(new Error('Record failed'));
      
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBeNull();
    });

    it('应该处理超长summary', async () => {
      const longSummary = 'A'.repeat(1000);
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: longSummary,
        entities: ['long'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理durationMs为0', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Zero duration',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 0
      });
      
      expect(recordId).toBe('ep_test_123');
    });
  });

  describe('getRecentMemories - 获取最近记忆', () => {
    it('应该获取最近的记忆', async () => {
      const memories = await memoryService.getRecentMemories(10);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.retrieve).toHaveBeenCalledWith({ limit: 10 });
    });

    it('应该使用默认limit', async () => {
      const memories = await memoryService.getRecentMemories();
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.retrieve).toHaveBeenCalledWith({ limit: 10 });
    });

    it('应该支持memoryTier过滤', async () => {
      const memories = await memoryService.getRecentMemories(5, 'SHORT_TERM');
      
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该在失败时返回空数组', async () => {
      mockEpisodicMemory.retrieve.mockRejectedValue(new Error('Retrieve failed'));
      
      const memories = await memoryService.getRecentMemories(5);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
  });

  describe('searchByEntity - 按实体搜索', () => {
    it('应该按实体搜索', async () => {
      const memories = await memoryService.searchByEntity('testEntity', 5);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('testEntity', { limit: 5 });
    });

    it('应该使用默认limit', async () => {
      const memories = await memoryService.searchByEntity('testEntity');
      
      expect(Array.isArray(memories)).toBe(true);
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('testEntity', { limit: 5 });
    });

    it('应该在失败时返回空数组', async () => {
      mockEpisodicMemory.search.mockRejectedValue(new Error('Search failed'));
      
      const memories = await memoryService.searchByEntity('testEntity', 5);
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBe(0);
    });
  });

  describe('getStats - 获取统计', () => {
    it('应该获取统计数据', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats).toBeDefined();
      expect(mockEpisodicMemory.getStats).toHaveBeenCalled();
    });

    it('应该在失败时返回默认值', async () => {
      mockEpisodicMemory.getStats.mockRejectedValue(new Error('Stats failed'));
      
      const stats = await memoryService.getStats();
      
      expect(stats).toEqual({ totalCount: 0 });
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串参数', async () => {
      const memories = await memoryService.searchMemories('', '', 5);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理负数limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', -1);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理极大limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', 999999);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理零limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', 0);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理null taskType', async () => {
      const memories = await memoryService.searchMemories('test', null as any, 5);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理undefined limit', async () => {
      const memories = await memoryService.searchMemories('test', 'CODE_EXPLAIN', undefined as any);
      expect(Array.isArray(memories)).toBe(true);
    });
  });

  describe('recordMemory异常场景', () => {
    it('应该处理空summary', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: '',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理超长summary', async () => {
      const longSummary = 'A'.repeat(5000);
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: longSummary,
        entities: ['long'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理大量entities', async () => {
      const manyEntities = Array.from({ length: 100 }, (_, i) => `entity_${i}`);
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Many entities',
        entities: manyEntities,
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理空modelId', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'No model',
        entities: [],
        outcome: 'SUCCESS',
        modelId: '',
        durationMs: 100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理零durationMs', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Zero duration',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 0
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理超大durationMs', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_GENERATE',
        summary: 'Long running',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 86400000 // 24小时
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理负数durationMs', async () => {
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Negative duration',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: -100
      });
      
      expect(recordId).toBe('ep_test_123');
    });

    it('应该处理所有outcome类型', async () => {
      const outcomes: Array<'SUCCESS' | 'FAILURE' | 'PARTIAL'> = ['SUCCESS', 'FAILURE', 'PARTIAL'];
      
      for (const outcome of outcomes) {
        const recordId = await memoryService.recordMemory({
          taskType: 'CODE_EXPLAIN',
          summary: `Outcome: ${outcome}`,
          entities: [],
          outcome: outcome,
          modelId: 'test-model',
          durationMs: 100
        });
        
        expect(recordId).toBe('ep_test_123');
      }
    });

    it('应该处理不同taskType', async () => {
      const taskTypes = ['CODE_EXPLAIN', 'CODE_GENERATE', 'DEBUG', 'REFACTOR'];
      
      for (const taskType of taskTypes) {
        const recordId = await memoryService.recordMemory({
          taskType: taskType,
          summary: `Task: ${taskType}`,
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'test-model',
          durationMs: 100
        });
        
        expect(recordId).toBe('ep_test_123');
      }
    });

    it('应该在数据库异常时返回null', async () => {
      mockEpisodicMemory.record.mockRejectedValue(new Error('Database error'));
      
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBeNull();
    });

    it('应该在超时异常时返回null', async () => {
      mockEpisodicMemory.record.mockRejectedValue(new Error('Timeout'));
      
      const recordId = await memoryService.recordMemory({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });
      
      expect(recordId).toBeNull();
    });
  });

  describe('getRecentMemories边界', () => {
    it('应该处理负数limit', async () => {
      const memories = await memoryService.getRecentMemories(-1);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理零limit', async () => {
      const memories = await memoryService.getRecentMemories(0);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理极大limit', async () => {
      const memories = await memoryService.getRecentMemories(999999);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理不同memoryTier', async () => {
      const tiers = ['SHORT_TERM', 'LONG_TERM', undefined];
      
      for (const tier of tiers) {
        const memories = await memoryService.getRecentMemories(5, tier as any);
        expect(Array.isArray(memories)).toBe(true);
      }
    });
  });

  describe('searchByEntity边界', () => {
    it('应该处理空实体名', async () => {
      const memories = await memoryService.searchByEntity('', 5);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理特殊字符实体', async () => {
      const memories = await memoryService.searchByEntity('@#$%', 5);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理超长实体名', async () => {
      const longEntity = 'E'.repeat(500);
      const memories = await memoryService.searchByEntity(longEntity, 5);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理负数limit', async () => {
      const memories = await memoryService.searchByEntity('test', -1);
      expect(Array.isArray(memories)).toBe(true);
    });

    it('应该处理零limit', async () => {
      const memories = await memoryService.searchByEntity('test', 0);
      expect(Array.isArray(memories)).toBe(true);
    });
  });
});
