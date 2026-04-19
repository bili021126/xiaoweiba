/**
 * 事件发布器 - 负责任务完成事件的发布
 * 
 * 职责：
 * 1. 发布TASK_COMPLETED事件（成功/失败）
 * 2. 携带memoryMetadata供MemoryRecorder使用
 */

import { EventBus, CoreEventType } from '../eventbus/EventBus';
import { CommandResult } from './CommandExecutor';

export class EventPublisher {
  constructor(
    private eventBus: EventBus
  ) {}

  /**
   * 发布任务完成事件（成功）
   * @param commandId 命令ID
   * @param result 执行结果
   * @param durationMs 执行耗时
   */
  publishTaskCompleted(
    commandId: string,
    result: CommandResult,
    durationMs: number
  ): void {
    console.log(`[EventPublisher] Publishing TASK_COMPLETED for ${commandId}, duration: ${durationMs}ms`);
    
    this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
      actionId: commandId,
      result: {
        success: result.success,
        data: result.data,
        error: result.error
      },
      durationMs,
      memoryMetadata: result.memoryMetadata  // ✅ 传递元数据
    }, { source: commandId });
  }

  /**
   * 发布任务失败事件
   * @param commandId 命令ID
   * @param error 错误信息
   * @param durationMs 执行耗时
   */
  publishTaskFailed(
    commandId: string,
    error: Error | string,
    durationMs: number
  ): void {
    console.log(`[EventPublisher] Publishing TASK_FAILED for ${commandId}`);
    
    this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
      actionId: commandId,
      result: {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      durationMs
      // 失败时不记录记忆元数据
    }, { source: commandId });
  }
}
