/**
 * IndexManager 单元测试
 */

import { IndexManager } from '../../../src/core/memory/IndexManager';
import { EpisodicMemoryRecord } from '../../../src/core/memory/types';

describe('IndexManager', () => {
  let indexManager: IndexManager;

  beforeEach(() => {
    indexManager = new IndexManager();
  });

  describe('buildIndex', () => {
    it('应该正确构建索引', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_EXPLAIN',
          summary: '解释函数功能',
          entities: ['calculateSum'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 8.0
        },
        {
          id: 'mem2',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_GENERATE',
          summary: '生成排序算法',
          entities: ['quickSort'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 200,
          memoryTier: 'SHORT_TERM',
          finalWeight: 7.5
        }
      ];

      indexManager.buildIndex(memories);

      // 验证索引已构建
      const stats = indexManager.getStats();
      expect(stats.termCount).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('应该限制索引数量', () => {
      const memories: EpisodicMemoryRecord[] = Array.from({ length: 100 }, (_, i) => ({
        id: `mem${i}`,
        projectFingerprint: 'test',
        timestamp: Date.now(),
        taskType: 'CODE_EXPLAIN',
        summary: `记忆 ${i}`,
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 100,
        memoryTier: 'SHORT_TERM',
        finalWeight: 5.0
      }));

      indexManager.buildIndex(memories, 10);

      const candidateIds = indexManager.getCandidateIds('记忆');
      expect(candidateIds.size).toBeLessThanOrEqual(10);
    });
  });

  describe('getCandidateIds', () => {
    beforeEach(() => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_EXPLAIN',
          summary: 'explain quick sort algorithm',
          entities: ['quickSort', 'algorithm'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 8.0
        },
        {
          id: 'mem2',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_GENERATE',
          summary: 'generate bubble sort code',
          entities: ['bubbleSort'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 150,
          memoryTier: 'SHORT_TERM',
          finalWeight: 7.0
        }
      ];
      indexManager.buildIndex(memories);
    });

    it('应该返回包含查询词的候选ID', () => {
      const candidates = indexManager.getCandidateIds('quick');
      expect(candidates.size).toBeGreaterThan(0);
      expect(candidates.has('mem1')).toBe(true);
    });

    it('应该返回空集合当无匹配时', () => {
      const candidates = indexManager.getCandidateIds('不存在的词xyz');
      expect(candidates.size).toBe(0);
    });

    it('应该支持实体匹配', () => {
      const candidates = indexManager.getCandidateIds('quickSort');
      expect(candidates.has('mem1')).toBe(true);
    });
  });

  describe('removeFromIndex', () => {
    it('应该从索引中移除记忆', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_EXPLAIN',
          summary: 'test memory record',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 5.0
        }
      ];

      indexManager.buildIndex(memories);
      
      let candidates = indexManager.getCandidateIds('test');
      expect(candidates.has('mem1')).toBe(true);

      indexManager.removeFromIndex('mem1');
      
      candidates = indexManager.getCandidateIds('test');
      expect(candidates.has('mem1')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_EXPLAIN',
          summary: '测试一',
          entities: ['entity1'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 5.0
        }
      ];

      indexManager.buildIndex(memories);
      const stats = indexManager.getStats();

      expect(stats.termCount).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('应该清空索引', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now(),
          taskType: 'CODE_EXPLAIN',
          summary: '测试',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 5.0
        }
      ];

      indexManager.buildIndex(memories);
      expect(indexManager.getStats().termCount).toBeGreaterThan(0);

      indexManager.clear();
      expect(indexManager.getStats().termCount).toBe(0);
    });
  });
});
