/**
 * VectorEngine 单元测试
 */

import { VectorEngine } from '../../../src/core/application/VectorEngine';

describe('VectorEngine', () => {
  let vectorEngine: VectorEngine;

  beforeEach(() => {
    vectorEngine = new VectorEngine();
  });

  describe('cosineSimilarity', () => {
    it('应该正确计算两个正交向量的相似度（结果为0）', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('应该正确计算相同向量的相似度（结果为1）', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('应该正确计算45度角向量的相似度', () => {
      const vecA = [1, 0, 0];
      const vecC = [1, 1, 0];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecC);
      
      // cos(45°) ≈ 0.7071
      expect(similarity).toBeCloseTo(0.7071, 4);
    });

    it('当向量长度不一致时应返回0', () => {
      const vecA = [1, 0, 0];
      const vecB = [1, 0];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBe(0);
    });

    it('当向量为空时应返回0', () => {
      const vecA: number[] = [];
      const vecB: number[] = [];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBe(0);
    });

    it('当其中一个向量为零向量时应返回0', () => {
      const vecA = [1, 2, 3];
      const vecB = [0, 0, 0];
      
      const similarity = vectorEngine.cosineSimilarity(vecA, vecB);
      
      expect(similarity).toBe(0);
    });
  });

  describe('topKSimilarity', () => {
    interface TestItem {
      id: string;
      vector: number[];
    }

    it('应该返回按相似度降序排列的Top-K结果', () => {
      const queryVector = [1, 0, 0];
      const candidates: TestItem[] = [
        { id: 'item1', vector: [0, 1, 0] },   // 相似度: 0
        { id: 'item2', vector: [1, 0, 0] },   // 相似度: 1
        { id: 'item3', vector: [1, 1, 0] },   // 相似度: 0.7071
        { id: 'item4', vector: [0.5, 0.5, 0] }, // 相似度: 0.7071
      ];

      const results = vectorEngine.topKSimilarity(
        queryVector,
        candidates,
        (item) => item.vector,
        3
      );

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('item2'); // 最相似
      expect(['item3', 'item4']).toContain(results[1].id); // 次相似
    });

    it('当查询向量为空时应返回空数组', () => {
      const candidates: TestItem[] = [
        { id: 'item1', vector: [1, 0, 0] },
      ];

      const results = vectorEngine.topKSimilarity(
        [],
        candidates,
        (item) => item.vector,
        10
      );

      expect(results).toHaveLength(0);
    });

    it('应该跳过向量提取器返回null的候选项', () => {
      const queryVector = [1, 0, 0];
      const candidates: TestItem[] = [
        { id: 'item1', vector: [1, 0, 0] },
        { id: 'item2', vector: [] }, // 空向量会被跳过
      ];

      const results = vectorEngine.topKSimilarity(
        queryVector,
        candidates,
        (item) => item.vector.length > 0 ? item.vector : null,
        10
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('item1');
    });

    it('当topK大于候选数量时应返回所有候选', () => {
      const queryVector = [1, 0, 0];
      const candidates: TestItem[] = [
        { id: 'item1', vector: [1, 0, 0] },
        { id: 'item2', vector: [0, 1, 0] },
      ];

      const results = vectorEngine.topKSimilarity(
        queryVector,
        candidates,
        (item) => item.vector,
        10
      );

      expect(results).toHaveLength(2);
    });
  });
});
