/**
 * 命令基类 - 所有命令的统一入口
 * 
 * 设计原则：
 * 1. 所有命令必须继承此类
 * 2. 通过 executeCore 接受 MemoryContext（由 MemorySystem 自动注入）
 * 3. 禁止直接依赖 MemoryService，确保"记忆为核、先记忆后行动"
 */

import { EventBus, CoreEventType } from '../eventbus/EventBus';
import { MemorySystem, MemoryContext } from '../memory/MemorySystem';

export interface CommandInput {
  [key: string]: any;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  durationMs?: number;
  // ✅ 新增：由 Command 提供的记忆元数据
  memoryMetadata?: {
    taskType: string;
    summary: string;
    entities: string[];
  };
}

export abstract class BaseCommand {
  protected eventBus: EventBus;
  protected memorySystem: MemorySystem;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus,
    public readonly commandId: string
  ) {
    this.memorySystem = memorySystem;
    this.eventBus = eventBus;
  }

  /**
   * 命令执行的统一入口（由 MemorySystem 调用）
   * 
   * @param input 输入参数
   * @returns 执行结果
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // 1. 直接调用 MemorySystem 获取上下文
      const memoryContext = await this.retrieveMemoryContext(input);

      // 2. 执行核心逻辑
      const result = await this.executeCore(input, memoryContext);

      const durationMs = Date.now() - startTime;
      result.durationMs = durationMs;

      // 3. 发布完成事件（触发自动记忆记录）
      console.log(`[BaseCommand] Publishing TASK_COMPLETED for ${this.commandId}, duration: ${durationMs}ms`);
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId: this.commandId,
        result: {
          success: result.success,
          data: result.data,
          error: result.error
        },
        durationMs,
        memoryMetadata: result.memoryMetadata  // ✅ 传递元数据
      }, { source: this.commandId });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId: this.commandId,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        durationMs
        // 失败时不记录记忆元数据
      }, { source: this.commandId });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      };
    }
  }

  /**
   * 获取记忆上下文的统一入口。
   * 未来若需切换为 EventBus 请求模式，只需重写此方法。
   */
  protected async retrieveMemoryContext(input: CommandInput): Promise<MemoryContext> {
    return await this.memorySystem.retrieveRelevant(this.commandId, input);
  }

  /**
   * 核心执行逻辑（子类必须实现）
   * 
   * @param input 输入参数
   * @param context 记忆上下文（包含相关记忆和偏好）
   * @returns 执行结果
   */
  protected abstract executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult>;

  dispose(): void {}
}
