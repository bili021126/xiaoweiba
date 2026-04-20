/**
 * 命令执行器 - 负责命令的执行流程控制
 * 
 * 职责：
 * 1. 检索记忆上下文（根据requiresMemoryContext标志）
 * 2. 调用子类的executeCore方法
 * 3. 计算执行耗时
 */

import { MemorySystem, MemoryContext } from '../memory/MemorySystem';

export interface CommandInput {
  /** 命令特定参数（明确定义的可选字段） */
  options?: Record<string, unknown>;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs?: number;
  memoryMetadata?: {
    taskType: string;
    summary: string;
    entities: string[];
  };
}

export abstract class CommandExecutor {
  protected memorySystem: MemorySystem;

  // ✅ 标记是否需要记忆上下文（默认需要）
  protected requiresMemoryContext = true;

  constructor(
    memorySystem: MemorySystem,
    public readonly commandId: string
  ) {
    this.memorySystem = memorySystem;
  }

  /**
   * 执行命令的核心流程
   * @param input 输入参数
   * @returns 执行结果
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 根据标志决定是否检索记忆上下文
      const memoryContext = this.requiresMemoryContext 
        ? await this.retrieveMemoryContext(input)
        : {};

      // 2. 执行核心逻辑
      const result = await this.executeCore(input, memoryContext);

      // 3. 计算耗时
      const durationMs = Date.now() - startTime;
      result.durationMs = durationMs;

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      };
    }
  }

  /**
   * 获取记忆上下文的统一入口
   * @param input 输入参数
   * @returns 记忆上下文
   */
  protected async retrieveMemoryContext(input: CommandInput): Promise<MemoryContext> {
    return await this.memorySystem.retrieveRelevant(this.commandId, input);
  }

  /**
   * 核心执行逻辑（子类必须实现）
   * @param input 输入参数
   * @param context 记忆上下文
   * @returns 执行结果
   */
  protected abstract executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult>;

  dispose(): void {}
}
