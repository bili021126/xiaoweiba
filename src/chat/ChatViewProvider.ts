import * as vscode from 'vscode';
import { inject, injectable } from 'tsyringe';
import { IEventBus } from '../core/ports/IEventBus';
import { IntentDispatcher } from '../core/application/IntentDispatcher';
import { IntentFactory } from '../core/factory/IntentFactory';
import { ContextEnricher } from '../core/application/ContextEnricher';
import { AssistantResponseEvent, StreamChunkEvent, SessionListUpdatedEvent, SessionHistoryLoadedEvent } from '../core/events/DomainEvent'; // ✅ P1-04: 引入新事件
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
    @inject(ContextEnricher) private contextEnricher: ContextEnricher,
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
        // ✅ 类型安全：StreamChunkEvent有明确的messageId和chunk字段
        const streamEvent = event as StreamChunkEvent;
        this.view?.webview.postMessage({
          type: 'streamChunk',
          messageId: streamEvent.messageId,
          chunk: streamEvent.chunk
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
    // this.unsubscribers.push(this.eventBus.subscribe(MemoryRecommendEvent.type, (event) => { ... }));

    // ✅ P1-02: 订阅会话列表更新事件
    this.unsubscribers.push(
      this.eventBus.subscribe(SessionListUpdatedEvent.type, (event) => {
        // ✅ P1-04: EventBusAdapter 将 DomainEvent 转换为 BaseEvent，需要从 payload 中提取数据
        const sessionEvent = event as any;
        const payload = sessionEvent.payload || sessionEvent;
        
        console.log('[ChatViewProvider] Session list updated:', payload.action, payload.sessionId);
        
        // 通知前端刷新会话列表
        this.view?.webview.postMessage({
          type: 'refreshSessionList',
          action: payload.action,
          sessionId: payload.sessionId
        });
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
            // TODO: 发布反馈事件
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
      this.view?.webview.postMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
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
      
      // 如果删除的是当前会话，清空
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = undefined;
        this.view?.webview.postMessage({ type: 'clearMessages' });
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
