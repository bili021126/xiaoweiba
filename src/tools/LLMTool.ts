import { injectable, inject } from 'tsyringe';
import OpenAI from 'openai';
import { ConfigManager, ModelProviderConfig } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { ErrorCode, createError } from '../utils/ErrorCodes';
import { ILLMTool, ToolResult, LLMCallOptions } from './interfaces';

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@injectable()
export class LLMTool implements ILLMTool {
  private clients: Map<string, OpenAI> = new Map();

  constructor(
    @inject(ConfigManager) private configManager: ConfigManager,
    @inject(AuditLogger) private auditLogger: AuditLogger
  ) {}

  /**
   * 脱敏敏感信息
   */
  private sanitizeContent(content: string): string {
    let sanitized = content;
    
    // 脱敏API密钥模式 (api_key=xxx, apikey: xxx等)
    sanitized = sanitized.replace(/(api[_-]?key|apikey)\s*[=:]\s*['"]?([a-zA-Z0-9]{20,})['"]?/gi, '$1=[REDACTED]');
    
    // 脱敏Bearer Token
    sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]');
    
    // 脱敏环境变量引用 (${XXX_KEY}, ${XXX_SECRET}等)
    sanitized = sanitized.replace(/\$\{[A-Z_]*(?:KEY|SECRET|PASSWORD|TOKEN)[A-Z_]*\}/g, '[ENV_VAR_REDACTED]');
    
    // 脱敏常见密钥模式 (sk-xxx)
    sanitized = sanitized.replace(/(sk-[a-zA-Z0-9]{20,})/g, '[API_KEY_REDACTED]');
    
    // 脱敏GitHub Token (ghp_xxx)
    sanitized = sanitized.replace(/(ghp_[a-zA-Z0-9]{36})/g, '[GITHUB_TOKEN_REDACTED]');
    
    // 脱敏AWS密钥 (AKIA开头)
    sanitized = sanitized.replace(/(AKIA[A-Z0-9]{16})/g, '[AWS_KEY_REDACTED]');
    
    // 脱敏私钥头尾标记
    sanitized = sanitized.replace(/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA )?PRIVATE KEY-----/g, '[PRIVATE_KEY_REDACTED]');
    
    return sanitized;
  }

  /**
   * 调用 LLM API（非流式）
   */
  async call(options: LLMCallOptions): Promise<ToolResult<string>> {
    const startTime = Date.now();
    try {
      const config = this.configManager.getConfig();
      const providerId = options.model || config.model.default;
      const provider = this.getProviderConfig(providerId);

      if (!provider) {
        throw createError(
          ErrorCode.LLM_PROVIDER_NOT_FOUND,
          `Provider not found: ${providerId}`,
          `未找到 LLM 提供商: ${providerId}，请检查配置`
        );
      }

      const client = await this.getClientAsync(provider);
      const temperature = options.temperature ?? provider.temperature;
      const maxTokens = options.maxTokens ?? provider.maxTokens;

      // 脱敏消息内容
      const sanitizedMessages = options.messages.map(msg => ({
        ...msg,
        content: this.sanitizeContent(msg.content)
      }));

      const response = await client.chat.completions.create({
        model: provider.modelName || provider.id, // 优先使用 modelName，降级到 id
        messages: sanitizedMessages,
        temperature,
        max_tokens: maxTokens
      });

      // 检查响应是否有效
      if (!response.choices || response.choices.length === 0) {
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('llm_call', 'failure', durationMs, {
          parameters: {
            provider: providerId,
            model: provider.id,
            messageCount: options.messages.length,
            error: 'Empty choices'
          }
        });
        
        return {
          success: false,
          error: 'LLM 返回空响应，请检查 API 配置或稍后重试',
          durationMs
        };
      }

      const content = response.choices[0]?.message?.content || '';
      const durationMs = Date.now() - startTime;

      // 记录审计日志
      await this.auditLogger.log('llm_call', 'success', durationMs, {
        parameters: {
          provider: providerId,
          model: provider.id,
          messageCount: options.messages.length,
          responseLength: content.length
        }
      });

      return {
        success: true,
        data: content,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.auditLogger.logError('llm_call', error as Error, durationMs);

      // 判断错误类型
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return {
          success: false,
          error: 'LLM API 速率限制，请稍后重试',
          durationMs
        };
      }

      return {
        success: false,
        error: `LLM 调用失败: ${errorMessage}`,
        durationMs
      };
    }
  }

  /**
   * 调用 LLM API（流式）
   */
  async callStream(
    options: LLMCallOptions,
    onChunk: (chunk: string) => void
  ): Promise<ToolResult<string>> {
    const startTime = Date.now();
    let fullContent = '';

    try {
      const config = this.configManager.getConfig();
      const providerId = options.model || config.model.default;
      const provider = this.getProviderConfig(providerId);

      if (!provider) {
        throw createError(
          ErrorCode.LLM_PROVIDER_NOT_FOUND,
          `Provider not found: ${providerId}`,
          `未找到 LLM 提供商: ${providerId}`
        );
      }

      const client = await this.getClientAsync(provider);
      const temperature = options.temperature ?? provider.temperature;
      const maxTokens = options.maxTokens ?? provider.maxTokens;

      // 脱敏消息内容
      const sanitizedMessages = options.messages.map(msg => ({
        ...msg,
        content: this.sanitizeContent(msg.content)
      }));

      const stream = await client.chat.completions.create({
        model: provider.modelName || provider.id, // 优先使用 modelName，降级到 id
        messages: sanitizedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      }

      const durationMs = Date.now() - startTime;

      await this.auditLogger.log('llm_stream_call', 'success', durationMs, {
        parameters: {
          provider: providerId,
          responseLength: fullContent.length
        }
      });

      return {
        success: true,
        data: fullContent,
        durationMs
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await this.auditLogger.logError('llm_stream_call', error as Error, durationMs);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs
      };
    }
  }

  /**
   * 获取提供商配置
   */
  private getProviderConfig(providerId: string): ModelProviderConfig | undefined {
    const config = this.configManager.getConfig();
    
    // ✅ 调试日志：帮助排查 Provider 找不到的问题
    console.log(`[LLMTool] 🔍 Looking for provider: ${providerId}`);
    console.log(`[LLMTool] Config default model: ${config.model.default}`);
    console.log(`[LLMTool] Available providers:`, config.model.providers.map(p => ({ id: p.id, modelName: p.modelName })));
    console.log(`[LLMTool] ConfigManager instance:`, this.configManager.constructor.name);
    
    const provider = config.model.providers.find((p) => p.id === providerId);
    
    if (!provider) {
      console.error(`[LLMTool] ❌ Provider not found: ${providerId}`);
    }
    
    return provider;
  }

  /**
   * 获取或创建 OpenAI 客户端
   */
  private async getClientAsync(provider: ModelProviderConfig): Promise<OpenAI> {
    if (!this.clients.has(provider.id)) {
      // ✅ 修复 #19：统一从 ConfigManager 获取 API Key，避免硬编码环境变量
      let apiKey = await this.configManager.getApiKey(provider.id) || '';
      
      // 向后兼容：如果 ConfigManager 未配置，尝试从环境变量读取（仅开发环境）
      if (!apiKey && provider.id !== 'ollama') {
        const envKeyVar = `${provider.id.toUpperCase()}_API_KEY`;
        apiKey = process.env[envKeyVar] || 
                 process.env.DEEPSEEK_API_KEY ||  // 向后兼容
                 process.env.OPENAI_API_KEY || 
                 '';
      }

      if (!apiKey && provider.id !== 'ollama') {
        throw createError(
          ErrorCode.LLM_API_CALL_FAILED,
          `API key not configured for provider: ${provider.id}`,
          `未配置 API Key: ${provider.id}，请通过"配置 API Key"命令设置`
        );
      }

      const client = new OpenAI({
        baseURL: provider.apiUrl,
        apiKey: apiKey || 'ollama', // Ollama 不需要 API Key
        dangerouslyAllowBrowser: false
      });

      this.clients.set(provider.id, client);
    }

    return this.clients.get(provider.id)!;
  }

  /**
   * 清除客户端缓存（用于配置变更时）
   */
  clearClientCache(): void {
    this.clients.clear();
  }
}
