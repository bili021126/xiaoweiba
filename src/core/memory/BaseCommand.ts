/**
 * 命令基类 - 所有命令的统一入口
 * 
 * 设计原则：
 * 1. 所有命令必须继承此类
 * 2. 通过 executeCore 接受 MemoryContext（由 MemorySystem 自动注入）
 * 3. 禁止直接依赖 MemoryService，确保"记忆为核、先记忆后行动"
 */

import { MemoryContext } from '../memory/MemorySystem';

export abstract class BaseCommand {
  /**
   * 命令执行的统一入口（由 MemorySystem 调用）
   * 
   * @param input 输入参数（由调用方提供）
   * @param context 记忆上下文（由 MemorySystem 自动注入）
   * @returns 执行结果
   */
  async execute(input: any, context: MemoryContext): Promise<any> {
    try {
      console.log(`[BaseCommand] Executing ${this.constructor.name} with ${context.episodicMemories?.length || 0} memories`);
      
      // 调用子类实现的核心逻辑
      return await this.executeCore(input, context);
    } catch (error) {
      console.error(`[BaseCommand] Execution failed:`, error);
      throw error;
    }
  }

  /**
   * 核心执行逻辑（子类必须实现）
   * 
   * @param input 输入参数
   * @param context 记忆上下文（包含相关记忆和偏好）
   * @returns 执行结果
   */
  protected abstract executeCore(input: any, context: MemoryContext): Promise<any>;
}
