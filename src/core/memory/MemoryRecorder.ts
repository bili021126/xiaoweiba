/**
 * 记忆记录器 - 负责任务完成的记忆记录
 * 
 * 职责：
 * 1. 记录任务完成事件到情景记忆
 * 2. 提取代码实体（函数名、类名等）
 * 3. 发布记忆记录事件
 */

import { EventBus, CoreEventType } from '../eventbus/EventBus';
import { EpisodicMemory } from './EpisodicMemory';
import { TaskType } from './types';

export interface TaskCompletionData {
  actionId: string;
  result: {
    success: boolean;
    modelId?: string;
    [key: string]: any;
  };
  durationMs?: number;
  memoryMetadata?: {
    taskType: string;
    summary: string;
    entities: string[];
  };
}

export class MemoryRecorder {
  constructor(
    private episodicMemory: EpisodicMemory,
    private eventBus: EventBus
  ) {}

  /**
   * 记录任务完成
   * @param data 任务完成数据
   */
  async recordTaskCompletion(data: TaskCompletionData): Promise<void> {
    // 防御性检查：如果data为undefined，直接返回
    if (!data) {
      console.warn('[MemoryRecorder] recordTaskCompletion called with undefined data, skipping');
      return;
    }
    
    const { actionId, result, durationMs, memoryMetadata } = data;
    
    console.log(`[MemoryRecorder] Recording task completion for: ${actionId}`, {
      result,
      durationMs,
      hasMetadata: !!memoryMetadata
    });
    
    try {
      // ✅ 如果 Command 提供了元数据，直接使用
      if (memoryMetadata) {
        console.log('[MemoryRecorder] Using memoryMetadata from Command');
        const memoryId = await this.episodicMemory.record({
          taskType: memoryMetadata.taskType as TaskType,
          summary: memoryMetadata.summary,
          entities: memoryMetadata.entities,
          outcome: result?.success ? 'SUCCESS' : 'FAILED',
          modelId: result?.modelId || 'deepseek',
          durationMs: durationMs || 0
        });
        
        console.log(`[MemoryRecorder] Memory recorded with ID: ${memoryId}`);
        
        // 发布情景记忆新增事件
        this.eventBus.publish(CoreEventType.MEMORY_RECORDED, {
          memoryId,
          taskType: memoryMetadata.taskType
        }, { source: 'MemoryRecorder' });
        return;
      }

      // 降级：对于没有提供元数据的命令，使用简单逻辑或不记录
      console.log(`[MemoryRecorder] No memoryMetadata for action: ${actionId}, skipping episodic record`);
    } catch (error) {
      console.error('[MemoryRecorder] Failed to record task completion:', error);
      throw error;
    }
  }

  /**
   * 从代码中提取实体（函数名、类名等）
   * @param code 代码字符串
   * @returns 实体列表
   */
  extractEntities(code: string): string[] {
    const entities: string[] = [];
    
    // 提取函数名
    const functionRegex = /function\s+(\w+)/g;
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      if (match[1]) entities.push(match[1]);
    }
    
    // 提取类名
    const classRegex = /class\s+(\w+)/g;
    while ((match = classRegex.exec(code)) !== null) {
      if (match[1]) entities.push(match[1]);
    }
    
    return [...new Set(entities)]; // 去重
  }
}
