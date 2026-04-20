/**
 * 领域事件基类
 */

export abstract class DomainEvent {
  constructor(
    public readonly type: string,
    public readonly timestamp: number = Date.now(),
    public readonly payload: any
  ) {}
}

/**
 * 意图接收事件
 */
export class IntentReceivedEvent extends DomainEvent {
  static readonly type = 'intent.received';
  
  constructor(public readonly intent: any) {
    super(IntentReceivedEvent.type, Date.now(), { intent });
  }
}

/**
 * Agent选定事件
 */
export class AgentSelectedEvent extends DomainEvent {
  static readonly type = 'agent.selected';
  
  constructor(public readonly intent: any, public readonly agentId: string, public readonly memoryContext: any) {
    super(AgentSelectedEvent.type, Date.now(), { intent, agentId, memoryContext });
  }
}

/**
 * 任务完成事件
 */
export class TaskCompletedEvent extends DomainEvent {
  static readonly type = 'task.completed';
  
  constructor(
    public readonly intent: any,
    public readonly agentId: string,
    public readonly result: any,
    public readonly durationMs: number,
    public readonly modelId?: string // ✅ 新增：模型ID
  ) {
    super(TaskCompletedEvent.type, Date.now(), { intent, agentId, result, durationMs, modelId });
  }
}

/**
 * 任务失败事件
 */
export class TaskFailedEvent extends DomainEvent {
  static readonly type = 'task.failed';
  
  constructor(
    public readonly intent: any,
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
export class IntentDispatchedEvent extends DomainEvent {
  static readonly type = 'intent.dispatched';
  
  constructor(public readonly intent: any, public readonly agentId: string, public readonly duration: number) {
    super(IntentDispatchedEvent.type, Date.now(), { intent, agentId, duration });
  }
}

/**
 * 意图调度失败事件
 */
export class IntentDispatchFailedEvent extends DomainEvent {
  static readonly type = 'intent.dispatch_failed';
  
  constructor(public readonly intent: any, public readonly error: Error) {
    super(IntentDispatchFailedEvent.type, Date.now(), { intent, error });
  }
}

/**
 * 用户聊天意图事件
 */
export class UserChatIntentEvent extends DomainEvent {
  static readonly type = 'user.chat_intent';
  
  constructor(payload: { text: string; timestamp: number }) {
    super(UserChatIntentEvent.type, Date.now(), payload);
  }
}

/**
 * AI助手响应事件
 */
export class AssistantResponseEvent extends DomainEvent {
  static readonly type = 'assistant.response';
  
  constructor(payload: { messageId: string; content: string; timestamp: number }) {
    super(AssistantResponseEvent.type, Date.now(), payload);
  }
}

/**
 * 流式响应块事件
 * 当 AI 逐字生成回复时，每个 chunk 都会发布此事件
 */
export class StreamChunkEvent extends DomainEvent {
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
export class MessageAddedEvent extends DomainEvent {
  static readonly type = 'message.added';
  
  constructor(payload: { message: any }) {
    super(MessageAddedEvent.type, Date.now(), payload);
  }
}

/**
 * 用户反馈事件
 */
export class FeedbackGivenEvent extends DomainEvent {
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
export class SystemErrorEvent extends DomainEvent {
  static readonly type = 'system.error';
  
  constructor(
    public readonly component: string,
    public readonly context?: string,
    public readonly error?: string
  ) {
    super(SystemErrorEvent.type, Date.now(), { component, context, error });
  }
}
