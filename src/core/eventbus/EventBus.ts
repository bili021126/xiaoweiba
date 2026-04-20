/**
 * 事件总线 - 记忆系统的神经系统
 * 
 * 核心原则：
 * 1. 内核事件类型封闭，载荷强约束
 * 2. 插件事件符合 plugin.<id>.<event> 格式
 * 3. 请求-响应模式仅内核可注册处理器
 * 4. 异步错误隔离 + 优先级队列
 */

import { injectable } from 'tsyringe';
import { 
  CoreEventType, 
  PluginEventType, 
  AnyEventType, 
  BaseEvent, 
  CoreEventPayloadMap, 
  RequestHandler, 
  EventHandler 
} from './types';
import { SystemErrorEvent } from '../events/DomainEvent';

export { CoreEventType };

@injectable()
export class EventBus {
  private subscribers = new Map<AnyEventType, Set<EventHandler>>();
  private requestHandlers = new Map<CoreEventType, RequestHandler<any>>();
  private priorityQueue: Array<{ event: BaseEvent<AnyEventType>; priority: number }> = [];
  private isFlushing = false;

  // ========== 内核专用：注册请求处理器（封闭） ==========
  registerRequestHandler<T extends CoreEventType>(
    type: T,
    handler: RequestHandler<T>
  ): void {
    if (this.requestHandlers.has(type)) {
      console.warn(`[EventBus] Request handler for ${type} already registered, overwriting.`);
    }
    this.requestHandlers.set(type, handler);
  }

  // ========== 功能模块调用：请求内核数据 ==========
  async request<T extends CoreEventType>(
    type: T,
    payload: CoreEventPayloadMap[T]
  ): Promise<unknown> {
    const handler = this.requestHandlers.get(type);
    if (!handler) {
      throw new Error(`[EventBus] No request handler registered for ${type}`);
    }
    try {
      return await handler(payload);
    } catch (error) {
      // 请求处理器失败，重新抛出由调用方处理
      throw error;
    }
  }

  // ========== 发布事件（带优先级） ==========
  publish<T extends AnyEventType>(
    type: T,
    payload: T extends CoreEventType ? CoreEventPayloadMap[T] : unknown,
    options?: { source?: string; priority?: number }
  ): void {
    const event: BaseEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source: options?.source,
    };

    // 内核事件允许 Schema 校验
    if (this.isCoreEvent(type)) {
      this.validateCoreEvent(event as BaseEvent<CoreEventType>);
    } else {
      this.validatePluginEvent(event as BaseEvent<PluginEventType>);
    }

    const priority = options?.priority ?? (this.isCoreEvent(type) ? 10 : 5);
    this.priorityQueue.push({ event, priority });
    this.priorityQueue.sort((a, b) => b.priority - a.priority);
    this.flush();
  }

  // ========== 订阅事件 ==========
  subscribe<T extends AnyEventType>(
    type: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler as EventHandler);
    return () => this.unsubscribe(type, handler);
  }

  unsubscribe<T extends AnyEventType>(type: T, handler: EventHandler<T>): void {
    this.subscribers.get(type)?.delete(handler as EventHandler);
  }

  once<T extends AnyEventType>(
    type: T,
    handler: EventHandler<T>
  ): () => void {
    const wrapper: EventHandler<T> = (event) => {
      handler(event);
      this.unsubscribe(type, wrapper);
    };
    return this.subscribe(type, wrapper);
  }

  // ========== 内部方法 ==========
  private async flush(): Promise<void> {
    if (this.isFlushing || this.priorityQueue.length === 0) return;
    this.isFlushing = true;

    while (this.priorityQueue.length > 0) {
      const { event } = this.priorityQueue.shift()!;
      const handlers = this.subscribers.get(event.type);
      if (!handlers) continue;

      const promises = Array.from(handlers).map(async (handler) => {
        try {
          // ✅ 添加超时保护，防止handler永远不决议
          // ✅ 增加超时时间到30秒，适应LLM调用等耗时操作
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Handler timeout after 30s for ${event.type}`)), 30000)
          );
          await Promise.race([handler(event), timeoutPromise]);
        } catch (error) {
          console.error(`[EventBus] Handler for ${event.type} failed:`, error);
          // ✅ 发布系统错误事件（用于监控和告警）
          this.publish('system.error' as any, {
            component: 'EventBus',
            context: `Handler for ${event.type}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
      await Promise.allSettled(promises);
    }

    this.isFlushing = false;
  }

  private isCoreEvent(type: AnyEventType): type is CoreEventType {
    return Object.values(CoreEventType).includes(type as CoreEventType);
  }

  private validateCoreEvent(event: BaseEvent<CoreEventType>): void {
    if (!event.type) throw new Error('[EventBus] Core event must have type');
  }

  private validatePluginEvent(event: BaseEvent<PluginEventType>): void {
    const pluginEventPrefix = /^plugin\.\w+\.\w+$/;
    if (!pluginEventPrefix.test(event.type)) {
      throw new Error(`[EventBus] Plugin event type must match "plugin.<pluginId>.<event>", got ${event.type}`);
    }
  }

  // ========== 清理 ==========
  dispose(): void {
    this.subscribers.clear();
    this.requestHandlers.clear();
    this.priorityQueue = [];
  }
}
