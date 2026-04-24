/**
 * WeightCalculator 单元测试 - 纯逻辑分支覆盖
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { WeightCalculator } from '../../../../src/core/application/WeightCalculator';
import { EpisodicMemoryRecord } from '../../../../src/core/memory/types';

describe('WeightCalculator (Branch Coverage)', () => {
  let calculator: WeightCalculator;

  beforeEach(() => {
    container.clearInstances();
    calculator = container.resolve(WeightCalculator);
  });

  describe('calculateInitialWeight', () => {
    it('should return 8 for SUCCESS outcome', () => {
      expect(calculator.calculateInitialWeight('SUCCESS')).toBe(8);
    });

    it('should return 5 for PARTIAL outcome', () => {
      expect(calculator.calculateInitialWeight('PARTIAL')).toBe(5);
    });

    it('should return 2 for FAILED outcome', () => {
      expect(calculator.calculateInitialWeight('FAILED')).toBe(2);
    });

    it('should return 1 for CANCELLED outcome', () => {
      expect(calculator.calculateInitialWeight('CANCELLED')).toBe(1);
    });

    it('should return 5 for unknown outcome', () => {
      expect(calculator.calculateInitialWeight('UNKNOWN' as any)).toBe(5);
    });
  });

  describe('calculateDynamicWeight', () => {
    const createMockMemory = (ageInDays: number): EpisodicMemoryRecord => ({
      id: 'mem1',
      taskType: 'TEST',
      summary: 'Test memory',
      entities: ['entity1'],
      outcome: 'SUCCESS',
      timestamp: Date.now() - (ageInDays * 24 * 60 * 60 * 1000),
      finalWeight: 1.0
    } as any);

    it('should apply time decay for old memories', () => {
      const memory = createMockMemory(10); // 10 days old
      const weight = calculator.calculateDynamicWeight(memory);
      
      expect(weight).toBeLessThan(1.0); // Should decay
    });

    it('should maintain high weight for recent memories', () => {
      const memory = createMockMemory(0.1); // 2.4 hours old
      const weight = calculator.calculateDynamicWeight(memory);
      
      expect(weight).toBeCloseTo(1.0, 1); // Minimal decay
    });

    it('should apply temporal boost for recent queries', () => {
      const memory = createMockMemory(0.5); // 12 hours old
      const queryVector = { temporal: 0.8, entity: 0.5, semantic: 0.5, distantTemporal: 0.5 };
      
      const weight = calculator.calculateDynamicWeight(memory, queryVector);
      
      expect(weight).toBeGreaterThan(1.0); // Should be boosted
    });

    it('should apply entity boost when entities match', () => {
      const memory = createMockMemory(1);
      memory.entities = ['important-entity'];
      const queryVector = { temporal: 0.5, entity: 0.8, semantic: 0.5, distantTemporal: 0.5 };
      
      const weight = calculator.calculateDynamicWeight(memory, queryVector);
      
      expect(weight).toBeGreaterThan(1.0); // Should be boosted
    });

    it('should not apply boosts without query vector', () => {
      const memory = createMockMemory(1);
      const weight = calculator.calculateDynamicWeight(memory);
      
      expect(weight).toBeLessThan(1.0); // Only time decay
    });
  });
});
