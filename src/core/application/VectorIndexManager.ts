/**
 * 向量索引管理器 - 负责向量化与索引维护
 * 
 * 设计原则：单一职责
 * - 专注于将文本转化为向量并管理索引
 * - EpisodicMemory 只需要调用它，不需要知道向量是怎么算出来的
 */

import { injectable, inject } from 'tsyringe';
import { EmbeddingService } from './EmbeddingService';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { EpisodicMemoryRecord } from '../memory/types';

@injectable()
export class VectorIndexManager {
  constructor(
    @inject(EmbeddingService) private embeddingService: EmbeddingService,
    @inject(DatabaseManager) private dbManager: DatabaseManager
  ) {}

  /**
   * 异步更新索引（不阻塞主流程）
   */
  async updateIndexAsync(id: string, memory: Partial<EpisodicMemoryRecord>): Promise<void> {
    if (!this.embeddingService.isEnabled()) return;

    try {
      const indexText = this.buildIndexText(memory);
      const vector = await this.embeddingService.embed(indexText);
      
      // 将向量存入数据库 BLOB 字段
      if (vector.length > 0) {
        const buffer = Buffer.from(new Float32Array(vector).buffer);
        this.dbManager.run(
          'UPDATE episodic_memory SET vector = ? WHERE id = ?',
          [buffer, id]
        );
      }
    } catch (error) {
      console.error('[VectorIndexManager] Failed to update index for:', id, error);
    }
  }

  /**
   * 构建用于向量化的索引文本
   */
  private buildIndexText(memory: Partial<EpisodicMemoryRecord>): string {
    return `${memory.summary || ''} ${memory.decision || ''} ${(memory.entities || []).join(' ')}`;
  }

  /**
   * 获取记忆的向量
   */
  async getVector(id: string): Promise<number[]> {
    const db = this.dbManager.getDatabase();
    const stmt = db.prepare('SELECT vector FROM episodic_memory WHERE id = ?');
    stmt.bind([id]);
    
    let vectorData: Uint8Array | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { vector: Uint8Array };
      if (row.vector) {
        vectorData = row.vector;
      }
    }
    stmt.free();

    if (!vectorData) return [];
    // ✅ 正确转换：Uint8Array -> Float32Array -> number[]
    return Array.from(new Float32Array(vectorData.buffer, vectorData.byteOffset, vectorData.byteLength / 4));
  }
}
