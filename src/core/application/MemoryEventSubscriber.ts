/**
 * 记忆事件订阅器 - 负责订阅领域事件并自动记录记忆
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道事件处理的细节
 * - 所有事件订阅和处理逻辑集中在此
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus } from '../ports/IEventBus';
import { TaskCompletedEvent, FeedbackGivenEvent } from '../events/DomainEvent';
import { Intent } from '../domain/Intent';

export interface TaskCompletionPayload {
  intent: Intent;
  agentId: string;
  result: any;
  durationMs: number;
  modelId?: string;
  memoryMetadata?: Record<string, any>;
}

@injectable()
export class MemoryEventSubscriber {
  private unsubscribe?: () => void;

  constructor(
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  /**
   * 订阅任务完成事件
   * @param onTaskCompleted 回调函数
   */
  subscribeToTaskCompletion(onTaskCompleted: (payload: TaskCompletionPayload) => Promise<void>): void {
    this.unsubscribe = this.eventBus.subscribe(
      TaskCompletedEvent.type,
      async (event: any) => {
        // ✅ 修复：从payload中提取数据（DomainEvent结构）
        const payload = event?.payload || event;
        
        // ✅ 防御性检查：确保payload有必要的属性
        if (!payload || !payload.intent || !payload.agentId) {
          console.warn('[MemoryEventSubscriber] Invalid TaskCompletedEvent payload, skipping');
          return;
        }
        
        // ✅ 构造TaskCompletedEvent兼容对象
        const taskEvent: TaskCompletionPayload = {
          intent: payload.intent,
          agentId: payload.agentId,
          result: payload.result,
          durationMs: payload.durationMs,
          modelId: payload.modelId,
          memoryMetadata: payload.memoryMetadata
        };
        
        // ✅ 修复 #10：添加错误处理，防止静默失败
        try {
          await onTaskCompleted(taskEvent);
        } catch (error) {
          console.error('[MemoryEventSubscriber] onTaskCompleted failed:', error);
        }
      }
    );

    console.log('[MemoryEventSubscriber] Subscribed to TaskCompletedEvent');
  }

  /**
   * 取消订阅
   */
  unsubscribeFromEvents(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      console.log('[MemoryEventSubscriber] Unsubscribed from events');
      this.unsubscribe = undefined;
    }
  }
}
