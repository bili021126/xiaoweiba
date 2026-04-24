/**
 * Chat View JavaScript 逻辑
 * 
 * 职责：
 * - 消息渲染与流式更新
 * - Markdown 解析
 * - 会话管理
 * - 用户交互事件处理
 * 
 * TODO: 未来在此添加反馈计时器逻辑
 */

export const CHAT_SCRIPTS = `
  const vscode = acquireVsCodeApi();
  let currentMessageId = null;
  let currentMessageContent = '';

  // ✅ 反馈闭环：记忆卡片点击计时器
  let memoryCardMousedownTime = 0;
  let memoryCardQuery = '';
  let memoryCardId = '';

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
    
    // ✅ 会话恢复：Webview 就绪后通知后端，触发会话历史加载
    vscode.postMessage({ type: 'webviewReady' });
    console.log('[Frontend] Webview ready, notified backend');
  });

  // 缓存正则表达式（性能优化）
  const backtick = '\\x60';
  const codeBlockRegex = new RegExp(backtick + backtick + backtick + '([\\\\s\\\\S]*?)' + backtick + backtick + backtick, 'g');
  const inlineCodeRegex = new RegExp(backtick + '([^' + backtick + ']+)' + backtick, 'g');
  const ampRegex = new RegExp('&', 'g');
  const ltRegex = new RegExp('<', 'g');
  const gtRegex = new RegExp('>', 'g');
  const newlineRegex = new RegExp('\\\\n', 'g');

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
    div.id = 'msg-' + msg.id;  // 添加 ID 以便后续更新
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = renderMarkdown(msg.content);
    div.appendChild(content);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // 更新消息内容（用于非流式响应）
  function updateMessageContent(messageId, content) {
    const div = document.getElementById('msg-' + messageId);
    if (!div) {
      return;
    }
    
    const contentDiv = div.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.innerHTML = renderMarkdown(content);
    }
    
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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

  // ✅ 网络搜索开关（暂未实现）
  const webSearchToggle = document.getElementById('webSearchToggle');
  if (webSearchToggle) {
    webSearchToggle.addEventListener('click', () => {
      // TODO: 实现网络搜索功能
      vscode.window?.showInformationMessage && vscode.window.showInformationMessage('网络搜索功能暂未启用');
      console.log('[Frontend] Web search toggle clicked (not implemented yet)');
    });
  }

  // ✅ 删除按钮已移除，改为在每个会话项上直接删除

  // 自动调整textarea高度
  if (messageInput) {
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // ✅ 反馈闭环：监听记忆卡片点击，计算 dwellTimeMs
  document.addEventListener('mousedown', (e) => {
    const card = e.target.closest('.memory-card');
    if (card) {
      memoryCardMousedownTime = Date.now();
      memoryCardQuery = card.dataset.query || '';
      memoryCardId = card.dataset.memoryId || '';
      console.log('[Frontend] Memory card mousedown:', { memoryCardId, query: memoryCardQuery });
    }
  });

  document.addEventListener('mouseup', (e) => {
    const card = e.target.closest('.memory-card');
    if (card && memoryCardMousedownTime > 0) {
      const dwellTimeMs = Date.now() - memoryCardMousedownTime;
      
      // 发送反馈消息到后端
      vscode.postMessage({
        type: 'feedback',
        query: memoryCardQuery,
        memoryId: memoryCardId,
        dwellTimeMs: dwellTimeMs
      });
      
      console.log('[Frontend] Feedback sent:', { query: memoryCardQuery, memoryId: memoryCardId, dwellTimeMs });
      
      // 重置计时器
      memoryCardMousedownTime = 0;
      memoryCardQuery = '';
      memoryCardId = '';
    }
  });

  // 处理来自扩展的消息
  window.addEventListener('message', event => {
    const message = event.data;

    switch (message.type) {
      case 'addMessage':
        appendMessage(message.message);
        break;

      case 'updateMessage':
        updateMessageContent(message.messageId, message.content);
        enableInput();  // 更新完成后启用输入
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

      // ✅ 新增：处理完整响应事件（兜底）
      case 'assistantResponse':
        // 确保最终内容完整（防止漏块）
        var finalMsg = document.getElementById('msg-' + message.messageId);
        if (finalMsg) {
          var contentDiv = finalMsg.querySelector('.message-content');
          if (contentDiv) {
            contentDiv.textContent = message.content;
          }
        } else {
          // 如果没有流式消息，创建新的 assistant 消息
          appendMessage({
            id: message.messageId,
            role: 'assistant',
            content: message.content,
            timestamp: message.timestamp
          });
        }
        hideLoading();
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

      case 'commandExecuted':
        // 命令执行完成，恢复输入状态
        enableInput();
        // 命令执行结果由后端审计日志记录
        break;

      case 'loadSession':
        // ✅ P1-04: 加载会话历史并渲染
        const container = document.getElementById('messagesContainer');
        if (container && message.session && message.session.messages) {
          container.innerHTML = '';
          message.session.messages.forEach(msg => appendMessage(msg));
        }
        break;

      case 'updateSuggestions':
        // ✅ 550B: 更新推荐操作卡片
        updateSuggestionCards(message.suggestions);
        break;

      case 'restoreSession':
        // ✅ 会话恢复：前端收到后端的恢复指令，主动请求加载历史
        if (message.sessionId && message.sessionId !== currentSessionId) {
          currentSessionId = message.sessionId;
          // 通知后端加载该会话的历史
          vscode.postMessage({ type: 'switchSession', sessionId: message.sessionId });
        }
        break;

      case 'clearMessages':
        // ✅ 清空消息列表（删除当前会话时触发）
        const msgContainer = document.getElementById('messagesContainer');
        if (msgContainer) {
          msgContainer.innerHTML = '';
        }
        break;

      case 'updateSessionList':
        updateSessionList(message.sessions, message.currentSessionId);
        break;

      // ✅ DeepSeek 风格：会话列表变化，请求后端发送完整列表
      case 'sessionListChanged':
        // TODO: 通过 postMessage 请求后端发送完整列表
        // vscode.postMessage({ type: 'requestSessionList' });
        break;

      case 'hideLoading':
        hideLoading();
        break;
        
      // ⏸️ TODO: 未来在此添加 feedback 计时逻辑
      // case 'feedback':
      //   // 计算 dwellTimeMs 并发送给后端
      //   break;
    }
  });

  function updateSessionList(sessions, currentSessionId) {
    // ✅ DeepSeek 风格：渲染到侧边栏列表
    const sessionList = document.getElementById('sessionList');
    if (!sessionList) return;
    
    sessionList.innerHTML = '';
    
    sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
      item.dataset.sessionId = session.id;
      
      // ✅ 创建标题文本
      const titleSpan = document.createElement('span');
      titleSpan.className = 'session-title';
      titleSpan.textContent = session.title || '新会话';
      titleSpan.title = session.title || '新会话'; // 添加 tooltip
      
      // ✅ 创建删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'session-delete-btn';
      deleteBtn.innerHTML = '×';
      deleteBtn.title = '删除会话';
      
      // 阻止删除按钮点击事件冒泡
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'deleteSession', sessionId: session.id });
      });
      
      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      
      // 点击会话项切换会话
      item.addEventListener('click', () => {
        vscode.postMessage({ type: 'switchSession', sessionId: session.id });
      });
      
      sessionList.appendChild(item);
    });
  }

  /**
   * ✅ 550B: 更新推荐操作卡片
   */
  function updateSuggestionCards(suggestions) {
    const container = document.getElementById('suggestionCards');
    if (!container) return;

    if (!suggestions || suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = '';
    suggestions.forEach(sugg => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-card';
      btn.textContent = sugg.label;
      btn.onclick = () => {
        // 点击后发送对应的意图消息
        vscode.postMessage({ type: 'sendMessage', text: sugg.label, intent: sugg.intent });
        // 隐藏卡片
        container.style.display = 'none';
      };
      container.appendChild(btn);
    });

    container.style.display = 'flex';
  }
`;
