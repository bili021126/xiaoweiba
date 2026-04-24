/**
 * 语义检索器 - 负责执行混合检索与排序
 * 
 * 设计原则：委托而非塞入
 * - EpisodicMemory 不应该知道如何计算余弦相似度或 Jaccard 分数
 */

import { injectable, inject } from 'tsyringe';
import { IMemoryPort } from '../ports/IMemoryPort'; // ✅ 架构合规：依赖端口
import { MemoryQueryOptions } from '../memory/types';

@injectable()
export class SemanticRetriever {
  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort
  ) {}

  /**
   * 执行语义检索（L2 核心逻辑）
   */
  async search(query: string, options?: MemoryQueryOptions): Promise<any[]> {
    // ✅ 委托给 MemoryPort 执行检索，底层会自动处理意图分析和混合排序
    return await this.memoryPort.search(query, options);
  }
}
