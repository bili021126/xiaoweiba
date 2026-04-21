/**
 * 查询执行器 - 负责处理所有底层数据检索逻辑
 * 
 * 设计原则：单一职责
 * - EpisodicMemory 不应该知道 SQL 怎么写，也不应该知道权重怎么算
 */

import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { EpisodicMemoryRecord, MemoryQueryOptions } from '../memory/types';
import { EmbeddingService } from './EmbeddingService';
import { VectorEngine } from './VectorEngine';

@injectable()
export class QueryExecutor {
  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(EmbeddingService) private embeddingService: EmbeddingService,
    @inject(VectorEngine) private vectorEngine: VectorEngine
  ) {}

  /**
   * 执行关键词检索 (LIKE)，并使用向量进行重排序
   */
  async searchByKeywords(
    query: string,
    options: { limit?: number; offset?: number }
  ): Promise<EpisodicMemoryRecord[]> {
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const db = this.dbManager.getDatabase();

    // 1. 关键词召回（扩大召回量，为重排留出空间）
    const recallLimit = Math.min(limit * 3, 50);
    const sql = `SELECT * FROM episodic_memory WHERE summary LIKE ? LIMIT ? OFFSET ?`;
    const stmt = db.prepare(sql);
    stmt.bind([`%${query}%`, recallLimit, offset]);

    const candidates: EpisodicMemoryRecord[] = [];
    while (stmt.step()) {
      candidates.push(this.mapRowToRecord(stmt.getAsObject()));
    }
    stmt.free();

    // 2. 如果启用向量检索，进行重排序
    if (this.embeddingService.isEnabled() && candidates.length > 0) {
      const queryVector = await this.embeddingService.embed(query);
      if (queryVector.length > 0) {
        const reranked = this.vectorEngine.topKSimilarity(
          queryVector,
          candidates,
          (item) => {
            // 从记录中提取向量（如果已存储）
            if (item.vector) {
              return Array.from(new Float32Array((item.vector as any).buffer));
            }
            // 如果没有向量，尝试即时生成（注意性能）
            const text = `${item.summary} ${item.entities?.join(' ') || ''}`;
            // 这里应避免阻塞，最好提前确保向量已存在。暂返回null跳过。
            return null;
          },
          limit
        );
        return reranked;
      }
    }

    return candidates.slice(0, limit);
  }

  /**
   * 执行向量语义检索（L2 核心逻辑）
   */
  async searchByVector(query: string, options: MemoryQueryOptions): Promise<EpisodicMemoryRecord[]> {
    if (!this.embeddingService.isEnabled()) {
      return this.searchByKeywords(query, { limit: options.limit, offset: options.offset });
    }

    // 1. 将查询文本向量化
    const queryVector = await this.embeddingService.embed(query);
    if (queryVector.length === 0) return [];

    // 2. 获取候选记忆集（先从 DB 捞出一批）
    const candidates = await this.getRecentMemories(options.limit ? options.limit * 3 : 60);

    // 3. 使用 VectorEngine 进行重排序
    return this.vectorEngine.topKSimilarity(
      queryVector,
      candidates,
      (item) => {
        if (item.vector) {
          return Array.from(new Float32Array((item.vector as any).buffer));
        }
        return null;
      },
      options.limit || 10
    );
  }

  /**
   * 获取最近的记忆
   */
  async getRecentMemories(limit: number): Promise<EpisodicMemoryRecord[]> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare('SELECT * FROM episodic_memory ORDER BY timestamp DESC LIMIT ?');
    stmt.bind([limit]);
    
    const results: EpisodicMemoryRecord[] = [];
    while (stmt.step()) {
      results.push(this.mapRowToRecord(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  private mapRowToRecord(row: any): EpisodicMemoryRecord {
    return {
      id: row.id,
      projectFingerprint: row.project_fingerprint,
      timestamp: row.timestamp,
      taskType: row.task_type,
      summary: row.summary,
      entities: JSON.parse(row.entities || '[]'),
      decision: row.decision,
      outcome: row.outcome,
      finalWeight: row.final_weight,
      modelId: row.model_id,
      durationMs: row.duration_ms,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      vector: row.vector,
      memoryTier: row.memory_tier
    };
  }
}
