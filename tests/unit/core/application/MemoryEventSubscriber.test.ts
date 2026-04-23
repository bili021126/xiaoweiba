import 'reflect-metadata';
import { MemoryEventSubscriber } from '../../../../src/core/application/MemoryEventSubscriber';
import { IEventBus } from '../../../../src/core/ports/IEventBus';

const mockEventBus = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
} as any;

describe('MemoryEventSubscriber', () => {
  let subscriber: MemoryEventSubscriber;

  beforeEach(() => {
    jest.clearAllMocks();
    subscriber = new MemoryEventSubscriber(mockEventBus);
  });

  describe('subscribeToTaskCompletion', () => {
    it('should subscribe to TaskCompletedEvent', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();
      mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

      subscriber.subscribeToTaskCompletion(mockCallback);

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'task.completed',
        expect.any(Function)
      );
    });

    it('should call callback with valid payload', async () => {
      const mockCallback = jest.fn();
      let capturedHandler: any;
      
      mockEventBus.subscribe.mockImplementation((type: any, handler: any) => {
        capturedHandler = handler;
        return jest.fn();
      });

      subscriber.subscribeToTaskCompletion(mockCallback);

      const validPayload = {
        intent: { name: 'test' },
        agentId: 'agent1',
        result: { success: true },
        durationMs: 100
      };

      await (capturedHandler as any)({ payload: validPayload });

      expect(mockCallback).toHaveBeenCalledWith(validPayload);
    });

    it('should skip invalid payload without intent', async () => {
      const mockCallback = jest.fn();
      let capturedHandler: any;
      
      mockEventBus.subscribe.mockImplementation((type: any, handler: any) => {
        capturedHandler = handler;
        return jest.fn();
      });

      subscriber.subscribeToTaskCompletion(mockCallback);

      const invalidPayload = { agentId: 'agent1' };

      await (capturedHandler as any)({ payload: invalidPayload });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should skip invalid payload without agentId', async () => {
      const mockCallback = jest.fn();
      let capturedHandler: any;
      
      mockEventBus.subscribe.mockImplementation((type: any, handler: any) => {
        capturedHandler = handler;
        return jest.fn();
      });

      subscriber.subscribeToTaskCompletion(mockCallback);

      const invalidPayload = { intent: { name: 'test' } };

      await (capturedHandler as any)({ payload: invalidPayload });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle event without payload wrapper', async () => {
      const mockCallback = jest.fn();
      let capturedHandler: any;
      
      mockEventBus.subscribe.mockImplementation((type: any, handler: any) => {
        capturedHandler = handler;
        return jest.fn();
      });

      subscriber.subscribeToTaskCompletion(mockCallback);

      const directPayload = {
        intent: { name: 'test' },
        agentId: 'agent1',
        result: {},
        durationMs: 50
      };

      await (capturedHandler as any)(directPayload);

      expect(mockCallback).toHaveBeenCalledWith(directPayload);
    });
  });

  describe('unsubscribeFromEvents', () => {
    it('should unsubscribe if subscribed', () => {
      const mockUnsubscribe = jest.fn();
      mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

      subscriber.subscribeToTaskCompletion(jest.fn());
      subscriber.unsubscribeFromEvents();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should do nothing if not subscribed', () => {
      expect(() => subscriber.unsubscribeFromEvents()).not.toThrow();
    });
  });
});
