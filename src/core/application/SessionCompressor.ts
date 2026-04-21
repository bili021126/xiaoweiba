/**
 * 会话压缩器 - Session Compressor
 *
 * 职责：
 * 1. 检测长会话(超过阈值)
 * 2. 压缩会话历史,保留关键信息
 * 3. 生成会话摘要,减少Token消耗
 *
 * 设计原则：
 * - 只压缩对话历史,不污染操作记忆(符合宪法原则一)
 * - 异步压缩,不阻塞主流程(符合宪法原则三)
 * - 可配置压缩阈值和策略
 */

import { injectable, inject } from 'tsyringe';
import { ILLMPort } from '../ports/ILLMPort';
import { ConfigManager } from '../../storage/ConfigManager';

/**
 * 压缩后的会话摘要
 */
export interface SessionSummary {
  /** 压缩后的会话历史 */
  compressedHistory: Array<{ role: string; content: string }>;

  /** 会话摘要文本 (L3) */
  summary: string;

  /** ✅ 新增：本次压缩新提取出的关键决策 (L2) */
  newKeyDecisions: string[];

  /** 原始消息数量 */
  originalMessageCount: number;

  /** 压缩后消息数量 */
  compressedMessageCount: number;

  /** 压缩率 (0-1) */
  compressionRatio: number;

  /** 是否触发了压缩 */
  compressed: boolean;
}

/**
 * 会话压缩配置
 */
export interface CompressionConfig {
  /** 触发压缩的消息数量阈值 */
  threshold: number;

  /** 压缩后保留的消息数量 */
  keepRecentCount: number;

  /** 是否使用LLM生成摘要 */
  useLLMSummary: boolean;
}

@injectable()
export class SessionCompressor {
  private readonly DEFAULT_CONFIG: CompressionConfig = {
    threshold: 10,        // 超过10条消息触发压缩
    keepRecentCount: 5,   // 保留最近5条消息
    useLLMSummary: true   // 使用LLM生成摘要
  };

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort,
    @inject(ConfigManager) private configManager: ConfigManager
  ) {}

  /**
   * 检查并压缩会话历史
   * @param sessionHistory 原始会话历史
   * @param existingDecisions 已有的关键决策（用于去重）
   * @returns 压缩结果
   */
  async compressIfNeeded(
    sessionHistory: Array<{ role: string; content: string }>,
    existingDecisions: string[] = []
  ): Promise<SessionSummary> {
    const config = this.getCompressionConfig();

    // 如果未达到阈值,不压缩
    if (sessionHistory.length <= config.threshold) {
      return {
        compressedHistory: sessionHistory,
        summary: '',
        newKeyDecisions: [], // ✅ 新增
        originalMessageCount: sessionHistory.length,
        compressedMessageCount: sessionHistory.length,
        compressionRatio: 1.0,
        compressed: false
      };
    }

    // 执行压缩
    return await this.compress(sessionHistory, config, existingDecisions);
  }

  /**
   * 执行会话压缩
   * @param sessionHistory 原始会话历史
   * @param config 压缩配置
   * @param existingDecisions 已有的关键决策（用于去重）
   * @returns 压缩结果
   */
  private async compress(
    sessionHistory: Array<{ role: string; content: string }>,
    config: CompressionConfig,
    existingDecisions: string[] = []
  ): Promise<SessionSummary> {
    const totalMessages = sessionHistory.length;

    // 1. 保留最近的消息
    const recentMessages = sessionHistory.slice(-config.keepRecentCount);

    // 2. 提取需要总结的历史消息
    const messagesToSummarize = sessionHistory.slice(0, -config.keepRecentCount);

    // 3. 生成会话摘要和提取关键决策
    let summary = '';
    let newDecisions: string[] = [];
    
    if (config.useLLMSummary && messagesToSummarize.length > 0) {
      const result = await this.generateSummaryAndDecisions(messagesToSummarize, existingDecisions);
      summary = result.summary;
      newDecisions = result.newKeyDecisions;
    }

    // 4. 构建压缩后的历史
    const compressedHistory: Array<{ role: string; content: string }> = [];

    // 添加摘要(如果有)
    if (summary) {
      compressedHistory.push({
        role: 'system',
        content: `【会话摘要】${summary}`
      });
    }

    // 添加最近的消息
    compressedHistory.push(...recentMessages);

    const compressedCount = compressedHistory.length;
    const compressionRatio = compressedCount / totalMessages;

    console.log(`[SessionCompressor] Compressed ${totalMessages} messages to ${compressedCount} (${(compressionRatio * 100).toFixed(1)}%)`);

    return {
      compressedHistory,
      summary,
      newKeyDecisions: newDecisions, // ✅ 新增
      originalMessageCount: totalMessages,
      compressedMessageCount: compressedCount,
      compressionRatio,
      compressed: true
    };
  }

  /**
   * 使用LLM生成会话摘要并提取关键决策
   * @param messages 需要总结的消息列表
   * @param existingDecisions 已有的关键决策
   * @returns 摘要和决策
   */
  private async generateSummaryAndDecisions(
    messages: Array<{ role: string; content: string }>, 
    existingDecisions: string[]
  ): Promise<{ summary: string; newKeyDecisions: string[] }> {
    try {
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content.substring(0, 200)}`)
        .join('\n');

      const prompt = `请分析以下对话，完成两个任务：
1. 将对话压缩为一段简洁的上下文摘要（不超过100字）。
2. 提取对话中做出的**关键决策**（如技术选型、方案确认、方向性共识）。如果没有新的决策，返回空数组。

已有的关键决策：${existingDecisions.join('; ')}

请以JSON格式返回：{ "summary": "...", "newKeyDecisions": [...] }

对话内容:
${conversationText}`;

      const result = await this.llmPort.call({
        messages: [
          { role: 'system', content: '你是一个专业的对话分析和压缩助手。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 300
      });

      if (result.success && result.text) {
        try {
          const parsed = JSON.parse(result.text);
          return {
            summary: parsed.summary || this.fallbackSummary(messages),
            newKeyDecisions: Array.isArray(parsed.newKeyDecisions) ? parsed.newKeyDecisions : []
          };
        } catch (e) {
          // 如果解析失败，降级处理
          return { summary: this.fallbackSummary(messages), newKeyDecisions: [] };
        }
      }

      return { summary: this.fallbackSummary(messages), newKeyDecisions: [] };
    } catch (error) {
      console.error('[SessionCompressor] Failed to generate summary and decisions:', error);
      return { summary: this.fallbackSummary(messages), newKeyDecisions: [] };
    }
  }

  /**
   * 使用LLM生成会话摘要
   * @param messages 需要总结的消息列表
   * @returns 摘要文本
   */
  private async generateSummary(messages: Array<{ role: string; content: string }>): Promise<string> {
    try {
      // 构建提示词
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content.substring(0, 200)}`)
        .join('\n');

      const prompt = `请总结以下对话的关键内容,包括:
1. 用户的主要需求或问题
2. 已解决的关键决策
3. 待解决的问题(如果有)

要求:
- 简洁明了,不超过100字
- 使用中文
- 只返回摘要文本,不要其他内容

对话内容:
${conversationText}`;

      // 调用LLM
      const result = await this.llmPort.call({
        messages: [
          { role: 'system', content: '你是一个专业的对话总结助手。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 200
      });

      if (result.success && result.text) {
        return result.text.trim();
      }

      // LLM失败时降级为简单摘要
      return this.fallbackSummary(messages);
    } catch (error) {
      console.error('[SessionCompressor] Failed to generate summary:', error);
      // 降级为简单摘要
      return this.fallbackSummary(messages);
    }
  }

  /**
   * 降级摘要策略(不使用LLM)
   * @param messages 消息列表
   * @returns 简单摘要
   */
  private fallbackSummary(messages: Array<{ role: string; content: string }>): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    const parts: string[] = [];

    if (userMessages.length > 0) {
      parts.push(`用户提出了${userMessages.length}个问题`);
    }

    if (assistantMessages.length > 0) {
      parts.push(`助手提供了${assistantMessages.length}次回答`);
    }

    if (parts.length === 0) {
      return '历史对话';
    }

    return parts.join(',');
  }

  /**
   * 获取压缩配置(可从ConfigManager读取)
   * @returns 压缩配置
   */
  private getCompressionConfig(): CompressionConfig {
    // TODO: 从ConfigManager读取配置
    // const config = this.configManager.getConfig();
    // return {
    //   threshold: config.chat?.compressionThreshold ?? this.DEFAULT_CONFIG.threshold,
    //   keepRecentCount: config.chat?.keepRecentCount ?? this.DEFAULT_CONFIG.keepRecentCount,
    //   useLLMSummary: config.chat?.useLLMSummary ?? this.DEFAULT_CONFIG.useLLMSummary
    // };

    return this.DEFAULT_CONFIG;
  }

  /**
   * 判断是否需要压缩
   * @param sessionHistory 会话历史
   * @returns 是否需要压缩
   */
  shouldCompress(sessionHistory: Array<{ role: string; content: string }>): boolean {
    const config = this.getCompressionConfig();
    return sessionHistory.length > config.threshold;
  }
}
