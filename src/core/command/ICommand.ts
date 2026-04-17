/**
 * Command接口定义 - 所有命令的统一契约
 * 
 * 设计原则：
 * 1. Commands不直接依赖记忆模块
 * 2. 通过EventBus发布事件触发记忆记录
 * 3. 通过事件订阅获取记忆上下文
 */

import { EventBus, MemoryEventType, MemoryEvent } from '../eventbus/EventBus';

/**
 * Command执行结果
 */
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  durationMs?: number;
}

/**
 * Command输入参数（标准化）
 */
export interface CommandInput {
  /** 用户原始输入 */
  userInput?: string;
  
  /** 选中的代码 */
  selectedCode?: string;
  
  /** 文件路径 */
  filePath?: string;
  
  /** 编程语言 */
  language?: string;
  
  /** 额外上下文 */
  context?: Record<string, any>;
  
  [key: string]: any;
}

/**
 * Command基础接口
 */
export interface ICommand {
  /**
   * 执行命令
   * @param input 输入参数
   * @returns 执行结果
   */
  execute(input: CommandInput): Promise<CommandResult>;
  
  /**
   * 命令ID（唯一标识）
   */
  readonly commandId: string;
  
  /**
   * 命令描述
   */
  readonly description: string;
  
  /**
   * 清理资源
   */
  dispose?(): void | Promise<void>;
}

/**
 * Command基类 - 提供通用功能
 * 
 * 子类只需实现executeCore方法，基类处理：
 * - 事件发布
 * - 错误处理
 * - 性能监控
 * - 审计日志
 */
export abstract class BaseCommand implements ICommand {
  protected eventBus: EventBus;
  
  constructor(
    eventBus: EventBus,
    public readonly commandId: string,
    public readonly description: string
  ) {
    this.eventBus = eventBus;
  }
  
  /**
   * 执行命令（模板方法）
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 发布命令开始事件
      await this.publishEvent(MemoryEventType.ACTION_COMPLETED, {
        actionId: this.commandId,
        phase: 'started',
        input: this.sanitizeInput(input)
      });
      
      // 2. 检索记忆上下文（通过事件请求）
      const memoryContext = await this.requestMemoryContext(input);
      
      // 3. 执行核心逻辑
      const result = await this.executeCore(input, memoryContext);
      
      // 4. 计算耗时
      const durationMs = Date.now() - startTime;
      result.durationMs = durationMs;
      
      // 5. 发布完成事件
      await this.publishEvent(MemoryEventType.ACTION_COMPLETED, {
        actionId: this.commandId,
        phase: 'completed',
        success: result.success,
        durationMs,
        result: result.success ? result.data : undefined,
        error: result.error
      });
      
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // 发布错误事件
      await this.publishEvent(MemoryEventType.ACTION_COMPLETED, {
        actionId: this.commandId,
        phase: 'failed',
        error: error instanceof Error ? error.message : String(error),
        durationMs
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      };
    }
  }
  
  /**
   * 执行核心逻辑（子类实现）
   * 
   * @param input 输入参数
   * @param memoryContext 记忆上下文（由基类自动获取）
   * @returns 执行结果
   */
  protected abstract executeCore(
    input: CommandInput,
    memoryContext: MemoryContext
  ): Promise<CommandResult>;
  
  /**
   * 请求记忆上下文（通过事件总线）
   */
  private async requestMemoryContext(input: CommandInput): Promise<MemoryContext> {
    return new Promise((resolve) => {
      const context: MemoryContext = {};
      
      // 发布记忆检索请求
      this.eventBus.publish({
        type: MemoryEventType.RETRIEVED,
        timestamp: Date.now(),
        payload: {
          actionId: this.commandId,
          input: this.sanitizeInput(input)
        },
        source: this.commandId
      }).then(() => {
        // TODO: 实际应该等待MemorySystem响应并填充context
        // 当前简化实现，直接返回空context
        resolve(context);
      });
      
      return context;
    });
  }
  
  /**
   * 发布事件
   */
  protected async publishEvent(type: MemoryEventType, payload: any): Promise<void> {
    await this.eventBus.publish({
      type,
      timestamp: Date.now(),
      payload,
      source: this.commandId
    });
  }
  
  /**
   * 清理输入数据（防止敏感信息泄露到事件）
   */
  protected sanitizeInput(input: CommandInput): any {
    const sanitized = { ...input };
    
    // 移除可能包含敏感信息的字段
    if (sanitized.selectedCode && sanitized.selectedCode.length > 1000) {
      sanitized.selectedCode = sanitized.selectedCode.substring(0, 1000) + '...';
    }
    
    return sanitized;
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    // 子类可以重写
  }
}

/**
 * 记忆上下文（从事件总线获取）
 */
export interface MemoryContext {
  episodicMemories?: Array<{
    id: string;
    summary: string;
    taskType: string;
    timestamp: number;
  }>;
  
  preferenceRecommendations?: Array<{
    domain: string;
    pattern: Record<string, any>;
    confidence: number;
  }>;
  
  [key: string]: any;
}
