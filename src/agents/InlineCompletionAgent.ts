import { IAgent, AgentCapability, AgentMetadata, AgentResult } from '../core/agent/IAgent';
import { ILLMPort } from '../core/ports/ILLMPort';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { injectable, inject } from 'tsyringe';

/**
 * 行内补全Agent
 * 
 * 专用于VS Code行内代码补全，对延迟极度敏感（<500ms）
 * 采用简化调度路径，不经过完整的EventBus链路
 */
@injectable()
export class InlineCompletionAgent implements IAgent {
  readonly id = 'inline_completion_agent';
  readonly name = '行内补全';
  readonly supportedIntents = ['inline_completion'];

  readonly metadata: AgentMetadata = {
    version: '1.0.0',
    description: '提供行内代码补全功能，低延迟优化',
    author: 'XiaoWeiBa Team',
    tags: ['completion', 'inline', 'ai']
  };

  private initialized = false;

  constructor(
    @inject('ILLMPortFlash') private llmPort: ILLMPort // ✅ 成本优化：使用Flash模型
  ) {}

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    if (!this.initialized) {
      throw new Error('Agent未初始化');
    }

    const startTime = Date.now();
    const { intent } = params;

    try {
      // 1. 获取代码前缀
      const prefix = intent.userInput;
      if (!prefix || prefix.length < 3) {
        return {
          success: false,
          error: '代码前缀太短',
          durationMs: Date.now() - startTime
        };
      }

      const language = intent.codeContext?.language || 'text';

      // 2. 构建提示
      const prompt = this.buildPrompt(prefix, language);

      // 3. 调用LLM完成接口（低延迟优化）
      
      const response = await this.llmPort.call({
        messages: [
          { role: 'system' as const, content: prompt },
          { role: 'user' as const, content: '' }
        ],
        maxTokens: 50,
        temperature: 0.2,
        stopSequences: ['\n', ';', ')', '}']
      });

      if (!response.success) {
        throw new Error(response.error || 'LLM调用失败');
      }

      const completion = response.text || '';

      // 4. 返回结果
      return {
        success: true,
        data: {
          completion
        },
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * 构建补全提示
   */
  private buildPrompt(prefix: string, language: string): string {
    return `你是一个智能代码补全助手。请根据以下${language}代码前缀，预测接下来最可能的代码内容。

要求：
1. 只返回补全部分，不要重复已有代码
2. 保持代码风格一致
3. 补全内容要简洁合理
4. 如果无法确定，返回空字符串

代码前缀：
\`\`\`${language}
${prefix}
\`\`\`

补全内容（直接返回代码，不要解释）：`;
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'inline_completion',
        description: '提供行内代码补全功能',
        priority: 10
      }
    ];
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
