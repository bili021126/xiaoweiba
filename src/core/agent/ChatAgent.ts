import { IAgent, AgentCapability } from './IAgent';
import { LLMTool } from '../../tools/LLMTool';
import { EpisodicMemory } from '../memory/EpisodicMemory';
import { PreferenceMemory } from '../memory/PreferenceMemory';

/**
 * 聊天Agent实现
 * 
 * 当前系统的ChatViewProvider功能可重构为此Agent
 * 此处为预留架构示例
 */
export class ChatAgent implements IAgent {
  readonly id = 'chat-agent';
  readonly name = '聊天助手';

  readonly capabilities: AgentCapability[] = [
    {
      type: 'CHAT',
      description: '处理自然语言对话、代码解释、问题解答',
      supportedTools: ['llm_call', 'context_builder', 'memory_search']
    }
  ];

  private initialized = false;

  constructor(
    private llmTool: LLMTool,
    private episodicMemory: EpisodicMemory,
    private preferenceMemory: PreferenceMemory
  ) {}

  async initialize(): Promise<void> {
    // 初始化逻辑（如加载模型、建立连接等）
    this.initialized = true;
  }

  async execute(input: any, context?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      throw new Error('Agent未初始化');
    }

    // TODO: 实现具体的聊天逻辑
    // 当前为占位实现，实际应调用ChatViewProvider的核心逻辑
    return {
      success: true,
      message: 'ChatAgent执行完成（预留实现）',
      data: input
    };
  }

  async destroy(): Promise<void> {
    // 清理资源
    this.initialized = false;
  }

  isAvailable(): boolean {
    return this.initialized;
  }
}
