import { injectable } from 'tsyringe';
import { EpisodicMemoryRecord, RetrievalWeights } from './types';
import { IndexManager } from './IndexManager';

/**
 * 搜索引擎 - 负责记忆的检索和排序
 * 
 * 职责：
 * - TF-IDF关键词检索
 * - 语义相似度检索（向量）
 * - 混合检索与评分
 * - 自适应权重计算
 */
@injectable()
export class SearchEngine {
  constructor(private indexManager: IndexManager) {}

  /**
   * 执行TF-IDF语义搜索
   */
  async searchSemantic(
    query: string,
    candidateIds: string[],
    limit: number,
    adaptiveWeights: RetrievalWeights,
    getMemoryById: (id: string) => Promise<EpisodicMemoryRecord | null>,
    decayLambda: number
  ): Promise<EpisodicMemoryRecord[]> {
    const queryTerms = this.tokenize(query.toLowerCase());
    if (queryTerms.length === 0) return [];

    const now = Date.now();
    const scores: Array<{ id: string; score: number }> = [];

    for (const id of candidateIds) {
      const memory = await getMemoryById(id);
      if (!memory) continue;

      // 1. TF-IDF 得分
      let tfidf = 0;
      for (const term of queryTerms) {
        const tf = this.indexManager.getDocTermFreq().get(id)?.get(term) || 0;
        const idf = this.indexManager.calculateIdf(term);
        tfidf += tf * idf;
      }
      // 归一化（简单除以查询词数）
      const normTfidf = Math.min(tfidf / queryTerms.length, 1);

      // 2. 时间衰减得分
      const ageDays = (now - memory.timestamp) / (1000 * 3600 * 24);
      const timeScore = Math.exp(-ageDays * decayLambda); // λ=0.1，半衰期约7天

      // 3. 实体匹配加分
      let entityBonus = 0;
      if (memory.entities && memory.entities.length) {
        for (const term of queryTerms) {
          if (memory.entities.some(e => e.toLowerCase().includes(term))) {
            entityBonus += 0.2;
          }
        }
      }
      entityBonus = Math.min(entityBonus, 0.5);

      // 最终得分（使用自适应权重）
      const finalScore = 
        normTfidf * adaptiveWeights.k +
        timeScore * adaptiveWeights.t +
        entityBonus * adaptiveWeights.e;
      
      scores.push({ id, score: finalScore });
    }

    scores.sort((a, b) => b.score - a.score);
    const topIds = scores.slice(0, limit).map(s => s.id);
    if (topIds.length === 0) return [];
    
    // 根据 ID 获取完整记忆对象
    const results: EpisodicMemoryRecord[] = [];
    for (const id of topIds) {
      const mem = await getMemoryById(id);
      if (mem) results.push(mem);
    }
    return results;
  }

  /**
   * 计算自适应权重
   */
  getAdaptiveWeights(query: string): RetrievalWeights {
    const queryLower = query.toLowerCase();
    
    // 检测查询意图
    const isCodeRelated = /\b(function|class|method|variable|code|implement)\b/i.test(queryLower);
    const isTimeSensitive = /\b(recent|latest|new|today|yesterday)\b/i.test(queryLower);
    const hasEntities = /\b([A-Z][a-zA-Z]+)\b/.test(query); // 检测驼峰命名实体
    
    let k = 0.4; // 关键词权重
    let t = 0.3; // 时间权重
    let e = 0.2; // 实体权重
    let v = 0.1; // 向量权重（预留）

    if (isCodeRelated) {
      k = 0.5;
      e = 0.25;
      t = 0.15;
      v = 0.1;
    } else if (isTimeSensitive) {
      t = 0.5;
      k = 0.25;
      e = 0.15;
      v = 0.1;
    } else if (hasEntities) {
      e = 0.35;
      k = 0.35;
      t = 0.2;
      v = 0.1;
    }

    return { k, t, e, v };
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }
}
