import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { LLMTool } from '../tools/LLMTool';
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
 */
export class AICompletionProvider implements vscode.InlineCompletionItemProvider {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private lastTriggerTime: number = 0;

  constructor(
    private llmTool: LLMTool,
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
        return [new vscode.InlineCompletionItem(cached)];
      }
    }

    // 构建Prompt
    const prompt = this.buildPrompt(document, position);
    if (!prompt || prompt.trim().length === 0) {
      return null;
    }

    // 调用LLM
    try {
      // 检查取消令牌
      if (token.isCancellationRequested) {
        return null;
      }

      const result = await this.llmTool.call({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: config.inlineCompletion.maxTokens || 50,
        temperature: 0.2 // 低温度，更确定性
      });

      // 再次检查取消令牌
      if (token.isCancellationRequested) {
        return null;
      }

      if (result.success && result.data && result.data.trim().length > 0) {
        const completion = result.data.trim();
        
        // 清理可能的Markdown代码块标记
        const cleanedCompletion = this.cleanMarkdown(completion);
        
        // 保存到缓存
        if (config.inlineCompletion.enableCache) {
          this.saveToCache(cacheKey, cleanedCompletion, config.inlineCompletion.cacheTTLSeconds || 5);
        }

        return [new vscode.InlineCompletionItem(cleanedCompletion)];
      }
    } catch (error) {
      console.warn('[AICompletionProvider] 补全失败:', error);
      // 记录审计日志（可选）
    }

    return null;
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
   * 构建Prompt
   */
  private buildPrompt(document: vscode.TextDocument, position: vscode.Position): string {
    // 获取当前行和前两行
    const startLine = Math.max(0, position.line - 2);
    const endLine = position.line;
    const range = new vscode.Range(startLine, 0, endLine, position.character);
    const prefix = document.getText(range);

    // 如果前缀太短，不触发补全
    if (prefix.trim().length < 3) {
      return '';
    }

    const language = document.languageId;

    return `请根据以下代码上下文，补全当前行的代码。只返回补全的代码部分，不要重复已有代码，不要添加解释。

语言: ${language}

代码上下文:
\`\`\`${language}
${prefix}
\`\`\`

请补全光标后的代码（只返回代码，不要markdown格式）:`;
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
