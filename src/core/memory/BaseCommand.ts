/**
 * 命令基类 - 所有命令的统一入口
 * 
 * 设计原则：
 * 1. 所有命令必须继承此类
 * 2. 通过 executeCore 接受 MemoryContext（由 MemorySystem 自动注入）
 * 3. 禁止直接依赖 MemoryService，确保“记忆为核、先记忆后行动”
 * 
 * ⚠️ 注意：此类已废弃，新架构使用 Agent + IntentDispatcher
 * ✅ 修复 #33：移除事件发布逻辑（由 AgentRunner 统一处理）
 */

import { MemorySystem, MemoryContext } from '../memory/MemorySystem';
import { CommandExecutor, CommandInput, CommandResult } from './CommandExecutor';

export { CommandInput, CommandResult };

export abstract class BaseCommand extends CommandExecutor {
  constructor(
    memorySystem: MemorySystem,
    commandId: string
  ) {
    super(memorySystem, commandId);
  }

  /**
   * ✅ 重写execute方法，移除事件发布逻辑
   * ⚠️ 新架构中事件由 AgentRunner 发布
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    // 直接调用父类的执行流程（检索记忆 + 执行核心逻辑）
    return await super.execute(input);
  }
}