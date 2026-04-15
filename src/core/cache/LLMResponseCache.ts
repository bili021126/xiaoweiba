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

  /**
   * 生成缓存键
   */
  private generateKey(prompt: string, modelId?: string): string {
    const key = `${modelId || 'default'}:${prompt}`;
    // 使用简单的hash避免key过长
    return this.hashString(key);
  }

  /**
   * 简单字符串哈希
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
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
}
