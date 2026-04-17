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

  // 系统相关
  CONFIG_UPDATED = 'config.updated',
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
  [CoreEventType.TASK_COMPLETED]: { actionId: string; result: unknown; durationMs: number };
  [CoreEventType.CONFIG_UPDATED]: { key: string; oldValue: unknown; newValue: unknown };
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
