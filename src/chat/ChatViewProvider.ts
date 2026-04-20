import * as vscode from 'vscode';
import { inject, injectable } from 'tsyringe';
import { IEventBus } from '../core/ports/IEventBus';
import { IntentDispatcher } from '../core/application/IntentDispatcher';
import { IntentFactory } from '../core/factory/IntentFactory';
import { AssistantResponseEvent, StreamChunkEvent } from '../core/events/DomainEvent';
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
  }

  /**
   * 解析Webview视图
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log('[ChatViewProvider] resolveWebviewView called');
    this.view = webviewView;

    try {
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri]
      };

      console.log('[ChatViewProvider] Setting webview HTML...');
      webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
      console.log('[ChatViewProvider] Webview HTML set successfully');

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
      console.error('[ChatViewProvider] Failed to resolve webview:', error);
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

      // 3. 构建聊天意图
      const intent = IntentFactory.buildChatIntent(text, {
        sessionId: this.currentSessionId
      });

      // 4. 调度意图
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
      console.error('[ChatViewProvider] Failed to create new session:', error);
      vscode.window.showWarningMessage('新建会话失败，请重试');
    }
  }

  /**
   * 处理切换会话
   */
  private async handleSwitchSession(sessionId: string): Promise<void> {
    try {
      this.currentSessionId = sessionId;
      
      // 通过IntentDispatcher加载会话历史
      const intent = IntentFactory.buildSwitchSessionIntent(sessionId);
      await this.intentDispatcher.dispatch(intent);
      
      // 通知UI重新加载
      this.view?.webview.postMessage({ type: 'reloadSession', sessionId });
    } catch (error) {
      console.error('[ChatViewProvider] Failed to switch session:', error);
      vscode.window.showWarningMessage('切换会话失败，请重试');
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
      console.error('[ChatViewProvider] Failed to delete session:', error);
      vscode.window.showWarningMessage('删除会话失败，请重试');
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
    console.log('[ChatViewProvider] Disposed, event subscriptions cancelled');
  }
}
