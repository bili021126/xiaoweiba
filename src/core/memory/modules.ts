/**
 * 记忆模块 - 解耦后的子模块导出
 * 
 * 架构原则：中心化协调 + 分布式职责
 * - EpisodicMemory: 协调中心
 * - IndexManager: 索引管理
 * - SearchEngine: 搜索引擎
 * - FeedbackRecorder: 反馈记录
 * - MemoryTierManager: 层级管理
 * - MemoryDeduplicator: 去重器
 * - MemoryArchiver: 归档器
 */

export { IndexManager } from './IndexManager';
export { SearchEngine } from './SearchEngine';
export { FeedbackRecorder } from './FeedbackRecorder';
export { MemoryTierManager } from './MemoryTierManager';
export { MemoryDeduplicator } from './MemoryDeduplicator';
export { MemoryArchiver } from './MemoryArchiver';

// 类型导出
export type { 
  TaskType, 
  TaskOutcome, 
  EpisodicMemoryRecord, 
  MemoryQueryOptions, 
  MemoryTier,
  RetrievalWeights 
} from './types';
