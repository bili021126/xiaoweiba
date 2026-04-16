import * as vscode from 'vscode';

/**
 * 生成聊天视图的Webview HTML
 * 不使用CDN，采用简单文本渲染
 */
export function generateChatViewHtml(webview: vscode.Webview): string {
  const cspSource = webview.cspSource;
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
  <title>小尾巴AI助手</title>
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
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--vscode-sideBar-background);
      backdrop-filter: blur(10px);
    }

    .header h2 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .session-selector {
      display: flex;
      gap: 5px;
    }

    .session-selector select {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .session-selector select:hover {
      border-color: var(--vscode-focusBorder);
    }

    .session-selector select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px rgba(var(--vscode-focusBorder), 0.2);
    }

    .session-selector button {
      padding: 6px 12px;
      border: 1px solid var(--vscode-button-border);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .session-selector button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .session-selector button:active {
      transform: translateY(0);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
    }

    /* 自定义滚动条 */
    .messages-container::-webkit-scrollbar {
      width: 8px;
    }

    .messages-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .messages-container::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 4px;
    }

    .messages-container::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground);
    }

    .message {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      align-items: flex-end;
    }

    .message.assistant {
      align-items: flex-start;
    }

    .message-content {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.6;
      word-wrap: break-word;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
    }

    .message-content:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .message.user .message-content {
      background: linear-gradient(135deg, var(--vscode-button-background) 0%, var(--vscode-button-hoverBackground) 100%);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-content {
      background: var(--vscode-editor-inactiveSelectionBackground);
      color: var(--vscode-editor-foreground);
      border-bottom-left-radius: 4px;
    }

    .message-content pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 10px 0;
      border: 1px solid var(--vscode-panel-border);
    }

    .message-content code {
      font-family: var(--vscode-editor-font-family);
      font-size: calc(var(--vscode-editor-font-size) * 0.95);
      background: rgba(128, 128, 128, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .message-content pre code {
      background: transparent;
      padding: 0;
    }

    .input-container {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      position: relative;
      background: var(--vscode-sideBar-background);
    }

    .input-hints {
      position: absolute;
      top: -24px;
      left: 16px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      gap: 12px;
    }

    .input-hints span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .input-hints kbd {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
      font-family: var(--vscode-font-family);
    }

    .input-container textarea {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 8px;
      resize: none;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      min-height: 44px;
      max-height: 120px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .input-container textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px rgba(var(--vscode-focusBorder), 0.2);
    }

    .input-container button {
      padding: 10px 20px;
      background: linear-gradient(135deg, var(--vscode-button-background) 0%, var(--vscode-button-hoverBackground) 100%);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .input-container button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .input-container button:active {
      transform: translateY(0);
    }

    .input-container button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input-container button.sending {
      position: relative;
      color: transparent;
    }

    .input-container button.sending::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      top: 50%;
      left: 50%;
      margin-left: -8px;
      margin-top: -8px;
      border: 2px solid var(--vscode-button-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .memory-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .memory-indicator.active {
      background: rgba(0, 122, 204, 0.1);
      color: var(--vscode-textLink-foreground);
    }

    .memory-indicator .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse-dot 2s infinite;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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
      padding: 6px 0;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-foreground);
      opacity: 0.6;
      animation: typing 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(1) {
      animation-delay: 0s;
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
        opacity: 0.6;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }
  </style>
</head>
<body>
  <div id="loadingIndicator" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--vscode-descriptionForeground); z-index: 1000;">
    <div style="font-size: 32px; margin-bottom: 12px; animation: pulse 1.5s infinite;">⏳</div>
    <div style="font-size: 14px; font-weight: 500;">加载中...</div>
  </div>
  
  <style>
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
  </style>
  
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
    <div class="input-hints">
      <span><kbd>Enter</kbd> 发送</span>
      <span><kbd>Shift+Enter</kbd> 换行</span>
    </div>
    <textarea id="messageInput" placeholder="输入消息... (Enter发送, Shift+Enter换行)" rows="1"></textarea>
    <button id="sendBtn">发送</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentMessageId = null;
    let currentMessageContent = '';

    // 隐藏loading指示器
    function hideLoading() {
      const loading = document.getElementById('loadingIndicator');
      if (loading) {
        loading.style.display = 'none';
      }
    }

    // 页面加载完成后立即隐藏loading
    window.addEventListener('DOMContentLoaded', () => {
      hideLoading();
    });

    // 缓存正则表达式（性能优化）
    const backtick = '\x60';
    const codeBlockRegex = new RegExp(backtick + backtick + backtick + '([\\s\\S]*?)' + backtick + backtick + backtick, 'g');
    const inlineCodeRegex = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
    const ampRegex = new RegExp('&', 'g');
    const ltRegex = new RegExp('<', 'g');
    const gtRegex = new RegExp('>', 'g');
    const newlineRegex = new RegExp('\\n', 'g');

    // 简单Markdown渲染（替换代码块和换行）
    function renderMarkdown(text) {
      if (!text) return '';
      // 转义HTML
      let html = text.replace(ampRegex, '&amp;').replace(ltRegex, '&lt;').replace(gtRegex, '&gt;');
      // 代码块
      html = html.replace(codeBlockRegex, '<pre><code>$1</code></pre>');
      // 行内代码
      html = html.replace(inlineCodeRegex, '<code>$1</code>');
      // 换行
      html = html.replace(newlineRegex, '<br>');
      return html;
    }

    // 添加消息
    function appendMessage(msg) {
      const container = document.getElementById('messagesContainer');
      if (!container) return;
      
      const div = document.createElement('div');
      div.className = 'message ' + msg.role;
      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = renderMarkdown(msg.content);
      div.appendChild(content);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    // 创建流式消息
    function createStreamingMessage(messageId) {
      const container = document.getElementById('messagesContainer');
      if (!container) return;
      
      const div = document.createElement('div');
      div.className = 'message assistant';
      div.id = 'msg-' + messageId;
      const content = document.createElement('div');
      content.className = 'message-content streaming';
      content.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
      div.appendChild(content);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    // 更新流式消息
    function updateStreamingMessage(messageId, content) {
      const div = document.getElementById('msg-' + messageId);
      if (!div) return;
      
      const contentDiv = div.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = renderMarkdown(content);
      }
      
      const container = document.getElementById('messagesContainer');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    // 完成流式消息
    function finishStreamingMessage(messageId, content, isError = false) {
      const div = document.getElementById('msg-' + messageId);
      if (!div) return;
      
      const contentDiv = div.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.className = 'message-content' + (isError ? ' error' : '');
        contentDiv.innerHTML = renderMarkdown(content);
      }
      
      const container = document.getElementById('messagesContainer');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      
      currentMessageId = null;
      currentMessageContent = '';
    }

    // 显示错误
    function showError(error) {
      const container = document.getElementById('messagesContainer');
      if (!container) return;
      
      const div = document.createElement('div');
      div.className = 'message error';
      const content = document.createElement('div');
      content.className = 'message-content';
      content.textContent = '❌ ' + error;
      div.appendChild(content);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    // 发送消息
    function sendMessage() {
      const input = document.getElementById('messageInput');
      if (!input) return;
      
      const text = input.value.trim();
      if (!text) return;

      // 禁用输入和按钮，显示加载状态
      input.disabled = true;
      const sendBtn = document.getElementById('sendBtn');
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.classList.add('sending');
      }

      vscode.postMessage({
        type: 'sendMessage',
        text: text
      });

      input.value = '';
      input.style.height = 'auto';
    }

    // 启用输入
    function enableInput() {
      const input = document.getElementById('messageInput');
      if (input) input.disabled = false;
      
      const sendBtn = document.getElementById('sendBtn');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('sending');
      }
    }

    // 处理Enter键
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }

    // 新会话
    const newSessionBtn = document.getElementById('newSessionBtn');
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'newSession' });
      });
    }

    // 删除会话
    const deleteSessionBtn = document.getElementById('deleteSessionBtn');
    if (deleteSessionBtn) {
      deleteSessionBtn.addEventListener('click', () => {
        const select = document.getElementById('sessionSelect');
        if (select && select.value) {
          vscode.postMessage({ type: 'deleteSession', sessionId: select.value });
        }
      });
    }

    // 切换会话
    const sessionSelect = document.getElementById('sessionSelect');
    if (sessionSelect) {
      sessionSelect.addEventListener('change', (e) => {
        const sessionId = e.target.value;
        if (sessionId) {
          vscode.postMessage({ type: 'switchSession', sessionId: sessionId });
        }
      });
    }

    // 自动调整textarea高度
    if (messageInput) {
      messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }

    // 处理来自扩展的消息
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'addMessage':
          appendMessage(message.message);
          break;

        case 'startStreaming':
          createStreamingMessage(message.messageId);
          currentMessageId = message.messageId;
          currentMessageContent = '';
          break;

        case 'streamChunk':
          if (message.messageId === currentMessageId) {
            currentMessageContent += message.chunk;
            updateStreamingMessage(currentMessageId, currentMessageContent);
          }
          break;

        case 'endStreaming':
          finishStreamingMessage(message.messageId, message.content);
          enableInput();
          break;

        case 'streamError':
          finishStreamingMessage(message.messageId, message.error, true);
          enableInput();
          break;

        case 'errorMessage':
          showError(message.error);
          enableInput();
          break;

        case 'loadSession':
          const container = document.getElementById('messagesContainer');
          container.innerHTML = '';
          if (message.session && message.session.messages) {
            message.session.messages.forEach(msg => appendMessage(msg));
          }
          break;

        case 'updateSessionList':
          updateSessionList(message.sessions, message.currentSessionId);
          break;

        case 'hideLoading':
          hideLoading();
          break;
      }
    });

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
