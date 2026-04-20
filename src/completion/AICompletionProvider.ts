import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { IntentDispatcher } from '../core/application/IntentDispatcher';
import { IntentFactory } from '../core/factory/IntentFactory';
import { ConfigManager } from '../storage/ConfigManager';

/**
 * 缓存条目
 */
interface CacheEntry {
  value: string;
  expiry: number;
}

/**
 * AI代码补全提供器
 * 
 * 实现VS Code的InlineCompletionItemProvider接口，提供行内代码补全
 * 
 * 重构后：通过IntentDispatcher调度inline_completion意图，使用dispatchSync低延迟路径
 */
export class AICompletionProvider implements vscode.InlineCompletionItemProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private lastTriggerTime: number = 0;

  constructor(
    private intentDispatcher: IntentDispatcher,
    private configManager: ConfigManager
  ) {}

  /**
   * 提供行内补全项
   */
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
    const config = this.configManager.getConfig();
    
    // 检查是否启用了行内补全
    if (!config.inlineCompletion?.enabled) {
      console.log('[AICompletionProvider] Inline completion disabled in config');
      return null;
    }

    // 触发延迟控制
    const now = Date.now();
    const delay = config.inlineCompletion.triggerDelayMs || 300;
    if (now - this.lastTriggerTime < delay) {
      return null; // 未到达触发间隔
    }
    this.lastTriggerTime = now;

    // 构建缓存key
    const cacheKey = this.buildCacheKey(document, position);
    
    // 检查缓存
    if (config.inlineCompletion.enableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('[AICompletionProvider] Cache hit');
        return [new vscode.InlineCompletionItem(cached)];
      }
    }

    // 构建Prompt
    const { prefix, language } = this.extractCodeContext(document, position);
    if (!prefix || prefix.trim().length === 0) {
      return null;
    }

    // ✅ P1-03: 检查前缀长度（至少3个字符）
    if (prefix.trim().length < 3) {
      console.log('[AICompletionProvider] Prefix too short:', prefix.trim().length, 'chars');
      return null;
    }

    // 调用LLM（通过IntentDispatcher.dispatchSync）
    try {
      // 检查取消令牌
      if (token.isCancellationRequested) {
        return null;
      }

      console.log('[AICompletionProvider] Triggering completion, language:', language, 'prefix length:', prefix.length);

      // ✅ 构建inline_completion意图
      const intent = IntentFactory.buildInlineCompletionIntent(prefix, {
        language: language,
        filePath: document.uri.fsPath
      });

      // ✅ 使用同步调度（低延迟优化）
      const result = await this.intentDispatcher.dispatchSync(intent);

      // 再次检查取消令牌
      if (token.isCancellationRequested) {
        return null;
      }

      // dispatchSync返回AgentResult，提取completion数据
      if (result && result.success && result.data && result.data.completion) {
        const completion = result.data.completion.trim();
        
        if (completion.length > 0) {
          console.log('[AICompletionProvider] Completion generated, length:', completion.length);
          
          // 清理可能的Markdown代码块标记
          const cleanedCompletion = this.cleanMarkdown(completion);
          
          // 保存到缓存
          if (config.inlineCompletion.enableCache) {
            this.saveToCache(cacheKey, cleanedCompletion, config.inlineCompletion.cacheTTLSeconds || 5);
          }

          return [new vscode.InlineCompletionItem(cleanedCompletion)];
        }
      } else {
        console.log('[AICompletionProvider] No completion generated, result:', result);
      }
    } catch (error) {
      // ✅ P1-03: 记录错误，便于排查
      console.error('[AICompletionProvider] Completion failed:', error);
    }

    return null;
  }

  /**
   * 提取代码上下文
   */
  private extractCodeContext(document: vscode.TextDocument, position: vscode.Position): { prefix: string; language: string } {
    // 获取当前行和前两行
    const startLine = Math.max(0, position.line - 2);
    const endLine = position.line;
    const range = new vscode.Range(startLine, 0, endLine, position.character);
    const prefix = document.getText(range);
    const language = document.languageId;

    return { prefix, language };
  }

  /**
   * 构建缓存key
   */
  private buildCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
    // 获取当前行和前两行的内容
    const startLine = Math.max(0, position.line - 2);
    const endLine = position.line;
    const range = new vscode.Range(startLine, 0, endLine, position.character);
    const prefix = document.getText(range);

    // 使用哈希作为缓存key
    const hash = crypto.createHash('sha256')
      .update(`${document.uri.fsPath}:${prefix}`)
      .digest('hex')
      .substring(0, 16);

    return hash;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(key: string, value: string, ttlSeconds: number): void {
    // 如果缓存已满，删除最早的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清理Markdown格式标记
   */
  private cleanMarkdown(text: string): string {
    // 移除 ```language ... ``` 标记
    let cleaned = text.replace(/^```[\w]*\n([\s\S]*?)```$/m, '$1');
    
    // 移除行内的`标记
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    
    return cleaned.trim();
  }
}
