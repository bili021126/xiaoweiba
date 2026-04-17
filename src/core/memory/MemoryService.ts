import { container } from 'tsyringe';
import { EpisodicMemory } from './EpisodicMemory';
import { EpisodicMemoryRecord } from './types';

/**
 * 记忆服务工具集 - Commands模块的统一记忆访问接口
 * 
 * 设计原则：
 * 1. 封装EpisodicMemory的底层API
 * 2. 提供简化的检索/记录接口
 * 3. 支持依赖注入（便于测试）
 */
export class MemoryService {
  private episodicMemory: EpisodicMemory;

  constructor(episodicMemory?: EpisodicMemory) {
    this.episodicMemory = episodicMemory || container.resolve(EpisodicMemory);
  }

  /**
   * 检索相关记忆（简化版）
   * @param query 查询文本（可选）
   * @param taskType 任务类型过滤（可选）
   * @param limit 返回数量限制
   * @returns 记忆列表
   */
  async searchMemories(
    query: string,
    taskType?: string,
    limit: number = 5
  ): Promise<EpisodicMemoryRecord[]> {
    try {
      if (query && query.trim().length > 0) {
        // 关键词搜索
        return await this.episodicMemory.search(query, { limit });
      } else if (taskType) {
        // 按任务类型检索
        return await this.episodicMemory.retrieve({
          taskType: taskType as any,
          limit
        });
      } else {
        // 默认检索最近记忆
        return await this.episodicMemory.retrieve({ limit });
      }
    } catch (error) {
      console.error('[MemoryService] Search failed:', error);
      return [];
    }
  }

  /**
   * 记录情景记忆
   * @param params 记忆参数
   * @returns 记忆ID
   */
  async recordMemory(params: {
    taskType: string;
    summary: string;
    entities: string[];
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    modelId: string;
    durationMs: number;
  }): Promise<string | null> {
    try {
      const recordId = await this.episodicMemory.record({
        taskType: params.taskType as any,
        summary: params.summary,
        entities: params.entities,
        outcome: params.outcome as any,
        modelId: params.modelId,
        durationMs: params.durationMs
      });

      return recordId;
    } catch (error) {
      console.error('[MemoryService] Record failed:', error);
      return null;
    }
  }

  /**
   * 获取最近记忆（按时间排序）
   * @param limit 数量限制
   * @param memoryTier 记忆层级（可选）
   * @returns 记忆列表
   */
  async getRecentMemories(limit: number = 10, memoryTier?: string): Promise<EpisodicMemoryRecord[]> {
    try {
      return await this.episodicMemory.retrieve({
        limit,
        memoryTier: memoryTier as any
      });
    } catch (error) {
      console.error('[MemoryService] Get recent memories failed:', error);
      return [];
    }
  }

  /**
   * 根据实体检索记忆
   * @param entity 实体名称（如函数名、类名）
   * @param limit 数量限制
   * @returns 记忆列表
   */
  async searchByEntity(entity: string, limit: number = 5): Promise<EpisodicMemoryRecord[]> {
    try {
      return await this.episodicMemory.search(entity, { limit });
    } catch (error) {
      console.error('[MemoryService] Search by entity failed:', error);
      return [];
    }
  }

  /**
   * 导出所有记忆（用于备份）
   * @returns 记忆数组
   */
  async exportAllMemories(): Promise<EpisodicMemoryRecord[]> {
    try {
      return await this.episodicMemory.retrieve({ limit: 1000 });
    } catch (error) {
      console.error('[MemoryService] Export failed:', error);
      return [];
    }
  }

  /**
   * 导入记忆（用于恢复）
   * @param memories 记忆数组
   * @returns 成功导入的数量
   */
  async importMemories(memories: Partial<EpisodicMemoryRecord>[]): Promise<number> {
    let successCount = 0;

    for (const memory of memories) {
      try {
        if (!memory.taskType || !memory.summary || !memory.outcome || !memory.modelId) {
          console.warn('[MemoryService] Skip invalid memory:', memory);
          continue;
        }

        await this.episodicMemory.record({
          taskType: memory.taskType as any,
          summary: memory.summary,
          entities: memory.entities || [],
          outcome: memory.outcome as any,
          modelId: memory.modelId,
          durationMs: memory.durationMs || 0
          // timestamp由系统自动设置
        });

        successCount++;
      } catch (error) {
        console.error('[MemoryService] Import single memory failed:', error);
      }
    }

    return successCount;
  }
}
