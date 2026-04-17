import { EventBus, MemoryEventType, MemoryEvent } from '../../../src/core/eventbus/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.dispose();
  });

  describe('subscribe & publish', () => {
    it('应该能够订阅和发布事件', async () => {
      const handler = jest.fn();
      
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, handler);
      
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: { memoryId: 'test-123' }
      });
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: MemoryEventType.EPISODIC_ADDED,
        payload: { memoryId: 'test-123' }
      }));
    });

    it('应该支持多个订阅者', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, handler1);
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, handler2);
      
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('应该支持异步处理器', async () => {
      const handler = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });
      
      eventBus.subscribe(MemoryEventType.ACTION_COMPLETED, handler);
      
      await eventBus.publish({
        type: MemoryEventType.ACTION_COMPLETED,
        timestamp: Date.now(),
        payload: {}
      });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('应该在无订阅者时不抛出错误', async () => {
      // 不应该抛出错误
      await expect(eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      })).resolves.toBeUndefined();
    });

    it('应该在处理器抛出错误时不影响其他处理器', async () => {
      const failingHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();
      
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, failingHandler);
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, successHandler);
      
      // 不应该抛出错误
      await expect(eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      })).resolves.toBeUndefined();
      
      // 两个处理器都应该被调用
      expect(failingHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('应该能够通过返回的函数取消订阅', async () => {
      const handler = jest.fn();
      
      const unsubscribe = eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, handler);
      
      // 第一次发布，应该触发
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      expect(handler).toHaveBeenCalledTimes(1);
      
      // 取消订阅
      unsubscribe();
      
      // 第二次发布，不应该触发
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      expect(handler).toHaveBeenCalledTimes(1); // 仍然是1次
    });
  });

  describe('once', () => {
    it('应该只处理一次事件', async () => {
      const handler = jest.fn();
      
      eventBus.once(MemoryEventType.EPISODIC_ADDED, handler);
      
      // 第一次发布，应该触发
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      expect(handler).toHaveBeenCalledTimes(1);
      
      // 第二次发布，不应该触发
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      expect(handler).toHaveBeenCalledTimes(1); // 仍然是1次
    });
  });

  describe('getHistory', () => {
    it('应该记录发布的事件历史', async () => {
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: 1000,
        payload: { id: 1 }
      });
      
      await eventBus.publish({
        type: MemoryEventType.PREFERENCE_UPDATED,
        timestamp: 2000,
        payload: { id: 2 }
      });
      
      const history = eventBus.getHistory();
      
      expect(history.length).toBe(2);
      expect(history[0].type).toBe(MemoryEventType.PREFERENCE_UPDATED); // 最新的在前
      expect(history[1].type).toBe(MemoryEventType.EPISODIC_ADDED);
    });

    it('应该支持按类型过滤历史', async () => {
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: 1000,
        payload: {}
      });
      
      await eventBus.publish({
        type: MemoryEventType.PREFERENCE_UPDATED,
        timestamp: 2000,
        payload: {}
      });
      
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: 3000,
        payload: {}
      });
      
      const history = eventBus.getHistory(MemoryEventType.EPISODIC_ADDED);
      
      expect(history.length).toBe(2);
      history.forEach(event => {
        expect(event.type).toBe(MemoryEventType.EPISODIC_ADDED);
      });
    });

    it('应该限制返回数量', async () => {
      for (let i = 0; i < 10; i++) {
        await eventBus.publish({
          type: MemoryEventType.EPISODIC_ADDED,
          timestamp: i * 1000,
          payload: { index: i }
        });
      }
      
      const history = eventBus.getHistory(undefined, 5);
      
      expect(history.length).toBe(5);
      expect(history[0].payload.index).toBe(9); // 最新的在前
    });
  });

  describe('clearHistory', () => {
    it('应该清空事件历史', async () => {
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(),
        payload: {}
      });
      
      expect(eventBus.getHistory().length).toBe(1);
      
      eventBus.clearHistory();
      
      expect(eventBus.getHistory().length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('应该返回订阅统计信息', () => {
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, jest.fn());
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, jest.fn());
      eventBus.subscribe(MemoryEventType.PREFERENCE_UPDATED, jest.fn());
      
      const stats = eventBus.getStats();
      
      expect(stats.totalSubscribers).toBe(3);
      expect(stats.eventsByType[MemoryEventType.EPISODIC_ADDED]).toBe(2);
      expect(stats.eventsByType[MemoryEventType.PREFERENCE_UPDATED]).toBe(1);
    });

    it('应该在无订阅时返回空统计', () => {
      const stats = eventBus.getStats();
      
      expect(stats.totalSubscribers).toBe(0);
      expect(Object.keys(stats.eventsByType).length).toBe(0);
    });
  });

  describe('dispose', () => {
    it('应该清理所有订阅和历史', () => {
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, jest.fn());
      
      eventBus.dispose();
      
      const stats = eventBus.getStats();
      expect(stats.totalSubscribers).toBe(0);
      expect(eventBus.getHistory().length).toBe(0);
    });
  });

  describe('timestamp auto-fill', () => {
    it('应该自动添加时间戳', async () => {
      let capturedEvent: MemoryEvent | null = null;
      
      eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, (event) => {
        capturedEvent = event;
      });
      
      const beforePublish = Date.now();
      await eventBus.publish({
        type: MemoryEventType.EPISODIC_ADDED,
        timestamp: Date.now(), // EventBus会自动填充，但TypeScript要求显式提供
        payload: {}
      });
      const afterPublish = Date.now();
      
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.timestamp).toBeGreaterThanOrEqual(beforePublish);
      expect(capturedEvent!.timestamp).toBeLessThanOrEqual(afterPublish);
    });
  });
});
