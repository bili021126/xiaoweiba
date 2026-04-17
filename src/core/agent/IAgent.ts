/**
 * Agent接口定义 - 可插拔的专用大脑
 * 
 * 每个Agent是一个独立的"专家"，有自己的推理能力和工具集。
 * 记忆系统通过调度器选择合适的Agent来执行任务。
 */

import { MemoryContext } from '../memory/MemorySystem';

/**
 * Agent执行结果
 */
export interface AgentResult {
  /** 是否成功 */
  success: boolean;
  
  /** 结果数据 */
  data?: any;
  
  /** 错误信息 */
  error?: string;
  
  /** 执行耗时（ms） */
  durationMs?: number;
  
  /** 使用的模型ID */
  modelId?: string;
  
  /** Token使用情况 */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Agent能力描述
 */
export interface AgentCapability {
  /** 能力名称（如 'explain', 'generate', 'test'） */
  name: string;
  
  /** 能力描述 */
  description: string;
  
  /** 适用的语言/场景 */
  applicableScenarios?: string[];
  
  /** 优先级（数字越大越优先） */
  priority?: number;
}

/**
 * Agent元数据
 */
export interface AgentMetadata {
  /** Agent唯一标识 */
  id: string;
  
  /** Agent显示名称 */
  name: string;
  
  /** Agent描述 */
  description?: string;
  
  /** 版本号 */
  version?: string;
  
  /** 作者 */
  author?: string;
  
  /** 能力列表 */
  capabilities: AgentCapability[];
  
  /** 注册时问 */
  registeredAt: number;
}

/**
 * Agent输入参数
 */
export interface AgentInput {
  /** 用户原始输入/请求 */
  userInput?: string;
  
  /** 选中的代码 */
  selectedCode?: string;
  
  /** 文件路径 */
  filePath?: string;
  
  /** 编程语言 */
  language?: string;
  
  /** 额外上下文 */
  context?: Record<string, any>;
  
  /** 自定义参数 */
  [key: string]: any;
}

/**
 * Agent接口
 * 
 * 所有Agent必须实现此接口，以便被调度器统一管理。
 */
export interface IAgent {
  /**
   * Agent元数据
   */
  readonly metadata: AgentMetadata;
  
  /**
   * 执行Agent任务
   * 
   * @param input 输入参数
   * @param memoryContext 记忆上下文（由记忆系统自动注入）
   * @returns 执行结果
   */
  execute(input: AgentInput, memoryContext: MemoryContext): Promise<AgentResult>;
  
  /**
   * 检查Agent是否可用
   * 
   * @returns 是否可用
   */
  isAvailable(): boolean | Promise<boolean>;
  
  /**
   * 获取Agent的能力描述（用于调度决策）
   * 
   * @returns 能力列表
   */
  getCapabilities(): AgentCapability[];
  
  /**
   * 清理资源
   */
  dispose?(): void | Promise<void>;
}

/**
 * Agent工厂函数类型
 */
export type AgentFactory = () => IAgent | Promise<IAgent>;

/**
 * Agent注册信息
 */
export interface AgentRegistration {
  /** Agent实例或工厂函数 */
  agent: IAgent | AgentFactory;
  
  /** 是否启用 */
  enabled?: boolean;
  
  /** 配置选项 */
  config?: Record<string, any>;
}
