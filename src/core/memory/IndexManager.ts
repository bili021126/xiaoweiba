import { injectable } from 'tsyringe';
import { EpisodicMemoryRecord } from './types';

/**
 * 索引管理器 - 负责内存索引的构建、更新和查询
 * 
 * 职责：
 * - 倒排索引管理（term -> memoryId映射）
 * - 词频统计（TF计算）
 * - IDF缓存管理
 * - 向量缓存管理
 */
@injectable()
export class IndexManager {
  // 倒排索引：term -> Map<memoryId, tf>
  private invertedIndex: Map<string, Map<string, number>> = new Map();
  
  // 文档词频：memoryId -> Map<term, tf>
  private docTermFreq: Map<string, Map<string, number>> = new Map();
  
  // IDF缓存：term -> idf值
  private idfCache: Map<string, number> = new Map();
  
  // 总文档数
  private totalDocs: number = 0;
  
  // 索引是否就绪
  private indexReady: boolean = false;
  
  // 向量缓存：memoryId -> vector
  private vectorCache: Map<string, Float32Array> = new Map();
  
  // 向量检索是否就绪
  private vectorReady: boolean = false;

  /**
   * 获取倒排索引
   */
  getInvertedIndex(): Map<string, Map<string, number>> {
    return this.invertedIndex;
  }

  /**
   * 获取文档词频
   */
  getDocTermFreq(): Map<string, Map<string, number>> {
    return this.docTermFreq;
  }

  /**
   * 获取IDF缓存
   */
  getIdfCache(): Map<string, number> {
    return this.idfCache;
  }

  /**
   * 获取总文档数
   */
  getTotalDocs(): number {
    return this.totalDocs;
  }

  /**
   * 获取向量缓存
   */
  getVectorCache(): Map<string, Float32Array> {
    return this.vectorCache;
  }

  /**
   * 检查索引是否就绪
   */
  isIndexReady(): boolean {
    return this.indexReady;
  }

  /**
   * 检查向量检索是否就绪
   */
  isVectorReady(): boolean {
    return this.vectorReady;
  }

  /**
   * 设置索引就绪状态
   */
  setIndexReady(ready: boolean): void {
    this.indexReady = ready;
  }

  /**
   * 设置向量就绪状态
   */
  setVectorReady(ready: boolean): void {
    this.vectorReady = ready;
  }

  /**
   * 增量添加记忆到索引
   */
  addToIndex(memory: EpisodicMemoryRecord): void {
    const text = this.getIndexText(memory);
    const terms = this.tokenize(text);
    
    // 更新文档词频
    const termFreq = new Map<string, number>();
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }
    this.docTermFreq.set(memory.id, termFreq);
    
    // 更新倒排索引
    for (const [term, freq] of termFreq.entries()) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Map());
      }
      this.invertedIndex.get(term)!.set(memory.id, freq);
    }
    
    // 更新总文档数
    this.totalDocs++;
    
    // 清除IDF缓存（需要重新计算）
    this.idfCache.clear();
  }

  /**
   * 从索引中移除记忆
   */
  removeFromIndex(memoryId: string): void {
    // 从文档词频中移除
    const termFreq = this.docTermFreq.get(memoryId);
    if (termFreq) {
      for (const term of termFreq.keys()) {
        const docMap = this.invertedIndex.get(term);
        if (docMap) {
          docMap.delete(memoryId);
          if (docMap.size === 0) {
            this.invertedIndex.delete(term);
          }
        }
      }
      this.docTermFreq.delete(memoryId);
      this.totalDocs = Math.max(0, this.totalDocs - 1);
      this.idfCache.clear();
    }
    
    // 从向量缓存中移除
    this.vectorCache.delete(memoryId);
  }

  /**
   * 清空所有索引
   */
  clearIndex(): void {
    this.invertedIndex.clear();
    this.docTermFreq.clear();
    this.idfCache.clear();
    this.vectorCache.clear();
    this.totalDocs = 0;
    this.indexReady = false;
    this.vectorReady = false;
  }

  /**
   * 计算并缓存IDF值
   */
  calculateIdf(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }
    
    const docFreq = this.invertedIndex.get(term)?.size || 0;
    const idf = Math.log((this.totalDocs + 1) / (docFreq + 1)) + 1;
    this.idfCache.set(term, idf);
    
    return idf;
  }

  /**
   * 获取记忆的索引文本
   */
  private getIndexText(memory: EpisodicMemoryRecord): string {
    const parts = [memory.summary];
    if (memory.entities && memory.entities.length > 0) {
      parts.push(memory.entities.join(' '));
    }
    if (memory.decision) {
      parts.push(memory.decision);
    }
    return parts.join(' ').toLowerCase();
  }

  /**
   * 分词（简单空格分词）
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }
}
