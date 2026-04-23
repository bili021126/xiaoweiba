/**
 * 命令基类 - 所有命令的统一入口
 * 
 * 设计原则：
 * 1. 所有命令必须继承此类
 * 2. 通过 executeCore 接受 MemoryContext（由 MemorySystem 自动注入）
 * 3. 禁止直接依赖 MemoryService，确保“记忆为核、先记忆后行动”
 */

import { IEventBus } from '../ports/IEventBus'; // ✅ 修复 #33：使用新的事件总线
import { MemorySystem, MemoryContext } from '../memory/MemorySystem';
// ✅ 新增：引入重构后的模块
import { CommandExecutor, CommandInput, CommandResult } from './CommandExecutor';
import { EventPublisher } from './EventPublisher';

export { CommandInput, CommandResult }; // 重新导出类型，保持向后兼容

export abstract class BaseCommand extends CommandExecutor {
  private eventPublisher: EventPublisher;

  constructor(
    memorySystem: MemorySystem,
    eventBus: IEventBus, // ✅ 修复 #33：使用新的事件总线
    commandId: string
  ) {
    super(memorySystem, commandId);
    // ✅ 新增：初始化事件发布器
    this.eventPublisher = new EventPublisher(eventBus);
  }

  /**
   * ✅ 重写execute方法，添加事件发布逻辑
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 调用父类的执行流程（检索记忆 + 执行核心逻辑）
      const result = await super.execute(input);

      // 2. 发布成功事件
      const durationMs = Date.now() - startTime;
      this.eventPublisher.publishTaskCompleted(this.commandId, result, durationMs);

      return result;
    } catch (error) {
      // 3. 发布失败事件
      const durationMs = Date.now() - startTime;
      this.eventPublisher.publishTaskFailed(
        this.commandId,
        error instanceof Error ? error : new Error(String(error)),
        durationMs
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      };
    }
  }
}