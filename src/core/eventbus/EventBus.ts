/**
 * 事件总线 - 记忆系统的神经系统
 * 
 * 职责：
 * 1. 发布-订阅模式的核心实现
 * 2. 所有模块间通信的唯一通道
 * 3. 确保记忆系统对所有行为的可见性
 */

import { injectable } from 'tsyringe';

/**
 * 记忆事件类型定义
 */
export enum MemoryEventType {
  /** 情景记忆新增 */
  EPISODIC_ADDED = 'memory.episodic.added',
  
  /** 偏好记忆更新 */
  PREFERENCE_UPDATED = 'memory.preference.updated',
  
  /** 语义记忆新增 */
  SEMANTIC_ADDED = 'memory.semantic.added',
  
  /** 记忆检索完成 */
  RETRIEVED = 'memory.retrieved',
  
  /** 记忆衰减触发 */
  DECAYED = 'memory.decayed',
  
  /** 主动推荐（记忆系统发起） */
  RECOMMEND = 'memory.recommend',
  
  /** 技能建议（重复操作检测） */
  SKILL_SUGGESTED = 'memory.skill.suggested',
  
  /** 模块动作完成（功能模块上报） */
  ACTION_COMPLETED = 'module.action.completed'
}

/**
 * 事件负载基础接口
 */
export interface EventPayload {
  [key: string]: any;
}

/**
 * 标准事件结构
 */
export interface MemoryEvent {
  type: MemoryEventType;
  timestamp: number;
  payload: EventPayload;
  source?: string; // 事件来源模块
}

/**
 * 事件处理器类型
 */
export type EventHandler = (event: MemoryEvent) => void | Promise<void>;

/**
 * 事件总线类
 * 
 * 使用示例：
 * ```typescript
 * const bus = new EventBus();
 * 
 * // 订阅事件
 * bus.subscribe(MemoryEventType.EPISODIC_ADDED, (event) => {
 *   console.log('New memory:', event.payload.memoryId);
 * });
 * 
 * // 发布事件
 * bus.publish({
 *   type: MemoryEventType.EPISODIC_ADDED,
 *   timestamp: Date.now(),
 *   payload: { memoryId: 'ep_123', taskType: 'CODE_EXPLAIN' }
 * });
 * ```
 */
@injectable()
export class EventBus {
  private subscribers: Map<string, EventHandler[]> = new Map();
  private eventHistory: MemoryEvent[] = [];
  private readonly maxHistorySize: number = 1000; // 保留最近1000个事件用于调试

  /**
   * 订阅事件
   * @param eventType 事件类型
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  subscribe(eventType: MemoryEventType | string, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    const handlers = this.subscribers.get(eventType)!;
    handlers.push(handler);
    
    console.log(`[EventBus] Subscribed to ${eventType}, total handlers: ${handlers.length}`);
    
    // 返回取消订阅函数
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(`[EventBus] Unsubscribed from ${eventType}`);
      }
    };
  }

  /**
   * 发布事件
   * @param event 事件对象
   */
  async publish(event: MemoryEvent): Promise<void> {
    const startTime = Date.now();
    
    // 添加时间戳（如果未提供）
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // 记录到历史
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift(); // 移除最旧的事件
    }
    
    // 获取所有订阅者
    const handlers = this.subscribers.get(event.type) || [];
    
    if (handlers.length === 0) {
      console.debug(`[EventBus] No subscribers for event: ${event.type}`);
      return;
    }
    
    console.log(`[EventBus] Publishing ${event.type} to ${handlers.length} handler(s)`);
    
    // 并行执行所有处理器（允许异步）
    const promises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event.type}:`, error);
        // 不抛出错误，避免影响其他处理器
      }
    });
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    console.debug(`[EventBus] Event ${event.type} handled in ${duration}ms`);
  }

  /**
   * 一次性订阅（只处理一次后自动取消）
   * @param eventType 事件类型
   * @param handler 事件处理器
   */
  once(eventType: MemoryEventType | string, handler: EventHandler): void {
    const unsubscribe = this.subscribe(eventType, async (event) => {
      await handler(event);
      unsubscribe(); // 自动取消订阅
    });
  }

  /**
   * 获取事件历史（用于调试）
   * @param eventType 可选的事件类型过滤
   * @param limit 返回数量限制
   */
  getHistory(eventType?: MemoryEventType | string, limit: number = 50): MemoryEvent[] {
    let history = this.eventHistory;
    
    if (eventType) {
      history = history.filter(e => e.type === eventType);
    }
    
    return history.slice(-limit).reverse(); // 最新的在前
  }

  /**
   * 清空事件历史
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取订阅统计信息
   */
  getStats(): { totalSubscribers: number; eventsByType: Record<string, number> } {
    const eventsByType: Record<string, number> = {};
    let totalSubscribers = 0;
    
    for (const [type, handlers] of this.subscribers.entries()) {
      eventsByType[type] = handlers.length;
      totalSubscribers += handlers.length;
    }
    
    return {
      totalSubscribers,
      eventsByType
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.subscribers.clear();
    this.eventHistory = [];
    console.log('[EventBus] Disposed');
  }
}
