/**
 * Agent类型枚举
 */
export type AgentType = 'CHAT' | 'CODE_GENERATION' | 'TEST_GENERATION' | 'SQL_OPTIMIZATION' | 'CUSTOM';

/**
 * Agent能力描述
 */
export interface AgentCapability {
  type: AgentType;
  description: string;
  supportedTools: string[];
}

/**
 * Agent抽象接口
 * 
 * 所有Agent必须实现此接口，确保统一的行为契约
 */
export interface IAgent {
  /**
   * Agent唯一标识
   */
  readonly id: string;

  /**
   * Agent名称
   */
  readonly name: string;

  /**
   * Agent能力描述
   */
  readonly capabilities: AgentCapability[];

  /**
   * 初始化Agent
   */
  initialize(): Promise<void>;

  /**
   * 执行任务
   * @param input 任务输入
   * @param context 执行上下文
   * @returns 任务结果
   */
  execute(input: any, context?: Record<string, any>): Promise<any>;

  /**
   * 销毁Agent，释放资源
   */
  destroy(): Promise<void>;

  /**
   * 检查Agent是否可用
   */
  isAvailable(): boolean;
}

/**
 * Agent注册信息
 */
export interface AgentRegistration {
  agent: IAgent;
  priority: number; // 优先级，数值越小优先级越高
  autoActivate: boolean; // 是否自动激活
}
