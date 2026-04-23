/**
 * DomainEvent 单元测试
 * 
 * 测试场景：
 * 1. 事件构造 - 验证各类事件的构造函数
 * 2. 事件属性 - 验证时间戳、类型等属性
 * 3. Payload 验证 - 验证事件载荷的正确性
 */

import 'reflect-metadata';
import {
  IntentReceivedEvent,
  AgentSelectedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  IntentDispatchedEvent,
  IntentDispatchFailedEvent,
  AssistantResponseEvent,
  StreamChunkEvent,
  SessionListUpdatedEvent,
  SessionHistoryLoadedEvent,
  MemoryRecordedEvent,
  FeedbackSubmittedEvent,
  SystemErrorEvent
} from '../../../../src/core/events/DomainEvent';
import { Intent } from '../../../../src/core/domain';

describe('DomainEvent - 领域事件', () => {
  // ==================== 测试用例1: IntentReceivedEvent ====================
  describe('IntentReceivedEvent', () => {
    it('应该正确构造意图接收事件', () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'Hello',
        metadata: { timestamp: Date.now() }
      };

      const event = new IntentReceivedEvent(intent);

      expect(event.type).toBe('intent.received');
      expect(event.payload.intent).toBe(intent);
      expect(event.timestamp).toBeDefined();
    });
  });

  // ==================== 测试用例2: AgentSelectedEvent ====================
  describe('AgentSelectedEvent', () => {
    it('应该正确构造 Agent 选择事件', () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now() }
      };

      const event = new AgentSelectedEvent({
        intent,
        agentId: 'explain_agent',
        memoryContext: { episodicMemories: [], preferenceRecommendations: [] }
      });

      expect(event.type).toBe('agent.selected');
      expect(event.payload.agentId).toBe('explain_agent');
      expect(event.payload.intent.name).toBe('explain_code');
    });
  });

  // ==================== 测试用例3: TaskCompletedEvent ====================
  describe('TaskCompletedEvent', () => {
    it('应该正确构造任务完成事件', () => {
      const intent: Intent = {
        name: 'generate_commit',
        userInput: '生成提交',
        metadata: { timestamp: Date.now() }
      };

      const result = { success: true, data: { message: 'feat: test' } };
      const durationMs = 1500;
      const modelId = 'deepseek';
      const actionId = 'action_123';

      const event = new TaskCompletedEvent(
        intent,
        'commit_agent',
        result,
        durationMs,
        modelId,
        { taskType: 'COMMIT_GENERATE', summary: 'test', entities: [], outcome: 'SUCCESS' },
        actionId
      );

      expect(event.type).toBe('task.completed');
      expect(event.payload.agentId).toBe('commit_agent');
      expect(event.payload.durationMs).toBe(1500);
      expect(event.payload.modelId).toBe('deepseek');
    });

    it('应该处理缺失的可选参数', () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const result = { success: true };

      const event = new TaskCompletedEvent(
        intent,
        'chat_agent',
        result,
        1000
      );

      expect(event.payload.modelId).toBeUndefined();
      expect(event.payload.memoryMetadata).toBeUndefined();
    });
  });

  // ==================== 测试用例4: TaskFailedEvent ====================
  describe('TaskFailedEvent', () => {
    it('应该正确构造任务失败事件', () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释',
        metadata: { timestamp: Date.now() }
      };

      const error = new Error('Execution failed');
      const durationMs = 500;

      const event = new TaskFailedEvent(intent, 'explain_agent', error, durationMs);

      expect(event.type).toBe('task.failed');
      expect(event.payload.agentId).toBe('explain_agent');
      expect(event.payload.error.message).toBe('Execution failed');
      expect(event.payload.durationMs).toBe(500);
    });

    it('应该处理字符串错误', () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const event = new TaskFailedEvent(
        intent,
        'chat_agent',
        'Unknown error' as any,
        300
      );

      expect(event.payload.error).toBeDefined();
    });
  });

  // ==================== 测试用例5: AssistantResponseEvent ====================
  describe('AssistantResponseEvent', () => {
    it('应该正确构造助手响应事件', () => {
      const event = new AssistantResponseEvent({
        messageId: 'msg_123',
        content: '这是助手的回复',
        timestamp: Date.now()
      });

      expect(event.type).toBe('assistant.response');
      expect(event.payload.messageId).toBe('msg_123');
      expect(event.payload.content).toBe('这是助手的回复');
    });

    it('应该支持流式内容', () => {
      const event = new AssistantResponseEvent({
        messageId: 'msg_456',
        content: '部分',
        timestamp: Date.now(),
        isComplete: false
      });

      expect(event.payload.isComplete).toBe(false);
    });
  });

  // ==================== 测试用例6: StreamChunkEvent ====================
  describe('StreamChunkEvent', () => {
    it('应该正确构造流式块事件', () => {
      const event = new StreamChunkEvent({
        chunkId: 'chunk_1',
        content: '流式内容片段',
        index: 0,
        isLast: false
      });

      expect(event.type).toBe('stream.chunk');
      expect(event.payload.chunkId).toBe('chunk_1');
      expect(event.payload.index).toBe(0);
      expect(event.payload.isLast).toBe(false);
    });

    it('最后一个块应标记 isLast 为 true', () => {
      const event = new StreamChunkEvent({
        chunkId: 'chunk_last',
        content: '最后一段',
        index: 10,
        isLast: true
      });

      expect(event.payload.isLast).toBe(true);
    });
  });

  // ==================== 测试用例7: Session 相关事件 ====================
  describe('Session 事件', () => {
    it('应该构造会话列表更新事件', () => {
      const sessions = [
        { id: 'session_1', title: '会话 1', createdAt: Date.now() },
        { id: 'session_2', title: '会话 2', createdAt: Date.now() }
      ];

      const event = new SessionListUpdatedEvent(sessions as any);

      expect(event.type).toBe('session.list.updated');
      expect(event.payload.sessions).toHaveLength(2);
    });

    it('应该构造会话历史加载事件', () => {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi', timestamp: Date.now() }
      ];

      const event = new SessionHistoryLoadedEvent('session_1', messages as any);

      expect(event.type).toBe('session.history.loaded');
      expect(event.payload.sessionId).toBe('session_1');
      expect(event.payload.messages).toHaveLength(2);
    });
  });

  // ==================== 测试用例8: Memory 相关事件 ====================
  describe('Memory 事件', () => {
    it('应该构造记忆记录事件', () => {
      const event = new MemoryRecordedEvent({
        memoryId: 'ep_123',
        taskType: 'CHAT_COMMAND',
        summary: '讨论了 TypeScript',
        outcome: 'SUCCESS'
      });

      expect(event.type).toBe('memory.recorded');
      expect(event.payload.memoryId).toBe('ep_123');
      expect(event.payload.taskType).toBe('CHAT_COMMAND');
    });

    it('应该构造反馈提交事件', () => {
      const event = new FeedbackSubmittedEvent({
        feedbackId: 'fb_456',
        memoryId: 'ep_123',
        rating: 5,
        comment: '非常有帮助'
      });

      expect(event.type).toBe('feedback.submitted');
      expect(event.payload.rating).toBe(5);
    });
  });

  // ==================== 测试用例9: SystemErrorEvent ====================
  describe('SystemErrorEvent', () => {
    it('应该构造系统错误事件', () => {
      const event = new SystemErrorEvent({
        component: 'EventBus',
        context: 'Handler execution',
        error: 'Timeout error',
        severity: 'high'
      });

      expect(event.type).toBe('system.error');
      expect(event.payload.component).toBe('EventBus');
      expect(event.payload.severity).toBe('high');
    });

    it('应该支持不同严重级别', () => {
      const lowEvent = new SystemErrorEvent({
        component: 'Logger',
        context: 'Log rotation',
        error: 'Minor issue',
        severity: 'low'
      });

      expect(lowEvent.payload.severity).toBe('low');
    });
  });

  // ==================== 测试用例10: 事件时间戳 ====================
  describe('事件时间戳', () => {
    it('所有事件应有时间戳', () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const events = [
        new IntentReceivedEvent(intent),
        new AssistantResponseEvent({ messageId: 'msg_1', content: 'test', timestamp: Date.now() }),
        new StreamChunkEvent({ chunkId: 'c1', content: 'test', index: 0, isLast: false })
      ];

      events.forEach(event => {
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
        expect(event.timestamp).toBeGreaterThan(0);
      });
    });

    it('时间戳应为当前时间附近', () => {
      const before = Date.now();
      const event = new IntentReceivedEvent({
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      });
      const after = Date.now();

      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ==================== 测试用例11: 事件类型唯一性 ====================
  describe('事件类型唯一性', () => {
    it('不同类型事件应有不同的 type', () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const types = new Set([
        new IntentReceivedEvent(intent).type,
        new AgentSelectedEvent({ intent, agentId: 'test', memoryContext: { episodicMemories: [], preferenceRecommendations: [] } }).type,
        new TaskCompletedEvent(intent, 'test', { success: true }, 100).type,
        new AssistantResponseEvent({ messageId: 'msg', content: 'test', timestamp: Date.now() }).type
      ]);

      expect(types.size).toBe(4); // 所有类型应唯一
    });
  });
});
