/**
 * 记忆存储端口 - 抽象所有持久化存储能力
 * 
 * 设计原则：依赖倒置
 * - 上层应用只依赖此接口，不关心底层是 SQLite 还是云端 API
 */

import { EpisodicMemoryItem, PreferenceRecommendation } from '../domain/MemoryContext';

export interface EpisodicRecordInput {
  taskType: string;
  summary: string;
  entities: string[];
  outcome: string;
  modelId?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface MemoryQueryOptions {
  projectFingerprint?: string;
  taskType?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'finalWeight';
  sortOrder?: 'ASC' | 'DESC';
  sinceTimestamp?: number;
  memoryTier?: 'SHORT_TERM' | 'LONG_TERM';
}

export interface IMemoryStorage {
  // ========== 情景记忆 ==========
  recordEpisodic(input: EpisodicRecordInput): Promise<string>;
  retrieveEpisodic(options?: MemoryQueryOptions): Promise<EpisodicMemoryItem[]>;
  searchEpisodic(query: string, options?: MemoryQueryOptions): Promise<EpisodicMemoryItem[]>;
  
  // ========== 偏好记忆 ==========
  recordPreference(domain: string, pattern: Record<string, any>, confidence?: number): Promise<void>;
  getRecommendations(domain: string, context?: Record<string, any>): Promise<PreferenceRecommendation[]>;
  
  // ========== Agent 性能数据 ==========
  getAgentPerformance(agentId: string, intentName: string): Promise<{
    totalAttempts: number;
    successCount: number;
    avgDurationMs: number;
  }>;
  recordAgentExecution(agentId: string, intentName: string, success: boolean, durationMs: number): Promise<void>;
}
