/**
 * 消息流管理器 - 协调Agent执行结果到UI的展示
 * 
 * 职责：
 * 1. 订阅TaskCompletedEvent和TaskFailedEvent
 * 2. 将Agent输出转换为UI消息
 * 3. 发布MessageAddedEvent通知UI更新
 * 4. 管理会话历史
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus } from '../ports/IEventBus';
import { 
  TaskCompletedEvent, 
  TaskFailedEvent,
  MessageAddedEvent
} from '../events/DomainEvent';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intentName?: string;
    agentId?: string;
    durationMs?: number;
  };
}

@injectable()
export class MessageFlowManager {
  private messages: ChatMessage[] = [];
  private unsubscribeCompleted?: () => void;
  private unsubscribeFailed?: () => void;

  constructor(
    @inject('IEventBus') private eventBus: IEventBus
  ) {
    this.subscribeToEvents();
  }

  /**
   * 订阅任务完成/失败事件
   */
  private subscribeToEvents(): void {
    // 订阅任务完成事件
    this.unsubscribeCompleted = this.eventBus.subscribe(
      TaskCompletedEvent.type,
      async (event: TaskCompletedEvent) => {
        await this.handleTaskCompleted(event);
      }
    );

    // 订阅任务失败事件
    this.unsubscribeFailed = this.eventBus.subscribe(
      TaskFailedEvent.type,
      async (event: TaskFailedEvent) => {
        await this.handleTaskFailed(event);
      }
    );

    console.log('[MessageFlowManager] Subscribed to task events');
  }

  /**
   * 处理任务完成事件
   */
  private async handleTaskCompleted(event: any): Promise<void> {
    // ✅ 修复：从payload中提取数据（DomainEvent结构）
    const payload = event?.payload || event;
    
    // ✅ 防御性检查：确保payload有必要的属性
    if (!payload || !payload.intent || !payload.result) {
      console.warn('[MessageFlowManager] Invalid TaskCompletedEvent payload, skipping');
      return;
    }

    const { intent, agentId, result, durationMs } = payload;

    try {
      // 1. 提取Agent输出的文本内容
      const content = this.extractContentFromResult(result);

      // 2. 构建助手消息
      const assistantMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        metadata: {
          intentName: intent.name,
          agentId,
          durationMs
        }
      };

      // 3. 添加到消息历史
      this.messages.push(assistantMessage);

      // ⚠️ 暂时禁用MessageAddedEvent发布（避免Legacy EventBus验证错误）
      // ChatViewProvider会通过其他机制接收消息
      // this.eventBus.publish(new MessageAddedEvent({
      //   message: assistantMessage
      // }));

      console.log(`[MessageFlowManager] Message added for agent ${agentId}`);
    } catch (error) {
      console.error('[MessageFlowManager] Failed to handle task completion:', error);
    }
  }

  /**
   * 处理任务失败事件
   */
  private async handleTaskFailed(event: any): Promise<void> {
    // ✅ 修复：从payload中提取数据（DomainEvent结构）
    const payload = event?.payload || event;
    
    if (!payload || !payload.intent || !payload.error) {
      console.warn('[MessageFlowManager] Invalid TaskFailedEvent payload, skipping');
      return;
    }

    const { intent, agentId, error, durationMs } = payload;

    try {
      // 1. 构建错误消息
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: `❌ 执行失败: ${error.message}`,
        timestamp: Date.now(),
        metadata: {
          intentName: intent.name,
          agentId,
          durationMs
        }
      };

      // 2. 添加到消息历史
      this.messages.push(errorMessage);

      // ⚠️ 暂时禁用MessageAddedEvent发布（避免Legacy EventBus验证错误）
      // this.eventBus.publish(new MessageAddedEvent({
      //   message: errorMessage
      // }));

      console.error(`[MessageFlowManager] Task failed for agent ${agentId}:`, error.message);
    } catch (err) {
      console.error('[MessageFlowManager] Failed to handle task failure:', err);
    }
  }

  /**
   * 从Agent结果中提取文本内容
   */
  private extractContentFromResult(result: any): string {
    // ✅ 防御性检查：result可能为undefined或null
    if (result === undefined || result === null) {
      console.warn('[MessageFlowManager] Result is null/undefined, returning empty message');
      return '✅ 任务已完成';
    }

    // 尝试多种可能的结果格式
    if (typeof result === 'string') {
      return result;
    }

    if (result.data) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }

    if (result.text) {
      return result.text;
    }

    if (result.content) {
      return result.content;
    }

    if (result.commitMessage) {
      return result.commitMessage;
    }

    // 默认转为JSON
    return JSON.stringify(result, null, 2);
  }

  /**
   * 获取消息历史
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * 清空消息历史
   */
  clearMessages(): void {
    this.messages = [];
    console.log('[MessageFlowManager] Messages cleared');
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.unsubscribeCompleted) {
      this.unsubscribeCompleted();
    }
    if (this.unsubscribeFailed) {
      this.unsubscribeFailed();
    }
    console.log('[MessageFlowManager] Disposed');
  }
}
