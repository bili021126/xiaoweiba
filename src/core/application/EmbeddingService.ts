/**
 * 嵌入服务 - 负责文本向量化与相似度计算
 * 
 * 设计原则：委托而非塞入
 * - EpisodicMemory 不应该知道如何调用 Embedding API
 */

import { injectable, inject } from 'tsyringe';
import { ConfigManager } from '../../storage/ConfigManager';
import { pipeline, env } from '@xenova/transformers';

// 配置 Transformers.js 不使用本地缓存路径，避免权限问题
env.allowLocalModels = false;
env.useBrowserCache = false;

@injectable()
export class EmbeddingService {
  private enabled = false;
  private extractor: any = null; // 模型提取器
  private isModelLoading = false;

  constructor(@inject(ConfigManager) private configManager: ConfigManager) {
    this.initialize();
  }

  private initialize() {
    const config = this.configManager.getConfig();
    this.enabled = config.memory?.enableVectorSearch ?? false;
  }

  /**
   * 懒加载模型（首次调用时触发）
   */
  private async getModel() {
    if (this.extractor) return this.extractor;
    if (this.isModelLoading) {
      // 如果正在加载，等待一小会儿再重试
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.extractor;
    }

    this.isModelLoading = true;
    try {
      console.log('[EmbeddingService] Loading local model: Xenova/all-MiniLM-L6-v2...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[EmbeddingService] Local model loaded successfully.');
    } catch (error) {
      console.error('[EmbeddingService] Failed to load local model:', error);
      this.enabled = false; // 加载失败则禁用功能
    } finally {
      this.isModelLoading = false;
    }
    return this.extractor;
  }

  /**
   * 将文本转换为向量（使用本地 MiniLM 模型）
   */
  async embed(text: string): Promise<number[]> {
    if (!this.enabled) return [];

    try {
      const model = await this.getModel();
      if (!model) return [];

      // 执行向量化
      const output = await model(text, { pooling: 'mean', normalize: true });
      
      // Transformers.js 返回的是 Tensor，需要转为数组
      return Array.from(output.data);
    } catch (error) {
      console.error('[EmbeddingService] Embedding failed:', error);
      return [];
    }
  }
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
