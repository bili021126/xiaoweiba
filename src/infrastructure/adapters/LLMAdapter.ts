/**
 * LLM适配器 - 将 LLMTool 适配到 ILLMPort
 * 
 * 职责：
 * 1. 实现 ILLMPort 接口
 * 2. 委托给 LLMTool 执行实际调用
 * 3. 转换参数和返回值格式
 */

import { injectable, inject } from 'tsyringe';
import { ILLMPort, LLMCallOptions, LLMCallResult, StreamCallback } from '../../core/ports/ILLMPort';
import { LLMTool } from '../../tools/LLMTool';

/**
 * LLM适配器配置
 */
export interface LLMAdapterConfig {
  /** 默认模型ID（如 'deepseek-pro' 或 'deepseek-flash'） */
  defaultModelId?: string;
}

@injectable()
export class LLMAdapter implements ILLMPort {
  private readonly defaultModelId?: string;

  constructor(
    @inject(LLMTool) private llmTool: LLMTool,
    @inject('LLMAdapterConfig') config?: LLMAdapterConfig // ✅ 法典：通过容器注入配置
  ) {
    this.defaultModelId = config?.defaultModelId;
  }

  /**
   * 调用LLM（同步模式）
   */
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const startTime = Date.now();

    try {
      // ✅ 验证消息数组非空
      if (!options.messages || options.messages.length === 0) {
        throw new Error('消息数组不能为空');
      }

      // ✅ 验证至少有一个用户消息（除了系统消息）
      const hasUserMessage = options.messages.some(msg => msg.role === 'user');
      
      // ✅ 修复 #17：不要修改入参，创建副本
      let messagesToUse = options.messages;
      if (!hasUserMessage) {
        console.warn('[LLMAdapter] No user message found, adding placeholder');
        // 添加占位用户消息，避免LLM调用失败
        messagesToUse = [...options.messages, { role: 'user' as const, content: '请回答' }];
      }

      // 转换消息格式
      const messages = messagesToUse.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

      // 调用 LLMTool
      const result = await this.llmTool.call({
        messages,
        model: options.modelId || this.defaultModelId, // ✅ 优先使用传入的modelId，其次使用默认模型
        temperature: options.temperature,
        maxTokens: options.maxTokens
      });

      const durationMs = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          durationMs,
          modelId: options.modelId
        };
      }

      return {
        success: true,
        text: result.data,
        usage: (result as any).usage ? {
          promptTokens: (result as any).usage.promptTokens,
          completionTokens: (result as any).usage.completionTokens,
          totalTokens: (result as any).usage.totalTokens
        } : undefined,
        durationMs,
        modelId: (result as any).model || options.modelId
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LLMAdapter] call failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        durationMs,
        modelId: options.modelId
      };
    }
  }

  /**
   * 调用LLM（流式模式）
   */
  async callStream(
    options: LLMCallOptions,
    onChunk: StreamCallback
  ): Promise<Omit<LLMCallResult, 'text'>> {
    const startTime = Date.now();

    try {
      // ✅ 验证消息数组非空
      if (!options.messages || options.messages.length === 0) {
        throw new Error('消息数组不能为空');
      }

      // ✅ 验证至少有一个用户消息（除了系统消息）
      const hasUserMessage = options.messages.some(msg => msg.role === 'user');
      
      // ✅ 修复 #17：不要修改入参，创建副本
      let messagesToUse = options.messages;
      if (!hasUserMessage) {
        console.warn('[LLMAdapter] No user message found in stream call, adding placeholder');
        // 添加占位用户消息，避免LLM调用失败
        messagesToUse = [...options.messages, { role: 'user' as const, content: '请回答' }];
      }

      // 转换消息格式
      const messages = messagesToUse.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }));

      let fullText = '';
      let modelId = options.modelId || this.defaultModelId; // ✅ 优先使用传入的modelId，其次使用默认模型

      // 调用 LLMTool 的流式方法
      const result = await this.llmTool.callStream(
        {
          messages,
          model: options.modelId || this.defaultModelId, // ✅ 同上
          temperature: options.temperature,
          maxTokens: options.maxTokens
        },
        async (chunk: string) => {
          fullText += chunk;
          // 转发chunk到回调
          await onChunk(chunk);
        }
      );

      const durationMs = Date.now() - startTime;

      // ✅ 修复：检查底层调用是否成功
      if (!result.success) {
        console.error('[LLMAdapter] callStream underlying call failed:', result.error);
        return {
          success: false,
          error: result.error,
          durationMs,
          modelId: options.modelId
        };
      }

      return {
        success: true,
        durationMs,
        modelId: (result as any).model || options.modelId
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('[LLMAdapter] callStream failed:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        durationMs,
        modelId: options.modelId
      };
    }
  }

  /**
   * 检查LLM服务可用性
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 简单检查：尝试获取配置
      const config = (this.llmTool as any).configManager?.getConfig();
      return !!config?.model?.default;
    } catch (error) {
      console.error('[LLMAdapter] isAvailable check failed:', error);
      return false;
    }
  }

  /**
   * 获取当前配置的模型ID
   */
  getModelId(): string {
    try {
      const config = (this.llmTool as any).configManager?.getConfig();
      return config?.model?.default || 'unknown';
    } catch (error) {
      console.error('[LLMAdapter] getModelId failed:', error);
      return 'unknown';
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // LLMTool 不需要特殊清理
    console.log('[LLMAdapter] Disposed');
  }
}
