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
    if (this.embeddingService.isEnabled()) {
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
   * 加权融合两组结果
   */
  private fuseResults(
    keywordResults: EpisodicMemoryRecord[],
    semanticResults: EpisodicMemoryRecord[],
    vectorWeight: number,
    keywordWeight: number,
    limit: number
  ): EpisodicMemoryRecord[] {
    const scoreMap = new Map<string, { record: EpisodicMemoryRecord; score: number }>();

    // 关键词结果赋予权重分（假设按原始排序给分，位置越前分数越高）
    keywordResults.forEach((record, index) => {
      const positionScore = 1 - index / keywordResults.length;
      scoreMap.set(record.id, {
        record,
        score: positionScore * keywordWeight
      });
    });

    // 语义结果赋予权重分
    semanticResults.forEach((record, index) => {
      const positionScore = 1 - index / semanticResults.length;
      const existing = scoreMap.get(record.id);
      if (existing) {
        existing.score += positionScore * vectorWeight;
      } else {
        scoreMap.set(record.id, {
          record,
          score: positionScore * vectorWeight
        });
      }
    });

    // 按总分排序返回
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.record);
  }
}
