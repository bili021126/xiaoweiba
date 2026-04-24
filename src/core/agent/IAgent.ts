/**
 * Agent接口 - 所有Agent必须实现此接口
 */

import { Intent } from '../domain/Intent';
import { MemoryContext } from '../domain/MemoryContext';

/**
 * Agent能力定义
 */
export interface AgentCapability {
  /** 能力名称（如 'explain', 'generate'） */
  name: string;
  /** 能力描述 */
  description: string;
  /** 优先级（数值越大优先级越高） */
  priority?: number;
}

/**
 * Agent元数据
 */
export interface AgentMetadata {
  /** Agent版本 */
  version: string;
  /** Agent作者 */
  author?: string;
  /** Agent描述 */
  description?: string;
  /** 标签 */
  tags?: string[];
}

/**
 * Agent注册信息
 */
export interface AgentRegistration {
  /** Agent实例或工厂函数 */
  agent: IAgent | (() => Promise<IAgent>);
  /** 是否启用 */
  enabled?: boolean;
  /** 配置选项 */
  config?: Record<string, any>;
}

/**
 * Agent输入参数
 */
export interface AgentInput {
  /** 意图 */
  intent: Intent;
  /** 记忆上下文 */
  memoryContext: MemoryContext;
  /** 额外参数（明确定义的可选字段） */
  options?: Record<string, unknown>;
}

/**
 * ✅ P1: Agent执行上下文（用于类型安全）
 * 替代 any 类型，提升代码可维护性
 */
export interface IAgentContext {
  /** 意图对象 */
  intent: Intent;
  /** 记忆上下文 */
  memoryContext: MemoryContext;
}

/**
 * Agent执行结果（泛型）
 */
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  modelId?: string;
  durationMs?: number;
  
  // ✅ P1-02: 记忆元数据（用于情景记忆记录）
  memoryMetadata?: {
    taskType: string;        // 任务类型（如 'CHAT_COMMAND', 'SESSION_MANAGEMENT'）
    summary: string;         // 操作摘要
    entities?: string[];     // 相关实体（文件名、会话ID等）
    outcome?: 'SUCCESS' | 'FAILED' | 'PARTIAL'; // 执行结果
  };
}

/**
 * Agent工厂函数类型
 */
export type AgentFactory = () => Promise<IAgent>;

/**
 * Agent接口
 */
export interface IAgent {
  /** Agent唯一标识 */
  readonly id: string;
  
  /** Agent名称 */
  readonly name: string;
  
  /** 能处理的意图列表 */
  readonly supportedIntents: string[];
  
  /** Agent元数据 */
  readonly metadata?: AgentMetadata;
  
  /**
   * 初始化Agent（可选）
   * @returns Promise<void>
   */
  initialize?(): Promise<void>;
  
  /**
   * 获取Agent能力列表
   * @returns 能力列表
   */
  getCapabilities(): AgentCapability[];
  
  /**
   * 检查Agent是否可用
   * @returns 是否可用（默认返回true）
   */
  isAvailable?(): Promise<boolean>;
  
  /**
   * 执行Agent
   * @param params 执行参数
   * @returns 执行结果
   */
  execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult>;
  
  /**
   * 清理资源（默认空实现）
   */
  dispose?(): Promise<void>;
}
