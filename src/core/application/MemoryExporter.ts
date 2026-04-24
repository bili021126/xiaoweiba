/**
 * 记忆导出器 - 负责记忆的全量检索和直接记录
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道导出/导入的细节
 * - 所有全量操作集中在此
 */

import { injectable, inject } from 'tsyringe';
import { IMemoryPort } from '../ports/IMemoryPort'; // ✅ 架构合规：依赖端口

@injectable()
export class MemoryExporter {
  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort
  ) {}

  /**
   * 检索所有情景记忆（用于导出等全量操作）
   */
  async retrieveAll(options?: { limit?: number }): Promise<any[]> {
    try {
      const limit = options?.limit || 1000;
      const memories = await this.memoryPort.retrieveAll({ limit });
      return memories;
    } catch (error) {
      console.error('[MemoryExporter] retrieveAll failed:', error);
      return [];
    }
  }

  /**
   * 直接记录一条记忆（用于导入等操作）
   */
  async recordMemory(record: {
    taskType: string;
    summary: string;
    entities: string[];
    outcome: string;
    modelId?: string;
    durationMs?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      return await this.memoryPort.recordMemory(record);
    } catch (error) {
      console.error('[MemoryExporter] recordMemory failed:', error);
      throw error;
    }
  }
}
