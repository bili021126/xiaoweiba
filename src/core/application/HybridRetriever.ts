/**
 * 混合检索器 - 负责协调关键词检索与语义检索
 * 
 * 设计原则：委托而非塞入
 * - EpisodicMemory 只负责提供原始数据，检索策略由 HybridRetriever 决定
 */

import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { QueryExecutor } from './QueryExecutor';
import { EmbeddingService } from './EmbeddingService';
import { VectorEngine } from './VectorEngine';
import { EpisodicMemoryRecord } from '../memory/types';

@injectable()
export class HybridRetriever {
  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(QueryExecutor) private queryExecutor: QueryExecutor,
    @inject(EmbeddingService) private embeddingService: EmbeddingService,
    @inject(VectorEngine) private vectorEngine: VectorEngine
  ) {}

  /**
   * 混合检索主入口
   */
  async search(
    query: string,
    options?: { limit?: number; vectorWeight?: number; keywordWeight?: number }
  ): Promise<EpisodicMemoryRecord[]> {
    const limit = options?.limit || 10;
    const vectorWeight = options?.vectorWeight ?? 0.7;
    const keywordWeight = options?.keywordWeight ?? 0.3;

    // 1. 关键词检索（已包含向量重排）
    const keywordResults = await this.queryExecutor.searchByKeywords(query, {
      limit: limit * 2,
      offset: 0
    });

    // 2. 纯语义检索（可选，如果关键词召回不足或需要补充）
    let semanticResults: EpisodicMemoryRecord[] = [];
    if (this.embeddingService.isModelAvailable()) { // ✅ 修复：检查模型是否可用，而非仅检查 enabled
      const queryVector = await this.embeddingService.embed(query);
      if (queryVector.length > 0) {
        // 获取近期记忆作为候选池（或使用全量，性能考虑用近期）
        const recentMemories = await this.queryExecutor.getRecentMemories(100);
        semanticResults = this.vectorEngine.topKSimilarity(
          queryVector,
          recentMemories,
          (item) => {
            if (item.vector) {
              return Array.from(new Float32Array((item.vector as any).buffer));
            }
            return null;
          },
          limit * 2
        );
      }
    } else if (this.embeddingService.isEnabled()) {
      // ✅ 新增：enabled 但模型未加载时，记录日志（已通知用户）
      console.log('[HybridRetriever] Vector model not available, falling back to keyword-only search');
    }

    // 3. 结果融合（使用加权分数合并）
    const fused = this.fuseResults(
      keywordResults,
      semanticResults,
      vectorWeight,
      keywordWeight,
      limit
    );

    return fused;
  }

  /**
   * ✅ 550B: 加权融合两组结果，应用四因子权重
   */
  private fuseResults(
    keywordResults: EpisodicMemoryRecord[],
    semanticResults: EpisodicMemoryRecord[],
    vectorWeight: number,
    keywordWeight: number,
    limit: number
  ): EpisodicMemoryRecord[] {
    const scoreMap = new Map<string, { record: EpisodicMemoryRecord; score: number }>();

    // 1. 关键词匹配分数
    keywordResults.forEach((record, index) => {
      const keywordScore = 1 - index / keywordResults.length;
      // 计算时间衰减（假设越近分数越高）
      const recencyScore = Math.max(0, 1 - (Date.now() - record.timestamp) / (1000 * 60 * 60 * 24 * 30)); 
      
      const totalScore = this.vectorEngine.calculateHybridScore(
        0, // 关键词检索不直接提供向量分，除非重排
        keywordScore,
        recencyScore,
        0, // 实体匹配暂定为 0
        { vector: vectorWeight, keyword: keywordWeight, recency: 0.2, entity: 0.1 }
      );

      scoreMap.set(record.id, { record, score: totalScore });
    });

    // 2. 语义向量分数
    semanticResults.forEach((record, index) => {
      const vectorScore = 1 - index / semanticResults.length;
      const existing = scoreMap.get(record.id);
      
      if (existing) {
        // 如果已存在，累加向量权重
        existing.score += vectorScore * vectorWeight;
      } else {
        const recencyScore = Math.max(0, 1 - (Date.now() - record.timestamp) / (1000 * 60 * 60 * 24 * 30));
        const totalScore = this.vectorEngine.calculateHybridScore(
          vectorScore,
          0,
          recencyScore,
          0,
          { vector: vectorWeight, keyword: keywordWeight, recency: 0.2, entity: 0.1 }
        );
        scoreMap.set(record.id, { record, score: totalScore });
      }
    });

    // 3. 按总分排序返回
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.record);
  }
}
