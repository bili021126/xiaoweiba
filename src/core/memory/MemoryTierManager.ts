/**
 * 记忆层级管理器
 * 负责短期/长期记忆的自动分类和迁移
 */
export type MemoryTier = 'SHORT_TERM' | 'LONG_TERM';

export interface MemoryTierConfig {
  shortTermDays: number; // 短期记忆天数阈值
}

const DEFAULT_CONFIG: MemoryTierConfig = {
  shortTermDays: 7
};

export class MemoryTierManager {
  private config: MemoryTierConfig;

  constructor(config: Partial<MemoryTierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 根据时间戳判断记忆层级
   * @param timestamp 记忆创建时间戳
   * @returns SHORT_TERM（阈值内）或 LONG_TERM（超过阈值）
   */
  determineTier(timestamp: number): MemoryTier {
    const thresholdMs = this.config.shortTermDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - thresholdMs;
    return timestamp >= cutoffTime ? 'SHORT_TERM' : 'LONG_TERM';
  }

  /**
   * 获取短期记忆的截止时间戳
   */
  getShortTermCutoff(): number {
    const thresholdMs = this.config.shortTermDays * 24 * 60 * 60 * 1000;
    return Date.now() - thresholdMs;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MemoryTierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): MemoryTierConfig {
    return { ...this.config };
  }
}
