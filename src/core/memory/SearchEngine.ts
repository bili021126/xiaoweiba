/**
 * 搜索引擎 - 负责记忆的搜索、评分和排序
 * 
 * 职责：
 * 1. 语义相似度计算
 * 2. 时间衰减评分
 * 3. 实体匹配评分
 * 4. 综合排序
 */

import { EpisodicMemoryRecord, MemoryQueryOptions } from './types';

export interface SearchResult {
  memory: EpisodicMemoryRecord;
  score: number;
}

export class SearchEngine {
  /**
   * 对候选记忆进行评分和排序
   * @param candidateIds 候选记忆ID集合
   * @param allMemories 所有记忆记录
   * @param query 查询文本
   * @param options 查询选项
   * @returns 排序后的记忆列表
   */
  rankAndRetrieve(
    candidateIds: Set<string>,
    allMemories: EpisodicMemoryRecord[],
    query: string,
    options: MemoryQueryOptions = {}
  ): EpisodicMemoryRecord[] {
    // 过滤出候选记忆
    const candidates = allMemories.filter(m => candidateIds.has(m.id));
    
    if (candidates.length === 0) {
      // 无候选，返回最近的记忆
      return this.getRecentMemories(allMemories, options.limit || 5);
    }
    
    // 计算每个候选的得分
    const scoredResults: SearchResult[] = candidates.map(memory => ({
      memory,
      score: this.calculateScore(memory, query, options)
    }));
    
    // 按得分降序排序
    scoredResults.sort((a, b) => b.score - a.score);
    
    // 返回前N个
    const limit = options.limit || 5;
    return scoredResults.slice(0, limit).map(r => r.memory);
  }

  /**
   * 计算记忆得分
   * @param memory 记忆记录
   * @param query 查询文本
   * @param options 查询选项
   * @returns 综合得分（0-1）
   */
  private calculateScore(
    memory: EpisodicMemoryRecord,
    query: string,
    options: MemoryQueryOptions
  ): number {
    // 1. 语义相似度（基于词项重叠）
    const semanticScore = this.calculateSemanticScore(memory, query);
    
    // 2. 时间衰减
    const temporalScore = this.calculateTemporalScore(memory.timestamp);
    
    // 3. 实体匹配
    const entityScore = this.calculateEntityScore(memory, query);
    
    // 4. 基础权重
    const baseWeight = memory.finalWeight || 5.0;
    
    // 自适应权重（根据查询意图调整）
    const weights = this.getAdaptiveWeights(query, memory.timestamp);
    
    // 综合得分
    const score = 
      weights.k * semanticScore +
      weights.t * temporalScore +
      weights.e * entityScore +
      weights.v * (baseWeight / 10.0);  // 归一化到0-1
    
    return Math.min(score, 1.0);
  }

  /**
   * 计算语义相似度（词项重叠率）
   */
  private calculateSemanticScore(memory: EpisodicMemoryRecord, query: string): number {
    const queryTerms = new Set(this.tokenize(query));
    const memoryTerms = new Set(this.tokenize(memory.summary));
    
    if (queryTerms.size === 0 || memoryTerms.size === 0) {
      return 0;
    }
    
    // 计算交集
    let intersection = 0;
    for (const term of queryTerms) {
      if (memoryTerms.has(term)) {
        intersection++;
      }
    }
    
    // Jaccard相似度
    const union = queryTerms.size + memoryTerms.size - intersection;
    return intersection / union;
  }

  /**
   * 计算时间衰减得分
   */
  private calculateTemporalScore(timestamp: number): number {
    const now = Date.now();
    const ageHours = (now - timestamp) / (1000 * 60 * 60);
    
    // 指数衰减：最近1小时=1.0, 24小时=0.5, 7天=0.1
    return Math.exp(-ageHours / 24);
  }

  /**
   * 计算实体匹配得分
   */
  private calculateEntityScore(memory: EpisodicMemoryRecord, query: string): number {
    if (!memory.entities || memory.entities.length === 0) {
      return 0;
    }
    
    const queryLower = query.toLowerCase();
    let matchCount = 0;
    
    for (const entity of memory.entities) {
      if (queryLower.includes(entity.toLowerCase())) {
        matchCount++;
      }
    }
    
    return matchCount / memory.entities.length;
  }

  /**
   * 获取自适应权重
   */
  private getAdaptiveWeights(query: string, memoryTimestamp: number): {
    k: number;  // 语义权重
    t: number;  // 时间权重
    e: number;  // 实体权重
    v: number;  // 基础权重
  } {
    const queryLower = query.toLowerCase();
    
    // 检测查询意图
    const isCodeQuery = /代码|函数|类|方法|变量/i.test(queryLower);
    const isRecentQuery = /刚才|最近|今天/i.test(queryLower);
    const isEntityQuery = /\b(src|lib|test|\.ts|\.js|\.vue)\b/i.test(queryLower);
    
    // 计算时间距离因子
    const hoursSince = (Date.now() - memoryTimestamp) / (1000 * 60 * 60);
    const isDistantTemporal = hoursSince > 24;
    
    if (isCodeQuery) {
      // 代码查询：重视语义和实体
      return { k: 0.4, t: 0.2, e: 0.3, v: 0.1 };
    } else if (isRecentQuery) {
      // 近期查询：重视时间
      return { k: 0.2, t: 0.5, e: 0.1, v: 0.2 };
    } else if (isEntityQuery) {
      // 实体查询：重视实体匹配
      return { k: 0.2, t: 0.2, e: 0.5, v: 0.1 };
    } else if (isDistantTemporal) {
      // 久远记忆：平衡权重
      return { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
    } else {
      // 默认：平衡权重
      return { k: 0.3, t: 0.3, e: 0.2, v: 0.2 };
    }
  }

  /**
   * 获取最近的记忆（降级策略）
   */
  private getRecentMemories(memories: EpisodicMemoryRecord[], limit: number): EpisodicMemoryRecord[] {
    return memories
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    
    return text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }
}
