/**
 * 索引管理器 - 负责记忆的索引构建和维护
 * 
 * 职责：
 * 1. 构建倒排索引（summary + entities）
 * 2. 分词处理
 * 3. 索引查询（获取候选ID列表）
 * 4. 索引更新（增量添加/删除）
 */

import { EpisodicMemoryRecord } from './types';

export interface IndexEntry {
  term: string;
  memoryIds: Set<string>;
}

export class IndexManager {
  private index: Map<string, Set<string>> = new Map(); // term -> memoryIds
  private isInitialized: boolean = false;

  /**
   * 确保索引已初始化
   */
  async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    // 索引将在buildIndex时构建
    this.isInitialized = true;
  }

  /**
   * 构建索引（从数据库加载所有记忆）
   * @param memories 记忆记录列表
   * @param limit 最大索引数量
   */
  buildIndex(memories: EpisodicMemoryRecord[], limit: number = 2000): void {
    console.log(`[IndexManager] Building index for ${Math.min(memories.length, limit)} memories...`);
    
    this.index.clear();
    const memoriesToIndex = memories.slice(0, limit);
    
    for (const memory of memoriesToIndex) {
      this.addToIndex(memory.id, memory.summary);
      
      // 索引entities
      if (memory.entities && memory.entities.length > 0) {
        for (const entity of memory.entities) {
          this.addToIndex(memory.id, entity);
        }
      }
    }
    
    console.log(`[IndexManager] Index built: ${this.index.size} terms indexed`);
  }

  /**
   * 添加到索引
   * @param memoryId 记忆ID
   * @param text 要分词的文本
   */
  private addToIndex(memoryId: string, text: string): void {
    const terms = this.tokenize(text);
    
    for (const term of terms) {
      if (!this.index.has(term)) {
        this.index.set(term, new Set());
      }
      this.index.get(term)!.add(memoryId);
    }
  }

  /**
   * 增量添加记忆到索引（公共接口）
   * @param memory 记忆记录
   */
  addMemoryToIndex(memory: EpisodicMemoryRecord): void {
    this.addToIndex(memory.id, memory.summary);
    
    // 索引entities
    if (memory.entities && memory.entities.length > 0) {
      for (const entity of memory.entities) {
        this.addToIndex(memory.id, entity);
      }
    }
  }

  /**
   * 从索引中移除
   * @param memoryId 记忆ID
   */
  removeFromIndex(memoryId: string): void {
    for (const [term, memoryIds] of this.index.entries()) {
      memoryIds.delete(memoryId);
      if (memoryIds.size === 0) {
        this.index.delete(term);
      }
    }
  }

  /**
   * 获取候选记忆ID列表
   * @param query 查询文本
   * @returns 候选记忆ID集合
   */
  getCandidateIds(query: string): Set<string> {
    const terms = this.tokenize(query);
    const candidateIds = new Set<string>();
    
    for (const term of terms) {
      const memoryIds = this.index.get(term);
      if (memoryIds) {
        for (const id of memoryIds) {
          candidateIds.add(id);
        }
      }
    }
    
    return candidateIds;
  }

  /**
   * 分词（简单实现：按空格和标点分割）
   * @param text 输入文本
   * @returns 词项列表
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    
    // 转为小写，按非字母数字字符分割
    const tokens = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')  // 保留中文
      .split(/\s+/)
      .filter(token => token.length > 0);
    
    // 去重
    return [...new Set(tokens)];
  }

  /**
   * 获取索引统计信息
   */
  getStats(): { termCount: number; totalEntries: number } {
    let totalEntries = 0;
    for (const memoryIds of this.index.values()) {
      totalEntries += memoryIds.size;
    }
    
    return {
      termCount: this.index.size,
      totalEntries
    };
  }

  /**
   * 清空索引
   */
  clear(): void {
    this.index.clear();
    this.isInitialized = false;
  }
}
