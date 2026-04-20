/**
 * 领域事件基类（泛型）
 */
export abstract class DomainEvent<T = any> {
  constructor(
    public readonly type: string,
    public readonly timestamp: number = Date.now(),
    public readonly payload: T
  ) {}
}

import { Intent } from '../domain/Intent';
import { MemoryContext } from '../domain/MemoryContext';

/**
 * 意图接收事件
 */
export interface IntentPayload {
  intent: Intent;
}

export class IntentReceivedEvent extends DomainEvent<IntentPayload> {
  static readonly type = 'intent.received';
  
  constructor(public readonly intent: Intent) {
    super(IntentReceivedEvent.type, Date.now(), { intent });
  }
}

/**
 * Agent选定事件
 */
export interface AgentSelectedPayload {
  intent: Intent;
  agentId: string;
  memoryContext: MemoryContext;
}

export class AgentSelectedEvent extends DomainEvent<AgentSelectedPayload> {
  static readonly type = 'agent.selected';
  
  constructor(
    public readonly intent: Intent,
    public readonly agentId: string,
    public readonly memoryContext: MemoryContext
  ) {
    super(AgentSelectedEvent.type, Date.now(), { intent, agentId, memoryContext });
  }
}

/**
 * 任务完成事件
 */
export interface TaskCompletedPayload {
  intent: Intent;
  agentId: string;
  result: any; // 结果类型多样化，暂时保留any
  durationMs: number;
  modelId?: string;
  
  // ✅ P1-02: 记忆元数据（用于情景记忆记录）
  memoryMetadata?: {
    taskType: string;
    summary: string;
    entities?: string[];
    outcome?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  };
}

export class TaskCompletedEvent extends DomainEvent<TaskCompletedPayload> {
  static readonly type = 'task.completed';
  
  constructor(
    public readonly intent: Intent,
    public readonly agentId: string,
    public readonly result: any,
    public readonly durationMs: number,
    public readonly modelId?: string,
    public readonly memoryMetadata?: {
      taskType: string;
      summary: string;
      entities?: string[];
      outcome?: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    }
  ) {
    super(TaskCompletedEvent.type, Date.now(), { 
      intent, 
      agentId, 
      result, 
      durationMs, 
      modelId,
      memoryMetadata 
    });
  }
}

/**
 * 任务失败事件
 */
export interface TaskFailedPayload {
  intent: Intent;
  agentId: string;
  error: Error;
  durationMs: number;
}

export class TaskFailedEvent extends DomainEvent<TaskFailedPayload> {
  static readonly type = 'task.failed';
  
  constructor(
    public readonly intent: Intent,
    public readonly agentId: string,
    public readonly error: Error,
    public readonly durationMs: number
  ) {
    super(TaskFailedEvent.type, Date.now(), { intent, agentId, error, durationMs });
  }
}

/**
 * 意图调度完成事件
 */
export interface IntentDispatchedPayload {
  intent: Intent;
  agentId: string;
  duration: number;
}

export class IntentDispatchedEvent extends DomainEvent<IntentDispatchedPayload> {
  static readonly type = 'intent.dispatched';
  
  constructor(
    public readonly intent: Intent,
    public readonly agentId: string,
    public readonly duration: number
  ) {
    super(IntentDispatchedEvent.type, Date.now(), { intent, agentId, duration });
  }
}

/**
 * 意图调度失败事件
 */
export interface IntentDispatchFailedPayload {
  intent: Intent;
  error: Error;
}

export class IntentDispatchFailedEvent extends DomainEvent<IntentDispatchFailedPayload> {
  static readonly type = 'intent.dispatch_failed';
  
  constructor(
    public readonly intent: Intent,
    public readonly error: Error
  ) {
    super(IntentDispatchFailedEvent.type, Date.now(), { intent, error });
  }
}

/**
 * 用户聊天意图事件
 */
export interface UserChatPayload {
  text: string;
  timestamp: number;
}

export class UserChatIntentEvent extends DomainEvent<UserChatPayload> {
  static readonly type = 'user.chat_intent';
  
  constructor(payload: UserChatPayload) {
    super(UserChatIntentEvent.type, Date.now(), payload);
  }
}

/**
 * AI助手响应事件
 */
export interface AssistantResponsePayload {
  messageId: string;
  content: string;
  timestamp: number;
}

export class AssistantResponseEvent extends DomainEvent<AssistantResponsePayload> {
  static readonly type = 'assistant.response';
  
  constructor(payload: AssistantResponsePayload) {
    super(AssistantResponseEvent.type, Date.now(), payload);
  }
}

/**
 * 流式响应块事件
 * 当 AI 逐字生成回复时，每个 chunk 都会发布此事件
 */
export interface StreamChunkPayload {
  messageId: string;
  chunk: string;
}

export class StreamChunkEvent extends DomainEvent<StreamChunkPayload> {
  static readonly type = 'stream.chunk';
  
  constructor(
    public readonly messageId: string,
    public readonly chunk: string
  ) {
    super(StreamChunkEvent.type, Date.now(), { messageId, chunk });
  }
}

/**
 * 消息添加事件
 */
export interface MessageAddedPayload {
  message: any;
}

export class MessageAddedEvent extends DomainEvent<MessageAddedPayload> {
  static readonly type = 'message.added';
  
  constructor(payload: MessageAddedPayload) {
    super(MessageAddedEvent.type, Date.now(), payload);
  }
}

/**
 * 用户反馈事件
 */
export interface FeedbackGivenPayload {
  query: string;
  clickedMemoryId: string;
  dwellTimeMs: number;
}

export class FeedbackGivenEvent extends DomainEvent<FeedbackGivenPayload> {
  static readonly type = 'feedback.given';
  
  constructor(
    public readonly query: string,
    public readonly clickedMemoryId: string,
    public readonly dwellTimeMs: number
  ) {
    super(FeedbackGivenEvent.type, Date.now(), { query, clickedMemoryId, dwellTimeMs });
  }
}

/**
 * 系统错误事件（用于监控和告警）
 */
export interface SystemErrorPayload {
  component: string;
  context?: string;
  error?: string;
}

export class SystemErrorEvent extends DomainEvent<SystemErrorPayload> {
  static readonly type = 'system.error';
  
  constructor(
    public readonly component: string,
    public readonly context?: string,
    public readonly error?: string
  ) {
    super(SystemErrorEvent.type, Date.now(), { component, context, error });
  }
}

/**
 * ✅ P1-02: 会话列表更新事件
 * 
 * 当会话创建、删除或切换时发布，通知前端更新会话列表
 * 
 * 注意：这是插件事件，必须遵循 plugin.<pluginId>.<event> 格式
 */
export interface SessionListUpdatedPayload {
  action: 'created' | 'deleted' | 'switched';
  sessionId?: string;
  timestamp: number;
}

export class SessionListUpdatedEvent extends DomainEvent<SessionListUpdatedPayload> {
  static readonly type = 'plugin.xiaoweiba.session_list_updated';
  
  constructor(
    public readonly action: 'created' | 'deleted' | 'switched',
    public readonly sessionId?: string
  ) {
    super(SessionListUpdatedEvent.type, Date.now(), {
      action,
      sessionId,
      timestamp: Date.now()
    });
  }
}
