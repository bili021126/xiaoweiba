import { EpisodicMemoryRecord } from './types';

/**
 * 记忆去重器
 * 基于Jaccard相似度去除重复或高度相似的记忆
 */
export interface DeduplicationConfig {
  similarityThreshold: number; // 相似度阈值（0-1），超过此值视为重复
  maxResults: number; // 最大返回结果数
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  similarityThreshold: 0.8,
  maxResults: 20
};

export class MemoryDeduplicator {
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 对记忆列表进行去重
   * @param memories 待去重的记忆列表
   * @returns 去重后的记忆列表
   */
  deduplicate(memories: EpisodicMemoryRecord[]): EpisodicMemoryRecord[] {
    if (memories.length <= 1) {
      return memories;
    }

    const result: EpisodicMemoryRecord[] = [];
    const seenIds = new Set<string>();

    for (const memory of memories) {
      // 跳过已处理的ID
      if (seenIds.has(memory.id)) {
        continue;
      }

      // 检查是否与已有结果高度相似
      const isDuplicate = result.some(existing => {
        const similarity = this.calculateJaccardSimilarity(memory, existing);
        return similarity >= this.config.similarityThreshold;
      });

      if (!isDuplicate) {
        result.push(memory);
        seenIds.add(memory.id);
      }
    }

    // 限制返回数量
    return result.slice(0, this.config.maxResults);
  }

  /**
   * 计算两个记忆的Jaccard相似度
   * 基于entities和summary的词汇集合
   */
  private calculateJaccardSimilarity(
    mem1: EpisodicMemoryRecord,
    mem2: EpisodicMemoryRecord
  ): number {
    // 提取词汇集合
    const set1 = this.extractTerms(mem1);
    const set2 = this.extractTerms(mem2);

    if (set1.size === 0 && set2.size === 0) {
      return 1.0;
    }

    if (set1.size === 0 || set2.size === 0) {
      return 0.0;
    }

    // 计算交集
    let intersection = 0;
    for (const term of set1) {
      if (set2.has(term)) {
        intersection++;
      }
    }

    // 计算并集
    const union = set1.size + set2.size - intersection;

    // Jaccard相似度 = 交集 / 并集
    return intersection / union;
  }

  /**
   * 从记忆中提取术语集合
   */
  private extractTerms(memory: EpisodicMemoryRecord): Set<string> {
    const terms = new Set<string>();

    // 添加entities
    if (memory.entities && memory.entities.length > 0) {
      memory.entities.forEach(entity => {
        const normalized = entity.toLowerCase().trim();
        if (normalized.length > 0) {
          terms.add(normalized);
        }
      });
    }

    // 添加summary中的关键词（分词）
    if (memory.summary) {
      const words = memory.summary
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1); // 过滤单字符
      
      words.forEach(word => terms.add(word));
    }

    return terms;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }
}
