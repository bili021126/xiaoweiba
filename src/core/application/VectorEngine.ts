/**
 * 向量引擎 - 负责文本向量化与相似度计算
 * 
 * 设计原则：单一职责
 */

import { injectable } from 'tsyringe';

interface ScoredItem<T> {
  item: T;
  score: number;
}

@injectable()
export class VectorEngine {
  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 批量计算查询向量与候选向量列表的相似度，并返回 Top-K
   */
  topKSimilarity<T>(
    queryVector: number[],
    candidates: T[],
    vectorExtractor: (item: T) => number[] | null,
    topK: number = 10
  ): T[] {
    if (!queryVector || queryVector.length === 0) return [];

    const scored: ScoredItem<T>[] = [];

    for (const candidate of candidates) {
      const candidateVector = vectorExtractor(candidate);
      if (!candidateVector || candidateVector.length === 0) continue;

      const similarity = this.cosineSimilarity(queryVector, candidateVector);
      scored.push({ item: candidate, score: similarity });
    }

    // 按相似度降序排序
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(s => s.item);
  }
}
