import * as vscode from 'vscode';
import { SessionManager } from './SessionManager';
import { ContextBuilder } from './ContextBuilder';
import { PromptEngine } from './PromptEngine';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';
import { ConfigManager } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';

/**
 * 聊天视图提供者
 * 
 * 实现VS Code侧边栏聊天面板，支持多轮对话、流式响应
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
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // 处理来自Webview的消息
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

    // 加载当前会话
    await this.loadCurrentSession();
    await this.updateSessionList();
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
      // 添加用户消息到会话
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

      // 创建AI消息占位符
      const assistantMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now()
      };

      // 流式响应
      await this.streamResponse(contextResult.messages, systemPrompt, assistantMessage);

      // 添加AI消息到会话
      this.sessionManager.addMessage(assistantMessage);

      // 记录到审计日志
      await this.auditLogger.log('chat_message', 'success', 0, {
        parameters: { messageLength: text.length }
      });
    } catch (error) {
      console.error('[ChatViewProvider] 处理消息失败:', error);
      
      // 发送错误消息
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
    messages: any[],
    systemPrompt: string,
    assistantMessage: { id: string; role: 'assistant'; content: string; timestamp: number }
  ): Promise<void> {
    if (!this.view) return;

    let fullContent = '';

    // 发送开始流式响应信号
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
          this.view!.webview.postMessage({
            type: 'streamChunk',
            messageId: assistantMessage.id,
            chunk: chunk
          });
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'LLM调用失败');
      }

      // 发送完成信号
      this.view.webview.postMessage({
        type: 'endStreaming',
        messageId: assistantMessage.id,
        content: fullContent
      });

      // 更新assistantMessage的内容
      assistantMessage.content = fullContent;
    } catch (error) {
      console.error('[ChatViewProvider] 流式响应失败:', error);
      
      this.view.webview.postMessage({
        type: 'streamError',
        messageId: assistantMessage.id,
        error: error instanceof Error ? error.message : String(error)
      });

      assistantMessage.content = `错误: ${error instanceof Error ? error.message : String(error)}`;
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
    // 使用CDN加载marked.js、highlight.js和DOMPurify
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src https://cdn.jsdelivr.net; img-src data: https:;">
  <title>小尾巴AI助手</title>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h2 {
      font-size: 14px;
      font-weight: 600;
    }

    .session-selector {
      display: flex;
      gap: 5px;
    }

    .session-selector select {
      flex: 1;
      padding: 4px 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 3px;
      font-size: 12px;
    }

    .session-selector button {
      padding: 4px 8px;
      border: 1px solid var(--vscode-button-border);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
    }

    .session-selector button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }

    .message {
      margin-bottom: 15px;
      display: flex;
      flex-direction: column;
    }

    .message.user {
      align-items: flex-end;
    }

    .message.assistant {
      align-items: flex-start;
    }

    .message-content {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 8px;
      line-height: 1.5;
    }

    .message.user .message-content {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .message.assistant .message-content {
      background: var(--vscode-editor-inactiveSelectionBackground);
      color: var(--vscode-editor-foreground);
    }

    .message-content pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }

    .message-content code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }

    .input-container {
      padding: 10px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }

    .input-container textarea {
      flex: 1;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      resize: none;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      min-height: 40px;
      max-height: 120px;
    }

    .input-container textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .input-container button {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .input-container button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .input-container button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-message {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 10px;
      border-radius: 4px;
      margin: 10px;
    }

    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      padding: 4px 0;
    }

    .typing-indicator span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-foreground);
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-8px);
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>🤖 小尾巴AI助手</h2>
    <div class="session-selector">
      <select id="sessionSelect"></select>
      <button id="newSessionBtn">新会话</button>
      <button id="deleteSessionBtn">删除</button>
    </div>
  </div>

  <div class="messages-container" id="messagesContainer"></div>

  <div class="input-container">
    <textarea id="messageInput" placeholder="输入消息... (Enter发送, Shift+Enter换行)" rows="1"></textarea>
    <button id="sendBtn">发送</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentMessageId = null;
    let currentMessageContent = '';

    // 配置marked
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true
    });

    // 发送消息
    function sendMessage() {
      const input = document.getElementById('messageInput');
      const text = input.value.trim();
      if (!text) return;

      vscode.postMessage({
        type: 'sendMessage',
        text: text
      });

      input.value = '';
      input.style.height = 'auto';
    }

    // 处理Enter键
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.getElementById('sendBtn').addEventListener('click', sendMessage);

    // 新会话
    document.getElementById('newSessionBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'newSession' });
    });

    // 删除会话
    document.getElementById('deleteSessionBtn').addEventListener('click', () => {
      const select = document.getElementById('sessionSelect');
      const sessionId = select.value;
      if (sessionId) {
        vscode.postMessage({ type: 'deleteSession', sessionId: sessionId });
      }
    });

    // 切换会话
    document.getElementById('sessionSelect').addEventListener('change', (e) => {
      const sessionId = e.target.value;
      if (sessionId) {
        vscode.postMessage({ type: 'switchSession', sessionId: sessionId });
      }
    });

    // 自动调整textarea高度
    document.getElementById('messageInput').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // 处理来自扩展的消息
    window.addEventListener('message', event => {
      const message = event.data;
      const container = document.getElementById('messagesContainer');

      switch (message.type) {
        case 'addMessage':
          appendMessage(message.message);
          break;

        case 'startStreaming':
          currentMessageId = message.messageId;
          currentMessageContent = '';
          createStreamingMessage(message.messageId);
          break;

        case 'streamChunk':
          currentMessageContent += message.chunk;
          updateStreamingMessage(message.messageId, currentMessageContent);
          break;

        case 'endStreaming':
          finishStreamingMessage(message.messageId, message.content);
          break;

        case 'streamError':
          finishStreamingMessage(message.messageId, '❌ ' + message.error, true);
          break;

        case 'errorMessage':
          showError(message.error);
          break;

        case 'loadSession':
          loadSession(message.session);
          break;

        case 'updateSessionList':
          updateSessionList(message.sessions, message.currentSessionId);
          break;
      }
    });

    function appendMessage(msg) {
      const container = document.getElementById('messagesContainer');
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;
      
      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = renderMarkdown(msg.content);
      
      div.appendChild(content);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function createStreamingMessage(messageId) {
      const container = document.getElementById('messagesContainer');
      const div = document.createElement('div');
      div.className = 'message assistant';
      div.id = 'msg-' + messageId;
      
      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
      
      div.appendChild(content);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function updateStreamingMessage(messageId, content) {
      const msgDiv = document.getElementById('msg-' + messageId);
      if (msgDiv) {
        const contentDiv = msgDiv.querySelector('.message-content');
        contentDiv.innerHTML = renderMarkdown(content);
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
      }
    }

    function finishStreamingMessage(messageId, content, isError = false) {
      const msgDiv = document.getElementById('msg-' + messageId);
      if (msgDiv) {
        const contentDiv = msgDiv.querySelector('.message-content');
        if (isError) {
          contentDiv.innerHTML = content;
        } else {
          contentDiv.innerHTML = renderMarkdown(content);
        }
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
      }
    }

    function renderMarkdown(text) {
      try {
        // 先使用marked解析Markdown
        const rawHtml = marked.parse(text);
        // 使用DOMPurify清理HTML，防止XSS
        return DOMPurify.sanitize(rawHtml, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
          ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id']
        });
      } catch (e) {
        // 如果解析失败，转义HTML并返回
        return escapeHtml(text).replace(/\n/g, '<br>');
      }
    }
    
    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    function showError(error) {
      const container = document.getElementById('messagesContainer');
      const div = document.createElement('div');
      div.className = 'error-message';
      div.textContent = '❌ ' + error;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function loadSession(session) {
      const container = document.getElementById('messagesContainer');
      container.innerHTML = '';
      
      session.messages.forEach(msg => {
        appendMessage(msg);
      });
    }

    function updateSessionList(sessions, currentSessionId) {
      const select = document.getElementById('sessionSelect');
      select.innerHTML = '';
      
      sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = session.title;
        if (session.id === currentSessionId) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  </script>
</body>
</html>`;
  }
}
