import * as vscode from 'vscode';
import { SessionManager } from './SessionManager';
import { ContextBuilder } from './ContextBuilder';
import { PromptEngine } from './PromptEngine';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';
import { ConfigManager } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { generateChatViewHtml } from './ChatViewHtml';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

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

      // 智能意图识别：分析用户消息，自动执行对应命令
      const detectedCommand = this.detectIntent(text);
      if (detectedCommand) {
        console.log(`[ChatViewProvider] Detected intent: ${detectedCommand}`);
        await this.executeCommandFromChat(detectedCommand, text);
        return;
      }

      // 添加用户消息到会�?
      const userMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user' as const,
        content: text,
        timestamp: Date.now(),
        metadata: {
          command: options?.command
        }
      };
      this.sessionManager.addMessage(userMessage);

      // 发送用户消息到Webview
      this.view.webview.postMessage({
        type: 'addMessage',
        message: userMessage
      });

      // 构建上下文和Prompt
      const contextResult = await this.contextBuilder.build({
        userMessage: text,
        includeSelectedCode: true,
        maxHistoryMessages: 10,
        enableCrossSession: true
      });

      // 生成系统提示
      const systemPrompt = this.promptEngine.generatePrompt(
        text,
        contextResult,
        options?.command
      );

      // 创建AI消息占位�?
      const assistantMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now()
      };

      // 流式响应
      const startTime = Date.now();
      await this.streamResponse(contextResult.messages, systemPrompt, assistantMessage);
      const duration = Date.now() - startTime;

      // 添加AI消息到会话
      this.sessionManager.addMessage(assistantMessage);

      // 记录到审计日志
      await this.auditLogger.log('chat_message', 'success', duration, {
        parameters: { messageLength: text.length }
      });
    } catch (error) {
      console.error('[ChatViewProvider] 处理消息失败:', error);
      
      // 发送错误消�?
      if (this.view) {
        this.view.webview.postMessage({
          type: 'errorMessage',
          error: error instanceof Error ? error.message : String(error)
        });
      }
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

    // 发送开始流式响应信�?
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

      // 发送完成信�?
      this.view.webview.postMessage({
        type: 'endStreaming',
        messageId: assistantMessage.id,
        content: fullContent
      });

      // 更新assistantMessage的内�?
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
   * 获取Webview的HTML内容
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return generateChatViewHtml(webview);
  }
}
