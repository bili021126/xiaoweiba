/**
 * EventBus适配器 - 将旧EventBus适配到IEventBus接口
 * 
 * 职责：
 * 1. 实现IEventBus端口接口
 * 2. 委托给具体的EventBus实现
 * 3. 处理DomainEvent到BaseEvent的转换
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus, EventHandler } from '../../core/ports/IEventBus';
import { DomainEvent } from '../../core/events/DomainEvent';
import { EventBus as LegacyEventBus } from '../../core/eventbus/EventBus';

@injectable()
export class EventBusAdapter implements IEventBus {
  constructor(
    @inject(LegacyEventBus) private legacyEventBus: LegacyEventBus
  ) {}

  /**
   * 发布领域事件
   */
  publish(event: DomainEvent): void {
    // 将DomainEvent转换为LegacyEventBus的格式
    this.legacyEventBus.publish(
      event.type as any,
      event.payload,
      { source: 'domain', priority: 10 }
    );
  }

  /**
   * 订阅领域事件
   */
  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): () => void {
    return this.legacyEventBus.subscribe(
      eventType as any,
      handler as any
    );
  }

  /**
   * 清理所有订阅
   */
  dispose(): void {
    this.legacyEventBus.dispose();
  }
}
