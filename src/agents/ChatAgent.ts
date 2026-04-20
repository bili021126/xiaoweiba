import { IAgent, AgentCapability, AgentMetadata, AgentResult } from '../core/agent/IAgent';
import { ILLMPort, LLMMessage } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus';
import { MemoryContext } from '../core/domain/MemoryContext';
import { Intent } from '../core/domain/Intent';
import { AssistantResponseEvent, StreamChunkEvent } from '../core/events/DomainEvent';
import { injectable, inject } from 'tsyringe';

/**
 * 聊天Agent实现
 * 
 * 处理自然语言对话、代码解释、问题解答
 */
@injectable()
export class ChatAgent implements IAgent {
  readonly id = 'chat_agent';  // ✅ 统一命名风格（下划线）
  readonly name = '聊天助手';
  readonly supportedIntents = ['chat', 'explain_code', 'qa'];  // ✅ 更新意图名称
  
  readonly metadata: AgentMetadata = {
    version: '1.0.0',
    description: '处理自然语言对话、代码解释、问题解答',
    author: 'XiaoWeiBa Team',
    tags: ['chat', 'code', 'qa']
  };

  private initialized = false;

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort,  // ✅ 使用端口接口
    @inject('IMemoryPort') private memoryPort: IMemoryPort,  // ✅ 使用端口接口
    @inject('IEventBus') private eventBus: IEventBus  // ✅ 注入全局单例
  ) {}

  async initialize(): Promise<void> {
    // 初始化逻辑（如加载模型、建立连接等）
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
    const { intent, memoryContext } = params;

    try {
      // ✅ 添加调试日志
      console.log('[ChatAgent] Intent:', intent.name, 'UserInput:', intent.userInput, 'CodeContext:', intent.codeContext);

      // ✅ 处理无用户输入的情况（如 explain_code 意图）
      let userMessage = intent.userInput;
      
      if (!userMessage && intent.name === 'explain_code') {
        // 为代码解释生成默认提示
        userMessage = '请解释上面的代码';
        console.log('[ChatAgent] Generated default message for explain_code');
      }
      
      if (!userMessage) {
        return {
          success: false,
          error: '缺少用户输入',
          durationMs: Date.now() - startTime
        };
      }

      // 1. 构建消息历史（多轮对话）
      const history = this.buildMessageHistory(memoryContext, intent);
      const currentMessage: LLMMessage = { role: 'user' as const, content: userMessage };
      const messages = [...history, currentMessage];

      // 2. 构建系统提示
      const systemPrompt = this.buildSystemPrompt(intent, memoryContext);

      // 3. 调用LLM（流式）
      const messageId = `msg_${Date.now()}_assistant`;
      let fullContent = '';
      
      await this.llmPort.callStream(
        {
          messages: [
            { role: 'system' as const, content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          maxTokens: 2000
        },
        (chunk: string) => {
          fullContent += chunk;
          // ✅ 发布流式块事件
          this.eventBus.publish(new StreamChunkEvent(messageId, chunk));
        }
      );

      // 4. 发布完整响应事件
      this.eventBus.publish(new AssistantResponseEvent({
        messageId,
        content: fullContent,
        timestamp: Date.now()
      }));

      // 5. 返回结果
      return {
        success: true,
        data: {
          messageId,
          content: fullContent
        },
        durationMs: Date.now() - startTime,
        // ✅ P1-02: 添加记忆元数据（仅对有意义的对话记录）
        memoryMetadata: this.shouldRecordMemory(intent, userMessage, fullContent) ? {
          taskType: 'CHAT_COMMAND',
          summary: `讨论了：${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`,
          entities: this.extractEntitiesFromMessage(userMessage),
          outcome: 'SUCCESS'
        } : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 发布错误响应
      this.eventBus.publish(new AssistantResponseEvent({
        messageId: `msg_${Date.now()}_error`,
        content: `抱歉，发生错误：${errorMessage}`,
        timestamp: Date.now()
      }));

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * 构建消息历史（从MemoryContext中获取）
   */
  private buildMessageHistory(memoryContext: MemoryContext, intent: Intent): LLMMessage[] {
    // 从记忆上下文中获取会话历史
    const sessionHistory = memoryContext.sessionHistory || [];
    
    // 转换为LLM所需格式，限制最多10条
    const history = sessionHistory
      .slice(-10)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
    
    // ✅ 对于 explain_code 意图，即使没有会话历史，也要确保有用户消息
    // 这由 execute 方法中的 userMessage 保证，此处只需返回历史即可
    return history;
  }

  /**
   * HTML转义，防止XSS攻击
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * ✅ P1-02: 判断是否应该记录记忆
   */
  private shouldRecordMemory(intent: Intent, userMessage: string, assistantResponse: string): boolean {
    // 非chat意图（如explain_code）总是记录
    if (intent.name !== 'chat') {
      return true;
    }

    // chat意图：检查是否有意义
    // 1. 消息长度足够（至少10个字符）
    if (userMessage.length < 10) {
      return false;
    }

    // 2. 不是简单的问候语
    const greetings = ['你好', 'hello', 'hi', 'hey', '早上好', '晚上好', '再见', 'bye'];
    const isGreeting = greetings.some(g => userMessage.toLowerCase().includes(g));
    if (isGreeting && userMessage.length < 20) {
      return false;
    }

    // 3. 助手回复有实质内容（至少50个字符）
    if (assistantResponse.length < 50) {
      return false;
    }

    return true;
  }

  /**
   * ✅ P1-02: 从消息中提取实体
   */
  private extractEntitiesFromMessage(message: string): string[] {
    const entities: string[] = [];

    // 提取代码相关的关键词
    const codeKeywords = ['函数', '类', '方法', '变量', '接口', '类型', '代码', 'algorithm', 'function', 'class', 'method'];
    codeKeywords.forEach(keyword => {
      if (message.includes(keyword)) {
        entities.push(keyword);
      }
    });

    // 提取文件名模式（简单匹配）
    const filePattern = /\b\w+\.(ts|js|py|java|cpp|go|rs)\b/g;
    const fileMatches = message.match(filePattern);
    if (fileMatches) {
      entities.push(...fileMatches);
    }

    return entities;
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(intent: Intent, memoryContext: MemoryContext): string {
    const parts: string[] = [];

    // 1. 基础角色设定
    parts.push('你是小尾巴，一个智能编程助手。回答要简洁、准确、有帮助。');

    // 2. 编辑器上下文（如果有）
    if (intent.codeContext) {
      parts.push('\n## 当前编辑器上下文');
      // ✅ 添加默认值防止undefined
      parts.push(`- 文件：${this.escapeHtml(intent.codeContext.filePath || '未知文件')}`);
      parts.push(`- 语言：${this.escapeHtml(intent.codeContext.language || 'unknown')}`);
      if (intent.codeContext.selectedCode) {
        parts.push(`- 选中代码：\n\`\`\`${this.escapeHtml(intent.codeContext.language || 'unknown')}\n${this.escapeHtml(intent.codeContext.selectedCode)}\n\`\`\``);
      }
    }

    // 3. 相关情景记忆
    if (memoryContext.episodicMemories && memoryContext.episodicMemories.length > 0) {
      parts.push('\n## 相关历史操作');
      memoryContext.episodicMemories.slice(0, 3).forEach(mem => {
        parts.push(`- ${this.escapeHtml(mem.summary)}`);
      });
    }

    // 4. 用户偏好
    if (memoryContext.preferenceRecommendations && memoryContext.preferenceRecommendations.length > 0) {
      parts.push('\n## 用户偏好');
      memoryContext.preferenceRecommendations.slice(0, 2).forEach(pref => {
        parts.push(`- ${this.escapeHtml(pref.domain)}: ${JSON.stringify(pref.pattern)} (置信度: ${(pref.confidence * 100).toFixed(0)}%)`);
      });
    }

    // 5. 回答指令
    parts.push('\n## 回答要求');
    parts.push('- 如果问题涉及代码，请提供代码示例');
    parts.push('- 回答要简洁，避免冗长');
    parts.push('- 如果引用了历史记忆，请自然提及');

    return parts.join('\n');
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'chat',
        description: '处理自然语言对话、代码解释、问题解答',
        priority: 10
      }
    ];
  }

  async dispose(): Promise<void> {
    // 清理资源
    this.initialized = false;
  }
}
