/**
 * 权重计算器 - 负责记忆权重的动态计算
 * 
 * 设计原则：单一职责
 * - EpisodicMemory 不应该包含复杂的数学公式
 */

import { injectable } from 'tsyringe';
import { EpisodicMemoryRecord, MemoryQueryOptions, TaskOutcome } from '../memory/types';

@injectable()
export class WeightCalculator {
  
  /**
   * 计算初始权重（基于任务结果）
   */
  calculateInitialWeight(outcome: TaskOutcome): number {
    switch (outcome) {
      case 'SUCCESS': return 8;
      case 'PARTIAL': return 5;
      case 'FAILED': return 2;
      case 'CANCELLED': return 1;
      default: return 5;
    }
  }

  /**
   * 计算记忆的动态权重（考虑时间衰减和意图匹配）
   */
  calculateDynamicWeight(
    memory: EpisodicMemoryRecord, 
    queryVector?: { temporal: number; entity: number; semantic: number; distantTemporal: number }
  ): number {
    let weight = memory.finalWeight || 1.0;

    // 1. 时间衰减逻辑
    const ageInDays = (Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-0.1 * ageInDays); // 简单的指数衰减
    weight *= decayFactor;

    // 2. 意图向量加成
    if (queryVector) {
      if (queryVector.temporal > 0.7 && ageInDays < 1) weight *= 1.2;
      if (queryVector.entity > 0.7 && memory.entities.length > 0) weight *= 1.3;
    }

    return weight;
  }
}
