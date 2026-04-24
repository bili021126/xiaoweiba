/**
 * 事件总线类型定义
 * 
 * 核心原则：
 * - 内核事件类型封闭，载荷强约束
 * - 插件事件符合 plugin.<id>.<event> 格式
 * - 请求-响应模式仅内核可注册处理器
 */

/**
 * 内核事件类型（封闭枚举）
 */
export enum CoreEventType {
  // 记忆相关
  MEMORY_RECORDED = 'memory.recorded',
  MEMORY_CONTEXT_REQUEST = 'memory.context.request',
  MEMORY_RECOMMEND = 'memory.recommend',

  // 任务相关
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',           // ✅ 新增：任务失败事件

  // 系统相关
  CONFIG_UPDATED = 'config.updated',
  SYSTEM_ERROR = 'system.error',         // ✅ 新增：系统错误事件
  
  // Agent相关
  AGENT_REGISTERED = 'agent.registered',
  
  // 意图调度相关
  INTENT_RECEIVED = 'intent.received',
  AGENT_SELECTED = 'agent.selected',
  INTENT_DISPATCHED = 'intent.dispatched',
  INTENT_DISPATCH_FAILED = 'intent.dispatch_failed',
  
  // UI响应相关
  ASSISTANT_RESPONSE = 'assistant.response',
  STREAM_CHUNK = 'stream.chunk',        // ✅ 新增：流式响应块
}

/**
 * 插件事件类型（开放命名空间）
 */
export type PluginEventType = `plugin.${string}.${string}`;

/**
 * 任意事件类型
 */
export type AnyEventType = CoreEventType | PluginEventType;

/**
 * 基础事件结构
 */
export interface BaseEvent<T extends AnyEventType, P = unknown> {
  type: T;
  payload: P;
  timestamp: number;
  source?: string;
}

/**
 * 内核事件（强类型载荷）
 */
export type CoreEvent<T extends CoreEventType, P = unknown> = BaseEvent<T, P>;

/**
 * 插件事件
 */
export type PluginEvent<T extends PluginEventType, P = unknown> = BaseEvent<T, P>;

/**
 * 内核事件载荷类型映射
 */
export interface CoreEventPayloadMap {
  [CoreEventType.MEMORY_RECORDED]: { memoryId: string; taskType: string };
  [CoreEventType.MEMORY_CONTEXT_REQUEST]: { actionId: string; input: unknown };
  [CoreEventType.MEMORY_RECOMMEND]: { filePath: string; recommendations: unknown[] };
  [CoreEventType.TASK_COMPLETED]: {
    actionId: string;
    result: unknown;
    durationMs: number;
    // ✅ 新增：由 Command 提供的记忆元数据
    memoryMetadata?: {
      taskType: string;
      summary: string;
      entities: string[];
    };
  };
  [CoreEventType.TASK_FAILED]: {       // ✅ 新增：任务失败事件载荷
    intent: any;
    agentId: string;
    error: Error;
    durationMs: number;
  };
  [CoreEventType.CONFIG_UPDATED]: { key: string; oldValue: unknown; newValue: unknown };
  [CoreEventType.SYSTEM_ERROR]: {      // ✅ 新增：系统错误事件载荷
    component: string;
    context: string;
    error: string;
  };
  [CoreEventType.AGENT_REGISTERED]: { agentId: string; capabilities: unknown[] };
  [CoreEventType.INTENT_RECEIVED]: any;
  [CoreEventType.AGENT_SELECTED]: { intent: any; agentId: string; memoryContext: any };
  [CoreEventType.INTENT_DISPATCHED]: { intent: any; agentId: string; duration: number };
  [CoreEventType.INTENT_DISPATCH_FAILED]: { intent: any; error: Error };
  [CoreEventType.ASSISTANT_RESPONSE]: { messageId: string; content: string; timestamp: number };
  [CoreEventType.STREAM_CHUNK]: {       // ✅ 新增：流式块载荷
    messageId: string;
    chunk: string;
  };
}

/**
 * 请求处理器类型（仅内核注册）
 */
export type RequestHandler<T extends CoreEventType> = (
  payload: CoreEventPayloadMap[T]
) => Promise<unknown> | unknown;

/**
 * 订阅处理器
 */
export type EventHandler<T extends AnyEventType = AnyEventType> = (
  event: BaseEvent<T>
) => void | Promise<void>;
