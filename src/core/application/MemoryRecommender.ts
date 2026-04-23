/**
 * 记忆推荐器 - 负责基于文件路径推荐相关记忆
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道推荐算法的细节
 * - 所有推荐逻辑集中在此
 */

import { injectable, inject } from 'tsyringe';
import { EpisodicMemory } from '../memory/EpisodicMemory';
import { Recommendation } from '../ports/IMemoryPort';
import { PathUtils } from '../../utils/ProjectFingerprint'; // ✅ 修复 #39：使用统一路径工具

@injectable()
export class MemoryRecommender {
  constructor(
    @inject(EpisodicMemory) private episodicMemory: EpisodicMemory
  ) {}

  /**
   * 根据文件路径推荐相关历史记忆
   */
  async recommendForFile(filePath: string): Promise<Recommendation[]> {
    try {
      // ✅ 修复 #39：使用统一的路径工具函数
      const fileName = PathUtils.getFileName(filePath);
      
      // 搜索与该文件相关的记忆
      const memories = await this.episodicMemory.search(fileName, {
        limit: 5
      });

      return memories.map((m: any) => ({
        title: m.summary || `关于 ${fileName} 的记忆`,
        timestamp: m.timestamp || Date.now(),
        memoryId: m.id
      }));
    } catch (error) {
      console.error('[MemoryRecommender] recommendForFile failed:', error);
      return [];
    }
  }
}
