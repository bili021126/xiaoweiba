/**
 * 嵌入服务 - 负责文本向量化与相似度计算
 * 
 * 设计原则：委托而非塞入
 * - EpisodicMemory 不应该知道如何调用 Embedding API
 */

import { injectable, inject } from 'tsyringe';
import { ConfigManager } from '../../storage/ConfigManager';
import { pipeline, env } from '@xenova/transformers';
import * as vscode from 'vscode';
import * as path from 'path';

// ✅ 550B: 配置 Transformers.js 环境，优先使用本地缓存并指定 WASM 路径
env.allowLocalModels = true;
env.useBrowserCache = false; // 在 Node/VSCode 环境下禁用浏览器缓存
env.localModelPath = path.join(__dirname, '..', '..', 'models'); // 指定本地模型路径

@injectable()
export class EmbeddingService {
  private enabled = false;
  private extractor: any = null; // 模型提取器
  private isModelLoading = false;
  private modelLoadFailed = false; // ✅ 修复：标记模型加载失败（但不禁用功能）
  private hasNotifiedFailure = false; // ✅ 修复：防止重复通知

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
      this.modelLoadFailed = false; // ✅ 修复：加载成功，重置失败标志
      this.hasNotifiedFailure = false; // ✅ 修复：加载成功后重置通知标志
    } catch (error) {
      console.error('[EmbeddingService] Failed to load local model:', error);
      this.modelLoadFailed = true; // ✅ 修复：标记加载失败，但不禁用 enabled
      
      // ✅ 修复：首次失败时通知用户，提供降级提示
      if (!this.hasNotifiedFailure) {
        this.hasNotifiedFailure = true;
        vscode.window.showWarningMessage(
          '⚠️ 向量模型加载失败，语义检索将降级为关键词匹配',
          '查看详情',
          '重试'
        ).then(selection => {
          if (selection === '重试') {
            this.retryLoadModel();
          } else if (selection === '查看详情') {
            vscode.window.showInformationMessage(
              '由于网络或缓存问题，本地向量模型无法加载。\n\n' +
              '当前行为：\n' +
              '• 语义检索已自动降级为关键词匹配\n' +
              '• 搜索精度可能略有下降，但功能仍可用\n' +
              '• 可稍后点击“重试”重新加载模型\n\n' +
              '建议：\n' +
              '1. 检查网络连接\n' +
              '2. 重启 VS Code 后再次尝试\n' +
              '3. 如持续失败，可在配置中关闭 enableVectorSearch'
            );
          }
        });
      }
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

  /**
   * ✅ 新增：检查向量模型是否已加载
   * @returns true=模型可用，false=将降级到关键词匹配
   */
  isModelAvailable(): boolean {
    return this.enabled && !this.modelLoadFailed && !!this.extractor;
  }

  /**
   * ✅ 修复：重试加载模型
   */
  async retryLoadModel(): Promise<void> {
    console.log('[EmbeddingService] Retrying model load...');
    this.hasNotifiedFailure = false; // 重置通知标志
    this.extractor = null; // 清除旧的提取器
    await this.getModel(); // 重新加载
  }
}
