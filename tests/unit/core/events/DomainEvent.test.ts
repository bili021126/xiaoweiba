import 'reflect-metadata';
import {
  IntentReceivedEvent,
  AssistantResponseEvent,
  StreamChunkEvent
} from '../../../../src/core/events/DomainEvent';

describe('DomainEvent', () => {
  describe('IntentReceivedEvent', () => {
    it('should create event with correct type', () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'Hello',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const event = new IntentReceivedEvent(intent);

      expect(event.type).toBe('intent.received');
      expect(event.payload.intent).toBe(intent);
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('AssistantResponseEvent', () => {
    it('should create event with message content', () => {
      const event = new AssistantResponseEvent({
        messageId: 'msg_123',
        content: 'Test response',
        timestamp: Date.now()
      });

      expect(event.type).toBe('assistant.response');
      expect(event.payload.messageId).toBe('msg_123');
      expect(event.payload.content).toBe('Test response');
    });
  });

  describe('StreamChunkEvent', () => {
    it('should create stream chunk event', () => {
      const event = new StreamChunkEvent('msg_123', 'Chunk content');

      expect(event.type).toBe('stream.chunk');
      expect(event.messageId).toBe('msg_123');
      expect(event.payload.chunk).toBe('Chunk content');
    });

    it('should handle multiple chunks', () => {
      const event1 = new StreamChunkEvent('msg_1', 'First chunk');
      const event2 = new StreamChunkEvent('msg_1', 'Second chunk');

      expect(event1.payload.chunk).toBe('First chunk');
      expect(event2.payload.chunk).toBe('Second chunk');
    });
  });

  describe('Event timestamp', () => {
    it('all events should have valid timestamp', () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'Test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const events = [
        new IntentReceivedEvent(intent),
        new AssistantResponseEvent({ messageId: 'msg_1', content: 'test', timestamp: Date.now() }),
        new StreamChunkEvent('msg_2', 'test chunk')
      ];

      events.forEach(event => {
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
        expect(event.timestamp).toBeGreaterThan(0);
      });
    });
  });
});
