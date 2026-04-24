/**
 * VectorEngine 单元测试 - 验证四因子权重计算与余弦相似度
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { VectorEngine } from '../../../../src/core/application/VectorEngine';

describe('VectorEngine Unit Tests', () => {
  let engine: VectorEngine;

  beforeEach(() => {
    container.clearInstances();
    engine = container.resolve(VectorEngine);
  });

  it('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(engine.cosineSimilarity(a, b)).toBeCloseTo(1);

    const c = [1, 0, 0];
    const d = [0, 1, 0];
    expect(engine.cosineSimilarity(c, d)).toBeCloseTo(0);
  });

  it('should handle zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 1, 1];
    expect(engine.cosineSimilarity(a, b)).toBe(0);
  });

  it('should calculate hybrid score with four factors', () => {
    const weights = { vector: 0.4, keyword: 0.3, recency: 0.2, entity: 0.1 };
    const score = engine.calculateHybridScore(0.8, 0.6, 0.9, 0.5, weights);
    
    // 0.8*0.4 + 0.6*0.3 + 0.9*0.2 + 0.5*0.1 = 0.32 + 0.18 + 0.18 + 0.05 = 0.73
    expect(score).toBeCloseTo(0.73);
  });

  it('should return topK similar items', () => {
    const queryVector = [1, 0, 0];
    const candidates = [
      { id: '1', vector: [1, 0, 0] },
      { id: '2', vector: [0, 1, 0] },
      { id: '3', vector: [0.9, 0.1, 0] }
    ];
    
    const results = engine.topKSimilarity(
      queryVector,
      candidates,
      (item: any) => item.vector,
      2
    );

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('1'); // Most similar
  });
});
