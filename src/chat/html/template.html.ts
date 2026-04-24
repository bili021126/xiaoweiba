/**
 * Chat View HTML 模板
 * 
 * 职责：
 * - 定义 HTML 结构
 * - DeepSeek 风格左右分栏布局
 * - 侧边栏、聊天区、输入框
 */

export const CHAT_TEMPLATE = `
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
  
  <!-- ✅ DeepSeek 风格：左右分栏布局 -->
  <div class="app-container">
    <!-- 左侧边栏：悬浮式会话列表 -->
    <aside class="sidebar" id="sidebar">
      <!-- 默认显示的图标 -->
      <div class="sidebar-icon">💬</div>
      
      <div class="sidebar-header">
        <h3>会话</h3>
        <button class="new-session-btn" id="newSessionBtn">+ 新建</button>
      </div>
      <div class="session-list" id="sessionList">
        <!-- 会话列表项将动态插入这里 -->
      </div>
    </aside>

    <!-- 主聊天区域 -->
    <main class="chat-main">
      <!-- 顶部工具栏 -->
      <header class="chat-header">
        <div class="chat-header-left">
          <h1 class="chat-title" id="chatTitle">小尾巴AI助手</h1>
        </div>
        <!-- ✅ 网络搜索开关（暂未实现，占位符） -->
        <button id="webSearchToggle" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;" title="网络搜索（暂未启用）">
          <span style="font-size: 14px;">🌐</span>
          <span>搜索</span>
        </button>
      </header>

      <!-- 消息容器 -->
      <div class="messages-container" id="messagesContainer"></div>

      <!-- 输入区域 -->
      <div class="input-container">
        <!-- ✅ 550B: 推荐操作卡片 -->
        <div id="suggestionCards" class="suggestion-cards" style="display: none; padding: 8px 16px; gap: 8px; flex-wrap: wrap;">
          <!-- 建议卡片将动态插入这里 -->
        </div>
        
        <div class="input-hints">
          <span><kbd>Enter</kbd> 发送</span>
          <span><kbd>Shift+Enter</kbd> 换行</span>
        </div>
        <textarea id="messageInput" placeholder="输入消息... (Enter发送, Shift+Enter换行)" rows="1"></textarea>
        <button id="sendBtn">发送</button>
      </div>
    </main>
  </div>
`;
