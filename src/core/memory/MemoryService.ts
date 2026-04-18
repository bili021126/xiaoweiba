/**
 * MemoryService - 已废弃（保留用于向后兼容）
 * 
 * @deprecated 请使用 MemorySystem + BaseCommand 架构
 * 
 * 迁移指南：
 * 1. 所有 Command 应继承 BaseCommand
 * 2. 通过 executeCore(input, context: MemoryContext) 接收记忆上下文
 * 3. 禁止直接依赖此服务
 * 
 * 重构进度：
 * ✅ ExplainCodeCommand 已完成迁移
 * ⏸️ GenerateCommitCommand、ExportMemoryCommand、ImportMemoryCommand、CheckNamingCommand、CodeGenerationCommand 待迁移
 */

import { EpisodicMemory } from './EpisodicMemory';

export class MemoryService {
  constructor(episodicMemory?: EpisodicMemory) {
    console.warn('[MemoryService] DEPRECATED: This service is deprecated. Please use MemorySystem + BaseCommand architecture.');
  }

  async searchMemories(query: string, taskType?: string, limit?: number): Promise<any[]> {
    console.warn('[MemoryService] DEPRECATED METHOD');
    return [];
  }

  async recordMemory(params: any): Promise<string> {
    console.warn('[MemoryService] DEPRECATED METHOD');
    return '';
  }

  async getRecentMemories(limit?: number): Promise<any[]> {
    console.warn('[MemoryService] DEPRECATED METHOD');
    return [];
  }

  async getStats(): Promise<any> {
    console.warn('[MemoryService] DEPRECATED METHOD');
    return { totalCount: 0 };
  }

  async searchByEntity(entity: string, limit?: number): Promise<any[]> {
    console.warn('[MemoryService] DEPRECATED METHOD');
    return [];
  }
}
