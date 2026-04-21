/**
 * 索引同步服务 - 负责从数据库同步数据到内存索引
 * 
 * 设计原则：单一职责
 * - EpisodicMemory 不应该知道如何从 DB 捞数据来建索引
 */

import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { ProjectFingerprint } from '../../utils/ProjectFingerprint';
import { IndexManager } from '../memory/IndexManager';
import { QueryExecutor } from './QueryExecutor';

@injectable()
export class IndexSyncService {
  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(ProjectFingerprint) private projectFingerprint: ProjectFingerprint,
    @inject(IndexManager) private indexManager: IndexManager,
    @inject(QueryExecutor) private queryExecutor: QueryExecutor
  ) {}

  /**
   * 从数据库加载记忆并重建索引
   */
  async rebuildIndex(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      if (!projectFingerprint) return;

      // 委托给 QueryExecutor 获取原始数据（这里为了性能直接查 DB）
      const memories = await this.queryExecutor.getRecentMemories(2000);
      
      // 委托给 IndexManager 构建倒排索引
      this.indexManager.buildIndex(memories, 2000);
      
      const duration = Date.now() - startTime;
      console.log(`[IndexSyncService] Index rebuilt: ${memories.length} memories in ${duration}ms`);
    } catch (error) {
      console.error('[IndexSyncService] Failed to rebuild index:', error);
      throw error;
    }
  }
}
