/**
 * WeightCalculator 单元测试
 */

import 'reflect-metadata';
import { WeightCalculator } from '../../../src/core/application/WeightCalculator';
import { EpisodicMemoryRecord, TaskOutcome } from '../../../src/core/memory/types';

describe('WeightCalculator', () => {
  let calculator: WeightCalculator;

  beforeEach(() => {
    calculator = new WeightCalculator();
  });

  describe('calculateInitialWeight', () => {
    it('应该为 SUCCESS 结果分配高权重', () => {
      expect(calculator.calculateInitialWeight('SUCCESS')).toBe(8);
    });

    it('应该为 PARTIAL 结果分配中等权重', () => {
      expect(calculator.calculateInitialWeight('PARTIAL')).toBe(5);
    });

    it('应该为 FAILED 结果分配低权重', () => {
      expect(calculator.calculateInitialWeight('FAILED')).toBe(2);
    });

    it('应该为 CANCELLED 结果分配最低权重', () => {
      expect(calculator.calculateInitialWeight('CANCELLED')).toBe(1);
    });

    it('应该为未知结果分配默认权重', () => {
      expect(calculator.calculateInitialWeight('UNKNOWN' as any)).toBe(5);
    });
  });

  describe('calculateDynamicWeight', () => {
    const mockMemory: EpisodicMemoryRecord = {
      id: 'test_1',
      projectFingerprint: 'fp_123',
      timestamp: Date.now() - (24 * 60 * 60 * 1000), // 1天前
      taskType: 'CODE_GENERATE',
      summary: 'Test memory',
      entities: [],
      decision: '',
      outcome: 'SUCCESS',
      finalWeight: 8.0,
      modelId: 'gpt-4',
      durationMs: 1000,
      memoryTier: 'SHORT_TERM'
    };

    it('应该对旧记忆应用时间衰减', () => {
      const oldMemory = { ...mockMemory, timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000) }; // 10天前
      const weight = calculator.calculateDynamicWeight(oldMemory);
      expect(weight).toBeLessThan(8.0);
    });

    it('应该在意图匹配时增加权重', () => {
      // 使用刚发生的记忆以避免时间衰减影响
      const freshMemory = { ...mockMemory, timestamp: Date.now() };
      const queryVector = { temporal: 0.8, entity: 0.8, semantic: 0.5, distantTemporal: 0.2 };
      const weight = calculator.calculateDynamicWeight(freshMemory, queryVector);
      expect(weight).toBeGreaterThan(8.0);
    });

    it('应该处理没有意图向量的情况', () => {
      const weight = calculator.calculateDynamicWeight(mockMemory);
      expect(weight).toBeDefined();
    });
  });
});
