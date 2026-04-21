/**
 * 本地记忆存储适配器 - 基于 EpisodicMemory 和 PreferenceMemory 实现 IMemoryStorage
 * 
 * 职责：将底层的记忆模块适配为统一的存储端口
 */

import { injectable, inject } from 'tsyringe';
import { IMemoryStorage, EpisodicRecordInput, MemoryQueryOptions } from '../../core/ports/IMemoryStorage';
import { EpisodicMemory } from '../../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../core/memory/PreferenceMemory';
import { EpisodicMemoryItem, PreferenceRecommendation } from '../../core/domain/MemoryContext';

@injectable()
export class LocalMemoryStorage implements IMemoryStorage {
  // Agent 性能数据暂时使用内存存储（后续可持久化）
  private agentPerformance = new Map<string, { totalAttempts: number; successCount: number; totalDurationMs: number }>();

  constructor(
    @inject(EpisodicMemory) private episodic: EpisodicMemory,
    @inject(PreferenceMemory) private preference: PreferenceMemory
  ) {}

  async recordEpisodic(input: EpisodicRecordInput): Promise<string> {
    return await this.episodic.record({
      taskType: input.taskType as any,
      summary: input.summary,
      entities: input.entities,
      outcome: input.outcome as any,
      modelId: input.modelId || 'unknown',
      durationMs: input.durationMs || 0,
      metadata: input.metadata
    });
  }

  async retrieveEpisodic(options?: MemoryQueryOptions): Promise<EpisodicMemoryItem[]> {
    const records = await this.episodic.retrieve(options as any);
    return records.map(r => this.toMemoryItem(r));
  }

  async searchEpisodic(query: string, options?: MemoryQueryOptions): Promise<EpisodicMemoryItem[]> {
    const records = await this.episodic.search(query, options as any);
    return records.map(r => this.toMemoryItem(r));
  }

  async recordPreference(domain: string, pattern: Record<string, any>, confidence?: number): Promise<void> {
    await this.preference.recordPreference(domain as any, pattern, true);
  }

  async getRecommendations(domain: string, context?: Record<string, any>): Promise<PreferenceRecommendation[]> {
    const recs = await this.preference.getRecommendations(domain as any, context || {});
    return recs.map(r => ({
      domain: r.record.domain,
      pattern: r.record.pattern,
      confidence: r.record.confidence
    }));
  }

  async getAgentPerformance(agentId: string, intentName: string): Promise<{ totalAttempts: number; successCount: number; avgDurationMs: number }> {
    const key = `${agentId}::${intentName}`;
    const perf = this.agentPerformance.get(key) || { totalAttempts: 0, successCount: 0, totalDurationMs: 0 };
    return {
      totalAttempts: perf.totalAttempts,
      successCount: perf.successCount,
      avgDurationMs: perf.totalAttempts > 0 ? perf.totalDurationMs / perf.totalAttempts : 0
    };
  }

  async recordAgentExecution(agentId: string, intentName: string, success: boolean, durationMs: number): Promise<void> {
    const key = `${agentId}::${intentName}`;
    const existing = this.agentPerformance.get(key) || { totalAttempts: 0, successCount: 0, totalDurationMs: 0 };
    existing.totalAttempts++;
    if (success) existing.successCount++;
    existing.totalDurationMs += durationMs;
    this.agentPerformance.set(key, existing);
  }

  private toMemoryItem(record: any): EpisodicMemoryItem {
    return {
      id: record.id,
      summary: record.summary,
      taskType: record.taskType,
      timestamp: record.timestamp,
      entities: record.entities || []
    };
  }
}
