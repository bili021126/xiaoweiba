/**
 * LLM响应缓存
 * 
 * 用于缓存LLM的响应结果，避免重复调用API
 */

import { injectable } from 'tsyringe';

interface CacheEntry {
  data: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@injectable()
export class LLMResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟默认TTL
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存条目数
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // ✅ 启动定期清理定时器（每5分钟清理一次过期条目）
    this.cleanupTimer = setInterval(() => {
      this.clearExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * ✅ 生成缓存键（直接使用prompt，移除哈希避免碰撞风险）
   */
  private generateKey(prompt: string, modelId?: string): string {
    // Map支持任意字符串键，无需哈希，避免DJB2碰撞风险
    return `${modelId || 'default'}:${prompt.substring(0, 500)}`; // 截断超长prompt防止key过大
  }

  /**
   * 获取缓存
   */
  get(prompt: string, modelId?: string): string | null {
    const key = this.generateKey(prompt, modelId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    console.log('[LLMResponseCache] Cache hit for key:', key.substring(0, 8));
    return entry.data;
  }

  /**
   * 设置缓存
   */
  set(prompt: string, data: string, modelId?: string, ttl?: number): void {
    const key = this.generateKey(prompt, modelId);

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });

    console.log('[LLMResponseCache] Cache set for key:', key.substring(0, 8), 'Size:', this.cache.size);
  }

  /**
   * 清除过期的缓存条目
   */
  clearExpired(): void {
    const now = Date.now();
    let clearedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      console.log('[LLMResponseCache] Cleared', clearedCount, 'expired entries');
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('[LLMResponseCache] Cache cleared, removed', size, 'entries');
  }

  /**
   * 删除最旧的缓存条目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('[LLMResponseCache] Evicted oldest entry');
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).slice(0, 10) // 只返回前10个key
    };
  }

  /**
   * ✅ 清理资源（插件停用时调用）
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      console.log('[LLMResponseCache] Cleanup timer stopped');
    }
  }
}
