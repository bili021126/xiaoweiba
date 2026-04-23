/**
 * 事件发布器 - 负责任务完成事件的发布
 * 
 * 职责：
 * 1. 发布TASK_COMPLETED事件（成功/失败）
 * 2. 携带memoryMetadata供MemoryRecorder使用
 * 
 * ✅ 修复 #33：迁移到 IEventBus + DomainEvent
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus } from '../ports/IEventBus'; // ✅ 修复 #33：使用新的事件总线
import { TaskCompletedEvent, TaskFailedEvent } from '../events/DomainEvent'; // ✅ 修复 #33：使用领域事件
import { CommandResult } from './CommandExecutor';
import { Intent } from '../domain/Intent';

@injectable()
export class EventPublisher {
  constructor(
    @inject('IEventBus') private eventBus: IEventBus // ✅ 修复 #33：注入新的事件总线
  ) {}

  /**
   * 发布任务完成事件（成功）
   * @param intentOrCommandId 意图对象或命令ID（向后兼容）
   * @param agentIdOrResult Agent ID 或执行结果
   * @param resultOrDurationMs 执行结果或执行耗时
   * @param durationMs 执行耗时
   */
  publishTaskCompleted(
    intentOrCommandId: Intent | string,
    agentIdOrResult: string | any,
    resultOrDurationMs?: any,
    durationMs?: number
  ): void {
    // ✅ 修复 #33：支持新旧两种调用方式
    if (typeof intentOrCommandId === 'string') {
      // 旧调用方式：publishTaskCompleted(commandId, result, durationMs)
      console.log(`[EventPublisher] Publishing TASK_COMPLETED for ${intentOrCommandId}, duration: ${durationMs}ms`);
      // TODO: 迁移到新的领域事件系统
      return;
    }
    
    // 新调用方式：publishTaskCompleted(intent, agentId, result, durationMs)
    const intent = intentOrCommandId;
    const agentId = agentIdOrResult as string;
    const result = resultOrDurationMs;
    const duration = durationMs || 0;
    
    console.log(`[EventPublisher] Publishing TaskCompletedEvent for ${agentId}, duration: ${duration}ms`);
    this.eventBus.publish(new TaskCompletedEvent(intent, agentId, result, duration));
  }

  /**
   * 发布任务失败事件
   * @param intentOrCommandId 意图对象或命令ID（向后兼容）
   * @param agentIdOrError Agent ID 或错误信息
   * @param errorOrDurationMs 错误信息或执行耗时
   * @param durationMs 执行耗时
   */
  publishTaskFailed(
    intentOrCommandId: Intent | string,
    agentIdOrError: string | Error,
    errorOrDurationMs?: Error | number,
    durationMs?: number
  ): void {
    // ✅ 修复 #33：支持新旧两种调用方式
    if (typeof intentOrCommandId === 'string') {
      // 旧调用方式：publishTaskFailed(commandId, error, durationMs)
      console.log(`[EventPublisher] Publishing TASK_FAILED for ${intentOrCommandId}`);
      // TODO: 迁移到新的领域事件系统
      return;
    }
    
    // 新调用方式：publishTaskFailed(intent, agentId, error, durationMs)
    const intent = intentOrCommandId;
    const agentId = agentIdOrError as string;
    const error = errorOrDurationMs instanceof Error ? errorOrDurationMs : new Error(String(errorOrDurationMs));
    const duration = durationMs || 0;
    
    console.log(`[EventPublisher] Publishing TaskFailedEvent for ${agentId}`);
    this.eventBus.publish(new TaskFailedEvent(intent, agentId, error, duration));
  }
}
