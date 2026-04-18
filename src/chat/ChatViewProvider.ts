import * as vscode from 'vscode';
import { SessionManager, ChatMessage } from './SessionManager';
import { ContextBuilder } from './ContextBuilder';
import { PromptEngine } from './PromptEngine';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';
import { ConfigManager } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { generateChatViewHtml } from './ChatViewHtml';
import { DialogManager, InteractionMode } from './DialogManager';
import { InteractionModeSelector } from './InteractionModeSelector';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';

/**
 * 聊天视图提供者�?
 * 
 * 实现VS Code侧边栏聊天面板，支持多轮对话、流式响�?
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'xiaoweiba.chatView';

  private view?: vscode.WebviewView;
  private sessionManager: SessionManager;
  private contextBuilder: ContextBuilder;
  private promptEngine: PromptEngine;
  private dialogManager: DialogManager;
  private modeSelector: InteractionModeSelector;

  constructor(
    private context: vscode.ExtensionContext,
    private llmTool: LLMTool,
    private episodicMemory: EpisodicMemory,
    private preferenceMemory: PreferenceMemory,
    private configManager: ConfigManager,
    private auditLogger: AuditLogger
  ) {
    this.sessionManager = new SessionManager(context, episodicMemory, llmTool);
    this.contextBuilder = new ContextBuilder(episodicMemory, preferenceMemory, this.sessionManager);
    this.promptEngine = new PromptEngine(configManager);
    this.dialogManager = new DialogManager();
    this.modeSelector = new InteractionModeSelector(configManager, context);
    
    // 订阅主动推荐事件
    this.subscribeToRecommendations();
  }

  /**
   * 解析Webview视图
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log('[ChatViewProvider] resolveWebviewView called');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    console.log('[ChatViewProvider] Setting webview HTML...');
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    console.log('[ChatViewProvider] Webview HTML set successfully');

    // 处理来自Webview的消�?
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'sendMessage':
          await this.handleUserMessage(message.text, message.options);
          break;
        case 'newSession':
          this.sessionManager.createSession();
          await this.updateSessionList();
          break;
        case 'switchSession':
          this.sessionManager.switchSession(message.sessionId);
          await this.loadCurrentSession();
          break;
        case 'deleteSession':
          this.sessionManager.deleteSession(message.sessionId);
          await this.updateSessionList();
          break;
      }
    });

    // 异步加载会话数据（不阻塞视图显示）
    const initTimeout = setTimeout(() => {
      console.warn('[ChatViewProvider] Initialization timeout, forcing hide loading');
      if (this.view) {
        this.view.webview.postMessage({ type: 'hideLoading' });
      }
    }, 5000); // 5秒超时

    Promise.all([
      this.loadCurrentSession(),
      this.updateSessionList()
    ]).then(() => {
      clearTimeout(initTimeout);
      console.log('[ChatViewProvider] Data loaded, hiding loading indicator');
      if (this.view) {
        this.view.webview.postMessage({ type: 'hideLoading' });
      }
    }).catch(err => {
      clearTimeout(initTimeout);
      console.error('[ChatViewProvider] Initialization failed:', err);
      if (this.view) {
        this.view.webview.postMessage({ type: 'hideLoading' });
      }
    });
  }

  /**
   * 处理用户消息
   */
  public async handleUserMessage(text: string, options?: { command?: string }): Promise<void> {
    if (!this.view) {
      vscode.window.showErrorMessage('聊天面板未初始化');
      return;
    }

    try {
      // 检查是否为命令请求
      if (options?.command) {
        await this.executeCommandFromChat(options.command, text);
        return;
      }

      // 检查是否为澄清响应（多轮对话）
      const dialogContext = this.dialogManager.getContext();
      if (dialogContext.state === 'CLARIFYING') {
        await this.handleClarificationResponse(text);
        return;
      }

      // 智能意图识别 + 复杂度评估
      const assessment = this.dialogManager.assessComplexity(text);
      console.log(`[ChatViewProvider] Complexity assessment:`, assessment);

      // 选择交互模式
      const detectedCommand = this.detectIntent(text);
      const taskType = detectedCommand || 'GENERAL_CHAT';
      
      const mode = this.modeSelector.selectMode(
        taskType,
        assessment.complexity,
        assessment.needsClarification,
        this.isExploratoryQuery(text)
      );
      
      console.log(`[ChatViewProvider] Selected interaction mode: ${mode}`);

      // 根据模式决定是否需要澄清
      const shouldClarify = this.modeSelector.shouldEnableClarification(
        mode,
        assessment.needsClarification
      );

      if (shouldClarify && mode !== 'QUICK') {
        // 进入澄清流程
        await this.startClarification(text, taskType, mode);
        return;
      }

      // 直接执行（快速模式或无需澄清）
      if (detectedCommand) {
        console.log(`[ChatViewProvider] Detected intent: ${detectedCommand}`);
        await this.executeCommandFromChat(detectedCommand, text);
        return;
      }

      // 普通对话
      await this.handleGeneralChat(text);
    } catch (error) {
      console.error('[ChatViewProvider] Error handling message:', error);
      vscode.window.showErrorMessage('处理消息时出错');
    }
  }

  /**
   * 处理澄清响应
   */
  private async handleClarificationResponse(userResponse: string): Promise<void> {
    const context = this.dialogManager.getContext();
    const nextQuestion = this.dialogManager.getNextQuestion();
    
    if (nextQuestion) {
      // 记录用户响应
      this.dialogManager.handleUserResponse(nextQuestion.id, userResponse);
      
      // 添加用户消息到会话
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user' as const,
        content: userResponse,
        timestamp: Date.now()
      };
      this.sessionManager.addMessage(userMessage);
      this.view!.webview.postMessage({ type: 'addMessage', message: userMessage });

      // 检查是否还有下一个问题
      const remainingQuestion = this.dialogManager.getNextQuestion();
      if (remainingQuestion) {
        // 继续询问
        await this.sendClarificationQuestion(remainingQuestion);
      } else {
        // 所有问题已回答，执行任务
        const fullContext = this.dialogManager.collectFullContext();
        console.log('[ChatViewProvider] All clarifications answered, executing with context:', fullContext);
        
        // TODO: 使用完整上下文执行任务
        this.dialogManager.reset();
      }
    }
  }

  /**
   * 开始澄清流程
   */
  private async startClarification(
    userMessage: string,
    taskType: string,
    mode: InteractionMode
  ): Promise<void> {
    console.log(`[ChatViewProvider] Starting clarification for task: ${taskType}, mode: ${mode}`);
    
    // 启动对话
    this.dialogManager.startDialog(userMessage, mode);
    
    // 生成澄清问题
    const questions = this.dialogManager.generateClarificationQuestions(userMessage, taskType);
    
    if (questions.length > 0) {
      // 设置问题列表
      (this.dialogManager as any).context.clarificationQuestions = questions;
      
      // 发送第一个问题
      await this.sendClarificationQuestion(questions[0]);
    } else {
      // 无需澄清，直接执行
      this.dialogManager.reset();
      if (this.detectIntent(userMessage)) {
        await this.executeCommandFromChat(this.detectIntent(userMessage)!, userMessage);
      }
    }
  }

  /**
   * 发送澄清问题到UI
   */
  private async sendClarificationQuestion(question: any): Promise<void> {
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant' as const,
      content: question.question,
      timestamp: Date.now()
    };
    
    this.sessionManager.addMessage(assistantMessage);
    this.view!.webview.postMessage({ type: 'addMessage', message: assistantMessage });
    
    console.log(`[ChatViewProvider] Sent clarification question: ${question.question}`);
  }

  /**
   * 处理普通对话
   */
  private async handleGeneralChat(text: string): Promise<void> {
    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user' as const,
      content: text,
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(userMessage);
    this.view!.webview.postMessage({ type: 'addMessage', message: userMessage });

    // 构建上下文
    const contextResult = await this.contextBuilder.build({
      userMessage: text,
      includeSelectedCode: true,
      maxHistoryMessages: 10,
      enableCrossSession: true
    });

    // 生成系统提示
    const systemPrompt = this.promptEngine.generatePrompt(text, contextResult);

    // 创建AI消息占位符
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(assistantMessage);

    console.log('[ChatViewProvider] Sending placeholder message with ID:', assistantMessage.id);
    
    // 发送占位符到UI
    this.view!.webview.postMessage({
      type: 'addMessage',
      message: assistantMessage
    });

    // 调用LLM生成回复
    try {
      console.log('[ChatViewProvider] Calling LLM with messages:', contextResult.messages.length);
      const response = await this.llmTool.call({
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextResult.messages
        ]
      });

      console.log('[ChatViewProvider] LLM response:', { 
        success: response.success, 
        dataLength: response.data?.length || 0,
        error: response.error 
      });

      if (!response.success) {
        throw new Error(response.error || 'LLM 调用失败');
      }

      // 更新AI消息内容
      assistantMessage.content = response.data || '';
      console.log('[ChatViewProvider] Sending updateMessage with ID:', assistantMessage.id, 'Content length:', response.data?.length || 0);
      
      this.view!.webview.postMessage({
        type: 'updateMessage',
        messageId: assistantMessage.id,
        content: response.data || ''
      });
    } catch (error) {
      console.error('[ChatViewProvider] LLM call failed:', error);
      assistantMessage.content = `抱歉，生成回复时出现错误：${error instanceof Error ? error.message : String(error)}`;
      this.view!.webview.postMessage({
        type: 'updateMessage',
        messageId: assistantMessage.id,
        content: assistantMessage.content
      });
    }
  }

  /**
   * 流式响应
   */
  private async streamResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    assistantMessage: ChatMessage
  ): Promise<void> {
    if (!this.view) return;

    let fullContent = '';

    // 发送开始流式响应信号?
    this.view.webview.postMessage({
      type: 'startStreaming',
      messageId: assistantMessage.id
    });

    try {
      // 调用LLM流式API
      const result = await this.llmTool.callStream(
        {
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          maxTokens: 2000,
          temperature: 0.7
        },
        (chunk: string) => {
          fullContent += chunk;
          
          // 实时发送内容块到Webview
          if (this.view) {
            this.view.webview.postMessage({
              type: 'streamChunk',
              messageId: assistantMessage.id,
              chunk: chunk
            });
          }
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'LLM调用失败');
      }

      // 发送完成信号?
      this.view.webview.postMessage({
        type: 'endStreaming',
        messageId: assistantMessage.id,
        content: fullContent
      });

      // 更新assistantMessage的内容
      assistantMessage.content = fullContent;
    } catch (error) {
      console.error('[ChatViewProvider] 流式响应失败:', error);
      
      if (this.view) {
        this.view.webview.postMessage({
          type: 'streamError',
          messageId: assistantMessage.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      assistantMessage.content = `错误: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 智能意图识别
   */
  private readonly INTENT_KEYWORDS: Record<string, string[]> = {
    explainCode: ['解释', 'explain', '什么意思', '这段代码'],
    generateCommit: ['提交', 'commit', 'git提交', '生成提交'],
    checkNaming: ['命名', 'naming', '变量名', '方法名'],
    generateCode: ['生成', 'create', '写一个', '实现一个', '帮我写']
  };

  private detectIntent(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(this.INTENT_KEYWORDS)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }
    
    return null;
  }

  /**
   * 从聊天界面执行命令
   */
  private async executeCommandFromChat(command: string, context?: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[ChatViewProvider] Executing command from chat: ${command}`);
    
    try {
      // 根据命令类型执行对应操作
      switch (command) {
        case 'explainCode':
          await vscode.commands.executeCommand('xiaoweiba.explainCode');
          break;
        case 'generateCommit':
          await vscode.commands.executeCommand('xiaoweiba.generateCommit');
          break;
        case 'checkNaming':
          await vscode.commands.executeCommand('xiaoweiba.checkNaming');
          break;
        case 'generateCode':
          await vscode.commands.executeCommand('xiaoweiba.generateCode');
          break;
        default:
          vscode.window.showWarningMessage(`⚠️ 未知命令: ${command}`);
      }
      
      // 记录审计日志
      const duration = Date.now() - startTime;
      await this.auditLogger.log('chat_command_executed', 'success', duration, {
        parameters: {
          command: command,
          source: 'chat'
        }
      });
      
      // 记录情景记忆
      await this.episodicMemory.record({
        taskType: 'CHAT_COMMAND',
        summary: `聊天触发命令: ${command}`,
        entities: [command, context?.substring(0, 50) || ''],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: duration,
        decision: context || ''
      });
      
      // 通知前端恢复输入状态
      if (this.view) {
        this.view.webview.postMessage({
          type: 'commandExecuted',
          success: true,
          command: command
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[ChatViewProvider] Command execution failed:', error);
      vscode.window.showErrorMessage(`命令执行失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 记录错误日志
      await this.auditLogger.logError('chat_command_executed', error as Error, duration);
      
      // 通知前端命令执行失败
      if (this.view) {
        this.view.webview.postMessage({
          type: 'commandExecuted',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * 加载当前会话
   */
  private async loadCurrentSession(): Promise<void> {
    if (!this.view) return;

    const session = this.sessionManager.getCurrentSession();
    if (session) {
      this.view.webview.postMessage({
        type: 'loadSession',
        session: session
      });
    }
  }

  /**
   * 更新会话列表
   */
  private async updateSessionList(): Promise<void> {
    if (!this.view) return;

    const sessions = this.sessionManager.getAllSessions();
    const currentSessionId = this.sessionManager.getCurrentSession()?.id;

    this.view.webview.postMessage({
      type: 'updateSessionList',
      sessions: sessions,
      currentSessionId: currentSessionId
    });
  }

  /**
   * 订阅主动推荐事件
   */
  private subscribeToRecommendations(): void {
    const eventBus = new EventBus();
    
    eventBus.subscribe(CoreEventType.MEMORY_RECOMMEND, (payload) => {
      console.log('[ChatViewProvider] Received MEMORY_RECOMMEND event:', payload);
      
      if (!this.view) {
        console.warn('[ChatViewProvider] View not ready, skipping recommendation display');
        return;
      }

      // 在聊天面板顶部显示推荐提示
      const recommendations = (payload as any).recommendations || [];
      if (recommendations.length > 0) {
        const message = `📌 你可能需要这些历史记忆：\n${recommendations.map((r: any) => `- ${r.summary || r}`).join('\n')}`;
        
        this.view.webview.postMessage({
          type: 'showNotification',
          text: message,
          level: 'info'
        });
      }
    });
  }

  /**
   * 获取Webview的HTML内容
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return generateChatViewHtml(webview);
  }

  /**
   * 判断是否为探索性查询
   */
  private isExploratoryQuery(message: string): boolean {
    const exploratoryPatterns = [
      /怎么.*\?/,
      /如何.*\?/,
      /什么是.*/,
      /学习.*/,
      /了解.*/,
      /最佳实践/
    ];
    
    return exploratoryPatterns.some(pattern => pattern.test(message));
  }
}
