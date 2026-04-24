import { IAgent, AgentCapability, AgentMetadata, AgentResult } from '../core/agent/IAgent';
import { ILLMPort, LLMMessage } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus';
import { ChatMemoryContext } from '../core/domain/MemoryContext'; // ✅ 任务2：使用聊天专用上下文
import { Intent } from '../core/domain/Intent';
import { AssistantResponseEvent, StreamChunkEvent, TaskCompletedEvent } from '../core/events/DomainEvent';
import { injectable, inject } from 'tsyringe';
import { PromptComposer } from '../core/application/PromptComposer'; // ✅ L1: 引入提示词编排器
import { DialogManager } from '../chat/DialogManager'; // ✅ P2: 引入对话管理器
import { escapeHtml } from '../utils/html'; // ✅ 统一 HTML 转义

/**
 * 聊天Agent实现
 * 
 * 处理自然语言对话、代码解释、问题解答
 */
@injectable()
export class ChatAgent implements IAgent {
  readonly id = 'chat-agent';  // ✅ 统一命名风格（kebab-case）
  readonly name = '聊天助手';
  readonly supportedIntents = ['chat', 'qa'];  // ✅ 分流：只处理纯聊天和问答，代码解释由 ExplainCodeAgent 处理
  
  readonly metadata: AgentMetadata = {
    version: '1.0.0',
    description: '处理自然语言对话、代码解释、问题解答',
    author: 'XiaoWeiBa Team',
    tags: ['chat', 'code', 'qa']
  };

  private initialized = false;

  constructor(
    @inject('ILLMPortPro') private llmPort: ILLMPort,  // ✅ 成本优化：复杂推理使用Pro模型
    @inject('IMemoryPort') private memoryPort: IMemoryPort,  // ✅ 使用端口接口
    @inject('IEventBus') private eventBus: IEventBus,  // ✅ 注入全局单例
    @inject(PromptComposer) private promptComposer: PromptComposer, // ✅ L1: 注入提示词编排器
    @inject(DialogManager) private dialogManager: DialogManager // ✅ P2: 依赖注入对话管理器
  ) {}

  async initialize(): Promise<void> {
    // 初始化逻辑（如加载模型、建立连接等）
    this.initialized = true;
  }

  async execute(params: {
    intent: Intent;
    memoryContext: ChatMemoryContext; // ✅ 任务2：使用聊天专用上下文
  }): Promise<AgentResult> {
    if (!this.initialized) {
      throw new Error('Agent未初始化');
    }

    const startTime = Date.now();
    const { intent, memoryContext } = params;

    try {
      // ✅ 处理无用户输入的情况
      let userMessage = intent.userInput;
      
      if (!userMessage) {
        return {
          success: false,
          error: '缺少用户输入',
          durationMs: Date.now() - startTime
        };
      }

      // ✅ P1-04: 处理无意义输入
      const trimmedMessage = userMessage.trim();
      if (trimmedMessage.length < 2 || /^\d+$/.test(trimmedMessage)) {
        const friendlyHint = '👋 请输入更具体的问题，我会尽力帮你解答。例如：\n- "解释一下这段代码"\n- "如何优化这个函数？"\n- "帮我生成一个提交信息"';
        
        this.eventBus.publish(new AssistantResponseEvent({
          messageId: `msg_${Date.now()}_hint`,
          content: friendlyHint,
          timestamp: Date.now()
        }));
        
        return {
          success: true,
          data: { content: friendlyHint },
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

      // ✅ P1-02: 发布任务完成事件（触发记忆记录）
      const durationMs = Date.now() - startTime;
      if (this.shouldRecordMemory(intent, userMessage, fullContent)) {
        this.eventBus.publish(new TaskCompletedEvent(
          intent,
          'chat-agent',
          { messageId, content: fullContent },
          durationMs,
          undefined, // modelId
          {
            taskType: 'CHAT_COMMAND',
            summary: `讨论了：${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`,
            entities: this.extractEntitiesFromMessage(userMessage),
            outcome: 'SUCCESS'
          }
        ));
      }

      // ✅ 保存用户消息和 AI 回复到数据库（会话持久化）
      try {
        const sessionId = intent.metadata.sessionId;
        if (sessionId) {
          await this.memoryPort.saveMessage(sessionId, 'user', userMessage);
          await this.memoryPort.saveMessage(sessionId, 'assistant', fullContent);
        }
      } catch (error) {
        console.error('[ChatAgent] Failed to save messages:', error);
        // 不阻断流程，继续返回结果
      }

      // 5. 返回结果
      return {
        success: true,
        data: {
          messageId,
          content: fullContent
        },
        durationMs,
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
  private buildMessageHistory(memoryContext: ChatMemoryContext, intent: Intent): LLMMessage[] {
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
   * ✅ P1-02: 判断是否应该记录记忆（✅ 修复 #P2：引入复杂度评估）
   */
  private shouldRecordMemory(intent: Intent, userMessage: string, assistantResponse: string): boolean {
    if (intent.name !== 'chat') return true;
    
    // 使用 DialogManager 的复杂度评估替代简单规则
    const { complexity } = this.dialogManager.assessComplexity(userMessage);
    
    // 复杂度 > 0.3 或回复长度 > 80 时记录
    return complexity > 0.3 || assistantResponse.length > 80;
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
  private buildSystemPrompt(intent: Intent, memoryContext: ChatMemoryContext): string {
    // ✅ L1: 委托给 PromptComposer，保持 Agent 精简
    return this.promptComposer.buildSystemPrompt(intent, memoryContext);
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
