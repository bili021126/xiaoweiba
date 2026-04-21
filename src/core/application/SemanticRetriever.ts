/**
 * 语义检索器 - 负责执行混合检索与排序
 * 
 * 设计原则：委托而非塞入
 * - EpisodicMemory 不应该知道如何计算余弦相似度或 Jaccard 分数
 */

import { injectable, inject } from 'tsyringe';
import { EmbeddingService } from './EmbeddingService';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { EpisodicMemoryRecord, MemoryQueryOptions } from '../memory/types';
import { IntentAnalyzer } from '../memory/IntentAnalyzer';
import { SearchEngine } from '../memory/SearchEngine';

@injectable()
export class SemanticRetriever {
  constructor(
    @inject(EmbeddingService) private embeddingService: EmbeddingService,
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(IntentAnalyzer) private intentAnalyzer: IntentAnalyzer,
    @inject(SearchEngine) private searchEngine: SearchEngine
  ) {}

  /**
   * 执行语义检索（L2 核心逻辑）
   */
  async search(query: string, options?: MemoryQueryOptions): Promise<any[]> {
    // 1. 分析查询意图
    const intentVector = this.intentAnalyzer.analyze(query);

    // 2. 使用 SearchEngine 进行多维度评分
    // 注意：这里我们暂时复用现有的 SearchEngine，后续可以进一步将向量相似度逻辑移入此处
    const results = await this.searchEngine.rankAndRetrieve(new Set(), [], query, { ...options, intentVector });

    return results;
  }
}
