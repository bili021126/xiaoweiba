import { injectable } from 'tsyringe';
import { EpisodicMemoryRecord, RetrievalWeights } from './types';
import { IndexManager } from './IndexManager';

/**
 * 搜索引擎 - 负责记忆的检索和排序
 * 
 * 核心能力：
 * - TF-IDF关键词检索（纯内存倒排索引）
 * - 时间衰减加权（近因性优先）
 * - 实体匹配加分（函数名、类名等）
 * - 自适应权重计算（基于IntentAnalyzer）
 * - 混合评分与排序
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

    // 按分数降序排序
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
   * 计算自适应权重（增强版）
   * 
   * 根据查询意图动态调整检索策略：
   * - 代码相关查询 → 提高关键词和实体权重
   * - 时间敏感查询 → 提高时间衰减权重
   * - 实体明确查询 → 提高实体匹配权重
   * - 模糊语义查询 → 均衡权重
   */
  getAdaptiveWeights(query: string): RetrievalWeights {
    const queryLower = query.toLowerCase();
    
    // 检测查询意图
    const isCodeRelated = /\b(function|class|method|variable|code|implement|重构|优化|解释)\b/i.test(queryLower);
    const isTimeSensitive = /\b(recent|latest|new|today|yesterday|刚才|上次|最近)\b/i.test(queryLower);
    const hasEntities = /\b([A-Z][a-zA-Z]+|[\u4e00-\u9fa5]{2,}(?:函数|方法|类|表))\b/.test(query); // 驼峰命名或中文+类型词
    const isQuestion = /\b(怎么|为什么|什么|如何|哪里|哪个|how|why|what)\b/i.test(queryLower);
    
    let k = 0.30; // 关键词权重
    let t = 0.25; // 时间权重
    let e = 0.25; // 实体权重
    let v = 0.20; // 预留向量权重

    if (isCodeRelated && hasEntities) {
      // 代码+实体：强依赖关键词和实体
      k = 0.45;
      e = 0.35;
      t = 0.10;
      v = 0.10;
    } else if (isCodeRelated) {
      // 纯代码：侧重关键词
      k = 0.50;
      e = 0.20;
      t = 0.20;
      v = 0.10;
    } else if (isTimeSensitive) {
      // 时间敏感：侧重近期记忆
      t = 0.55;
      k = 0.20;
      e = 0.15;
      v = 0.10;
    } else if (hasEntities) {
      // 实体明确：侧重精确匹配
      e = 0.45;
      k = 0.30;
      t = 0.15;
      v = 0.10;
    } else if (isQuestion) {
      // 问句：均衡权重，侧重语义
      k = 0.25;
      t = 0.25;
      e = 0.25;
      v = 0.25;
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
