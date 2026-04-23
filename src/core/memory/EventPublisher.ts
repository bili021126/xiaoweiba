/**
 * 事件发布器 - 负责任务完成事件的发布
 * 
 * 职责：
 * 1. 发布TASK_COMPLETED事件（成功/失败）
 * 2. 携带memoryMetadata供MemoryRecorder使用
 * 
 * ✅ 修复 #33：完全迁移到 IEventBus + DomainEvent（移除向后兼容）
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus } from '../ports/IEventBus';
import { TaskCompletedEvent, TaskFailedEvent } from '../events/DomainEvent';
import { Intent } from '../domain/Intent';

@injectable()
export class EventPublisher {
  constructor(
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  /**
   * 发布任务完成事件（成功）
   * @param intent 意图对象
   * @param agentId Agent ID
   * @param result 执行结果
   * @param durationMs 执行耗时
   */
  publishTaskCompleted(
    intent: Intent,
    agentId: string,
    result: any,
    durationMs: number
  ): void {
    console.log(`[EventPublisher] Publishing TaskCompletedEvent for ${agentId}, duration: ${durationMs}ms`);
    this.eventBus.publish(new TaskCompletedEvent(intent, agentId, result, durationMs));
  }

  /**
   * 发布任务失败事件
   * @param intent 意图对象
   * @param agentId Agent ID
   * @param error 错误信息
   * @param durationMs 执行耗时
   */
  publishTaskFailed(
    intent: Intent,
    agentId: string,
    error: Error,
    durationMs: number
  ): void {
    console.log(`[EventPublisher] Publishing TaskFailedEvent for ${agentId}`);
    this.eventBus.publish(new TaskFailedEvent(intent, agentId, error, durationMs));
  }
}
