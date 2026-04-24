import * as vscode from 'vscode';
import { inject, injectable } from 'tsyringe';
import { IEventBus } from '../core/ports/IEventBus';
import { IntentDispatcher } from '../core/application/IntentDispatcher';
import { IntentFactory } from '../core/factory/IntentFactory';
import { IMemoryPort } from '../core/ports/IMemoryPort'; // ✅ DeepSeek 风格：注入 MemoryPort
import { AssistantResponseEvent, StreamChunkEvent, SessionListUpdatedEvent, SessionHistoryLoadedEvent, FeedbackGivenEvent } from '../core/events/DomainEvent'; // ✅ P1-04: 引入新事件
import { generateChatViewHtml } from './ChatViewHtml';
import { ChatMessage } from './types';

/**
 * 聊天视图提供者（纯视图层）
 * 
 * 职责：
 * 1. 管理Webview生命周期
 * 2. 接收用户输入，转化为chat意图并发布
 * 3. 监听领域事件，刷新UI
 * 
 * 不再持有：SessionManager、ContextBuilder、PromptEngine、LLMTool等
 */
@injectable()
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'xiaoweiba.chatView';

  private view?: vscode.WebviewView;
  private currentSessionId: string | undefined;
  private unsubscribers: Array<() => void> = []; // ✅ 保存取消订阅函数

  constructor(
    @inject('IEventBus') private eventBus: IEventBus,
    @inject(IntentDispatcher) private intentDispatcher: IntentDispatcher,
    @inject('IMemoryPort') private memoryPort: IMemoryPort, // ✅ DeepSeek 风格：注入 MemoryPort
    @inject('extensionContext') private context: vscode.ExtensionContext
  ) {
    this.subscribeToDomainEvents();
  }

  /**
   * 订阅领域事件
   */
  private subscribeToDomainEvents(): void {
    // ✅ 订阅流式块事件（逐字更新）
    this.unsubscribers.push(
      this.eventBus.subscribe(StreamChunkEvent.type, (event) => {
        // ✅ 修复：从 payload 中提取 chunk 数据
        const streamEvent = event as any;
        const payload = streamEvent.payload || streamEvent;
        
        // ✅ 调试日志
        console.log('[ChatViewProvider] received streamChunk:', payload.chunk);
        
        this.view?.webview.postMessage({
          type: 'streamChunk',
          messageId: payload.messageId,
          chunk: payload.chunk
        });
      })
    );

    // ✅ 订阅完整响应事件（兜底，确保消息完整性）
    this.unsubscribers.push(
      this.eventBus.subscribe(AssistantResponseEvent.type, (event) => {
        // ✅ 类型安全：AssistantResponseEvent的payload有明确结构
        const responseEvent = event as AssistantResponseEvent;
        const payload = responseEvent.payload as { messageId: string; content: string; timestamp: number };
        this.view?.webview.postMessage({
          type: 'assistantResponse',
          messageId: payload.messageId,
          content: payload.content,
          timestamp: payload.timestamp
        });
      })
    );

    // TODO: 订阅推荐事件
    // ⚠️ 注意：如果未来实现此功能，必须将取消函数推入 this.unsubscribers 数组
    // this.unsubscribers.push(this.eventBus.subscribe(MemoryRecommendEvent.type, (event) => { ... }));

    // ✅ P1-02: 订阅会话列表更新事件
    this.unsubscribers.push(
      this.eventBus.subscribe(SessionListUpdatedEvent.type, async (event) => {
        const sessionEvent = event as any;
        const payload = sessionEvent.payload || sessionEvent;
        
        console.log('[ChatViewProvider] Session list updated:', payload.action, payload.sessionId);
        
        try {
          // ✅ 修复：如果是新建会话，保存当前会话 ID
          if (payload.action === 'created' && payload.sessionId) {
            this.currentSessionId = payload.sessionId;
            await this.context.workspaceState.update('currentSessionId', payload.sessionId);
            console.log('[ChatViewProvider] Saved new session to workspaceState:', payload.sessionId);
          }
          
          // ✅ 通过 IMemoryPort 获取完整的会话列表
          const sessions = await this.memoryPort.listSessions();
          
          this.view?.webview.postMessage({
            type: 'updateSessionList',
            sessions,
            currentSessionId: this.currentSessionId  // ✅ 使用当前的 sessionId
          });
          
          console.log('[ChatViewProvider] Sent session list to frontend:', sessions.length, 'sessions');
        } catch (error) {
          console.error('[ChatViewProvider] Failed to send session list:', error);
        }
      })
    );

    // ✅ P1-04: 订阅会话历史加载事件（用于渲染完整历史）
    this.unsubscribers.push(
      this.eventBus.subscribe(SessionHistoryLoadedEvent.type, (event) => {
        const historyEvent = event as any;
        const payload = historyEvent.payload || historyEvent;
        
        console.log('[ChatViewProvider] SessionHistoryLoadedEvent received');
        console.log('[ChatViewProvider] Session ID:', payload.sessionId);
        console.log('[ChatViewProvider] Messages count:', payload.messages?.length || 0);
        
        // 通知前端加载会话历史
        const messageData = {
          type: 'loadSession',
          session: {
            id: payload.sessionId,
            messages: payload.messages
          }
        };
        
        console.log('[ChatViewProvider] Sending loadSession to webview...');
        this.view?.webview.postMessage(messageData);
        console.log('[ChatViewProvider] loadSession message sent');
      })
    );
  }

  /**
   * 解析Webview视图
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    try {
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri]
      };

      webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

      // ✅ 修复：从 workspaceState 恢复之前的会话 ID
      const savedSessionId = this.context.workspaceState.get<string>('currentSessionId');
      if (savedSessionId) {
        this.currentSessionId = savedSessionId;
        console.log('[ChatViewProvider] Restored session:', savedSessionId);
        
        // ✅ 恢复会话后，自动加载历史消息
        await this.handleSwitchSession(savedSessionId);
      }

      // 处理来自Webview的消息
      webviewView.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case 'sendMessage':
            await this.handleUserInput(message.text);
            break;
          case 'newSession':
            await this.handleNewSession();
            break;
          case 'switchSession':
            await this.handleSwitchSession(message.sessionId);
            break;
          case 'deleteSession':
            await this.handleDeleteSession(message.sessionId);
            break;
          case 'feedback':
            // ✅ 修复 #3：处理用户反馈，激活学习闭环
            console.log('[ChatViewProvider] Feedback received:', message);
            
            const { query, memoryId, dwellTimeMs } = message;
            if (query && memoryId && dwellTimeMs !== undefined) {
              // 发布反馈事件，ExpertSelector 会订阅并处理
              this.eventBus.publish(new FeedbackGivenEvent(query, memoryId, dwellTimeMs));
              console.log('[ChatViewProvider] FeedbackGivenEvent published:', { query, memoryId, dwellTimeMs });
            } else {
              console.warn('[ChatViewProvider] Invalid feedback message:', message);
            }
            break;
        }
      });

      // 异步加载初始数据
      setTimeout(() => {
        if (this.view) {
          this.view.webview.postMessage({ type: 'hideLoading' });
        }
      }, 1000);
    } catch (error) {
      // 审计日志已在extension.ts中记录，此处直接抛出
      throw error;
    }
  }

  /**
   * 处理用户输入
   */
  private async handleUserInput(text: string): Promise<void> {
    if (!text.trim()) return;

    try {
      // 1. ✅ 截断超长消息，防止Webview崩溃（最多50000字符）
      const MAX_MESSAGE_LENGTH = 50000;
      let truncatedText = text;
      if (text.length > MAX_MESSAGE_LENGTH) {
        truncatedText = text.substring(0, MAX_MESSAGE_LENGTH);
        vscode.window.showWarningMessage(`消息过长，已截断至${MAX_MESSAGE_LENGTH}字符`);
      }
      
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: truncatedText,
        timestamp: Date.now()
      };
      this.view?.webview.postMessage({ type: 'addMessage', message: userMessage });

      // 2. 显示加载状态
      this.view?.webview.postMessage({ type: 'setLoading', loading: true });

      // 3. ✅ L1: 构建聊天意图（已内置上下文采集和意图分析）
      const intent = await IntentFactory.buildChatIntent(text, {
        sessionId: this.currentSessionId
      });

      // 5. 调度意图
      await this.intentDispatcher.dispatch(intent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ChatViewProvider] handleUserInput failed:', errorMessage);
      
      // ✅ 修复：发送错误消息并恢复输入框状态
      this.view?.webview.postMessage({
        type: 'showError',
        error: errorMessage
      });
      
      // ✅ 修复：显式发送 enableInput 消息，防止输入框死锁
      this.view?.webview.postMessage({ type: 'enableInput' });
    } finally {
      this.view?.webview.postMessage({ type: 'setLoading', loading: false });
    }
  }

  /**
   * 处理新建会话
   */
  private async handleNewSession(): Promise<void> {
    try {
      // 通过IntentDispatcher调度新建会话意图
      const intent = IntentFactory.buildNewSessionIntent();
      await this.intentDispatcher.dispatch(intent);
      
      // 通知UI清空消息列表
      this.view?.webview.postMessage({ type: 'clearMessages' });
    } catch (error) {
      vscode.window.showWarningMessage('新建会话失败，请重试');
      throw error;
    }
  }

  /**
   * 处理切换会话
   */
  private async handleSwitchSession(sessionId: string): Promise<void> {
    try {
      console.log('[ChatViewProvider] Handling switchSession:', sessionId);
      this.currentSessionId = sessionId;
      
      // ✅ 修复：保存当前会话 ID 到 workspaceState
      await this.context.workspaceState.update('currentSessionId', sessionId);
      console.log('[ChatViewProvider] Saved session to workspaceState:', sessionId);
      
      // ✅ P1-04: 通过IntentDispatcher处理切换逻辑
      // SessionManagementAgent 会发布 SessionHistoryLoadedEvent，由 ChatViewProvider 订阅并转发给前端
      const intent = IntentFactory.buildSwitchSessionIntent(sessionId);
      console.log('[ChatViewProvider] Dispatching switch_session intent...');
      await this.intentDispatcher.dispatch(intent);
      console.log('[ChatViewProvider] Switch session completed');
    } catch (error) {
      console.error('[ChatViewProvider] Switch session error:', error);
      vscode.window.showWarningMessage('切换会话失败，请重试');
      throw error;
    }
  }

  /**
   * 处理删除会话
   */
  private async handleDeleteSession(sessionId: string): Promise<void> {
    try {
      // 通过IntentDispatcher调度删除会话意图
      const intent = IntentFactory.buildDeleteSessionIntent(sessionId);
      await this.intentDispatcher.dispatch(intent);
      
      // 如果删除的是当前会话，清空并尝试切换到第一个可用会话
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = undefined;
        
        // ✅ 修复：清除 workspaceState 中的会话 ID
        await this.context.workspaceState.update('currentSessionId', undefined);
        console.log('[ChatViewProvider] Cleared session from workspaceState');
        
        this.view?.webview.postMessage({ type: 'clearMessages' });
        
        // ✅ DeepSeek 风格：删除当前会话后，自动切换到第一个可用会话
        setTimeout(async () => {
          try {
            const sessions = await this.memoryPort.listSessions();
            if (sessions.length > 0) {
              // 切换到第一个会话
              const firstSession = sessions[0];
              this.currentSessionId = firstSession.id;
              
              // ✅ 修复：保存新的会话 ID
              await this.context.workspaceState.update('currentSessionId', firstSession.id);
              console.log('[ChatViewProvider] Saved auto-switched session:', firstSession.id);
              
              // 触发切换逻辑
              const switchIntent = IntentFactory.buildSwitchSessionIntent(firstSession.id);
              await this.intentDispatcher.dispatch(switchIntent);
              
              console.log('[ChatViewProvider] Auto-switched to session:', firstSession.id);
            }
          } catch (error) {
            console.error('[ChatViewProvider] Failed to auto-switch session:', error);
          }
        }, 100);
      }
    } catch (error) {
      vscode.window.showWarningMessage('删除会话失败，请重试');
      throw error;
    }
  }

  /**
   * 获取Webview HTML
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return generateChatViewHtml(webview);
  }

  /**
   * 获取当前会话ID
   */
  private getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * ✅ 清理资源（插件停用时调用）
   */
  dispose(): void {
    // 取消所有事件订阅，防止内存泄漏
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
