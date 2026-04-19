/**
 * SearchEngine 单元测试
 */

import { SearchEngine } from '../../../src/core/memory/SearchEngine';
import { EpisodicMemoryRecord } from '../../../src/core/memory/types';

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine();
  });

  describe('rankAndRetrieve', () => {
    it('应该返回空数组当候选集为空时', () => {
      const candidateIds = new Set<string>();
      const allMemories: EpisodicMemoryRecord[] = [];
      
      const results = searchEngine.rankAndRetrieve(candidateIds, allMemories, 'test query');
      expect(results).toEqual([]);
    });

    it('应该对候选记忆进行评分和排序', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now() - 1000 * 60 * 60, // 1小时前
          taskType: 'CODE_EXPLAIN',
          summary: 'explain quick sort algorithm',
          entities: ['quickSort'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 8.0
        },
        {
          id: 'mem2',
          projectFingerprint: 'test',
          timestamp: Date.now() - 1000 * 60 * 60 * 24, // 24小时前
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

      const candidateIds = new Set(['mem1', 'mem2']);
      const results = searchEngine.rankAndRetrieve(candidateIds, memories, 'quick sort');

      expect(results.length).toBeGreaterThan(0);
      // mem1应该排在前面（更相关、更新）
      expect(results[0].id).toBe('mem1');
    });

    it('应该限制返回数量', () => {
      const memories: EpisodicMemoryRecord[] = Array.from({ length: 10 }, (_, i) => ({
        id: `mem${i}`,
        projectFingerprint: 'test',
        timestamp: Date.now(),
        taskType: 'CODE_EXPLAIN',
        summary: `test memory ${i}`,
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 100,
        memoryTier: 'SHORT_TERM',
        finalWeight: 5.0
      }));

      const candidateIds = new Set(memories.map(m => m.id));
      const results = searchEngine.rankAndRetrieve(candidateIds, memories, 'test', { limit: 3 });

      expect(results.length).toBe(3);
    });
  });

  describe('calculateScore', () => {
    it('应该计算综合得分', () => {
      const memory: EpisodicMemoryRecord = {
        id: 'mem1',
        projectFingerprint: 'test',
        timestamp: Date.now(),
        taskType: 'CODE_EXPLAIN',
        summary: 'explain function',
        entities: ['calculateSum'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 100,
        memoryTier: 'SHORT_TERM',
        finalWeight: 8.0
      };

      // 私有方法无法直接测试，通过rankAndRetrieve间接验证
      const candidateIds = new Set(['mem1']);
      const results = searchEngine.rankAndRetrieve(candidateIds, [memory], 'explain function');
      
      expect(results.length).toBe(1);
    });
  });

  describe('getRecentMemories (降级策略)', () => {
    it('无候选时应返回最近的记忆', () => {
      const memories: EpisodicMemoryRecord[] = [
        {
          id: 'mem1',
          projectFingerprint: 'test',
          timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2小时前
          taskType: 'CODE_EXPLAIN',
          summary: 'old memory',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 5.0
        },
        {
          id: 'mem2',
          projectFingerprint: 'test',
          timestamp: Date.now(), // 最新
          taskType: 'CODE_EXPLAIN',
          summary: 'recent memory',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100,
          memoryTier: 'SHORT_TERM',
          finalWeight: 5.0
        }
      ];

      const candidateIds = new Set<string>(); // 空候选集
      const results = searchEngine.rankAndRetrieve(candidateIds, memories, 'any query');

      expect(results.length).toBeGreaterThan(0);
      // 应该返回最近的记忆
      expect(results[0].id).toBe('mem2');
    });
  });
});
