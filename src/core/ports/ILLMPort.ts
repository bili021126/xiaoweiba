/**
 * LLM端口 - 大语言模型能力的抽象
 * 
 * 设计原则：
 * 1. 应用层只依赖此接口，不依赖具体LLM实现
 * 2. 基础设施层提供DeepSeek/OpenAI等适配器
 * 3. 统一的调用接口，隐藏底层差异
 */

/**
 * LLM消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * LLM消息
 */
export interface LLMMessage {
  role: MessageRole;
  content: string;
}

/**
 * LLM调用参数
 */
export interface LLMCallOptions {
  /** 消息列表 */
  messages: LLMMessage[];
  
  /** 最大token数 */
  maxTokens?: number;
  
  /** 温度（0-1） */
  temperature?: number;
  
  /** Top-p采样 */
  topP?: number;
  
  /** 停止序列 */
  stopSequences?: string[];
  
  /** 流式输出 */
  stream?: boolean;
  
  /** 模型ID（可选，由适配器决定） */
  modelId?: string;
}

/**
 * LLM调用结果
 */
export interface LLMCallResult {
  /** 是否成功 */
  success: boolean;
  
  /** 生成的文本 */
  text?: string;
  
  /** 使用的token数 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** 错误信息 */
  error?: string;
  
  /** 耗时（ms） */
  durationMs?: number;
  
  /** 模型ID */
  modelId?: string;
}

/**
 * 流式输出回调
 */
export type StreamCallback = (chunk: string) => void | Promise<void>;

/**
 * LLM端口接口
 * 
 * 职责：
 * 1. 提供统一的LLM调用接口
 * 2. 支持同步和流式调用
 * 3. 隐藏底层LLM提供商差异
 */
export interface ILLMPort {
  /**
   * 调用LLM（同步模式）
   * @param options 调用选项
   * @returns 调用结果
   */
  call(options: LLMCallOptions): Promise<LLMCallResult>;

  /**
   * 调用LLM（流式模式）
   * @param options 调用选项
   * @param onChunk 流式输出回调
   * @returns 调用结果（不含text，通过onChunk接收）
   */
  callStream(options: LLMCallOptions, onChunk: StreamCallback): Promise<Omit<LLMCallResult, 'text'>>;

  /**
   * 检查LLM服务可用性
   * @returns 是否可用
   */
  isAvailable(): Promise<boolean>;

  /**
   * 获取当前配置的模型ID
   * @returns 模型ID
   */
  getModelId(): string;

  /**
   * 清理资源
   */
  dispose(): void;
}
