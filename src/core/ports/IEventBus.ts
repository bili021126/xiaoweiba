/**
 * 事件总线端口 - 领域层与应用层的通信契约
 * 
 * 设计原则：
 * 1. 应用层只依赖此接口，不依赖具体实现
 * 2. 基础设施层提供EventBus实现
 * 3. 支持发布/订阅模式和请求/响应模式
 */

import { DomainEvent } from '../events/DomainEvent';

/**
 * 事件处理器类型
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

/**
 * 请求处理器类型（用于请求-响应模式）
 */
export type RequestHandler<TPayload, TResult> = (payload: TPayload) => TResult | Promise<TResult>;

/**
 * 事件总线端口接口
 * 
 * 职责：
 * 1. 发布领域事件
 * 2. 订阅领域事件
 * 3. 请求-响应模式（可选）
 */
export interface IEventBus {
  /**
   * 发布事件
   * @param event 领域事件实例
   */
  publish(event: DomainEvent): void;

  /**
   * 订阅事件
   * @param eventType 事件类型字符串
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): () => void;

  /**
   * 注册请求处理器（用于请求-响应模式）
   * @param requestType 请求类型
   * @param handler 请求处理器
   */
  registerRequestHandler<TPayload, TResult>(
    requestType: string,
    handler: RequestHandler<TPayload, TResult>
  ): void;

  /**
   * 发送请求并等待响应
   * @param requestType 请求类型
   * @param payload 请求载荷
   * @returns 响应结果
   */
  request<TPayload, TResult>(requestType: string, payload: TPayload): Promise<TResult>;

  /**
   * 清理所有订阅和处理器
   */
  dispose(): void;
}
