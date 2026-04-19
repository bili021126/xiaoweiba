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
  /** 额外参数 */
  [key: string]: any;
}

/**
 * Agent执行结果
 */
export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  modelId?: string;
  durationMs?: number;
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
   * 获取Agent能力列表
   * @returns 能力列表
   */
  getCapabilities(): AgentCapability[];
  
  /**
   * 检查Agent是否可用
   * @returns 是否可用
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
   * 清理资源
   */
  dispose?(): Promise<void>;
}
