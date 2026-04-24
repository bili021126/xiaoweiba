import 'reflect-metadata';
import {
  IntentReceivedEvent,
  AssistantResponseEvent,
  StreamChunkEvent,
  AgentSelectedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  SessionHistoryLoadedEvent,
  SessionListUpdatedEvent,
  FeedbackGivenEvent
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

  // ✅ 补充未覆盖的事件类测试
  describe('AgentSelectedEvent', () => {
    it('should create agent selected event', () => {
      const intent = {
        name: 'explain_code' as any,
        userInput: 'Explain this code',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext = {
        episodicMemories: [],
        semanticMemories: [],
        preferences: [],
        preferenceRecommendations: []
      } as any;

      const event = new AgentSelectedEvent(intent, 'explain-agent', memoryContext);

      expect(event.type).toBe('agent.selected');
      expect(event.agentId).toBe('explain-agent');
      expect(event.payload.intent).toBe(intent);
      expect(event.payload.memoryContext).toBe(memoryContext);
    });
  });

  describe('TaskCompletedEvent', () => {
    it('should create task completed event with basic fields', () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'Hello',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const event = new TaskCompletedEvent(
        intent,
        'chat-agent',
        { success: true, data: 'Response' },
        1500,
        'deepseek-pro'
      );

      expect(event.type).toBe('task.completed');
      expect(event.agentId).toBe('chat-agent');
      expect(event.durationMs).toBe(1500);
      expect(event.modelId).toBe('deepseek-pro');
      expect(event.payload.result.success).toBe(true);
    });

    it('should create task completed event with memoryMetadata and actionId', () => {
      const intent = {
        name: 'generate_commit' as any,
        userInput: 'Generate commit message',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryMetadata = {
        taskType: 'GIT_COMMIT',
        summary: 'Generated commit message',
        entities: ['git'],
        outcome: 'SUCCESS' as const
      };

      const event = new TaskCompletedEvent(
        intent,
        'commit-agent',
        { success: true },
        2000,
        'deepseek-pro',
        memoryMetadata,
        'action_123456'
      );

      expect(event.actionId).toBe('action_123456');
      expect(event.payload.memoryMetadata).toEqual(memoryMetadata);
      expect(event.payload.actionId).toBe('action_123456');
    });
  });

  describe('TaskFailedEvent', () => {
    it('should create task failed event', () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'Test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const error = new Error('Execution failed');
      const event = new TaskFailedEvent(intent, 'test-agent', error, 500);

      expect(event.type).toBe('task.failed');
      expect(event.agentId).toBe('test-agent');
      expect(event.error.message).toBe('Execution failed');
      expect(event.durationMs).toBe(500);
    });
  });

  describe('SessionHistoryLoadedEvent', () => {
    it('should create session history loaded event', () => {
      const messages = [
        { id: 'msg_1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
        { id: 'msg_2', role: 'assistant' as const, content: 'Hi', timestamp: Date.now() }
      ];

      const event = new SessionHistoryLoadedEvent('session_123', messages);

      expect(event.type).toBe('session.history.loaded');
      expect(event.sessionId).toBe('session_123');
      expect(event.messages).toHaveLength(2);
      expect(event.payload.sessionId).toBe('session_123');
      expect(event.payload.messages).toEqual(messages);
    });
  });

  describe('SessionListUpdatedEvent', () => {
    it('should create session list updated event for created action', () => {
      const event = new SessionListUpdatedEvent('created', 'session_123');

      expect(event.type).toBe('plugin.xiaoweiba.session_list_updated');
      expect(event.action).toBe('created');
      expect(event.sessionId).toBe('session_123');
      expect(event.payload.action).toBe('created');
      expect(event.payload.sessionId).toBe('session_123');
    });

    it('should create session list updated event for deleted action', () => {
      const event = new SessionListUpdatedEvent('deleted', 'session_456');

      expect(event.action).toBe('deleted');
      expect(event.sessionId).toBe('session_456');
    });

    it('should create session list updated event for switched action', () => {
      const event = new SessionListUpdatedEvent('switched', 'session_789');

      expect(event.action).toBe('switched');
      expect(event.sessionId).toBe('session_789');
    });
  });

  describe('FeedbackGivenEvent', () => {
    it('should create feedback given event', () => {
      const event = new FeedbackGivenEvent(
        'What is TypeScript?',
        'memory_123',
        5000
      );

      expect(event.type).toBe('feedback.given');
      expect(event.query).toBe('What is TypeScript?');
      expect(event.clickedMemoryId).toBe('memory_123');
      expect(event.dwellTimeMs).toBe(5000);
    });
  });
});
