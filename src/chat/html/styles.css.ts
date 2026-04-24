/**
 * Chat View 样式定义
 * 
 * 职责：
 * - 定义所有 CSS 样式规则
 * - 支持 VS Code 主题变量
 * - DeepSeek 风格左右分栏布局
 */

export const CHAT_STYLES = `
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
    overflow: hidden;
  }

  /* ✅ DeepSeek 风格：左右分栏布局 */
  .app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    position: relative;
  }

  /* 左侧边栏 - 悬浮式设计 */
  .sidebar {
    width: 48px;
    min-width: 48px;
    background: var(--vscode-sideBar-background);
    border-right: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    z-index: 10;
  }

  .sidebar:hover {
    width: 260px;
    min-width: 260px;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
  }

  .sidebar-header {
    padding: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s ease 0.1s;
  }

  .sidebar:hover .sidebar-header {
    opacity: 1;
  }

  .sidebar-header h3 {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }

  .new-session-btn {
    padding: 4px 10px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .new-session-btn:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 4px;
    opacity: 0;
    transition: opacity 0.2s ease 0.1s;
  }

  .sidebar:hover .session-list {
    opacity: 1;
  }

  .session-item {
    padding: 8px 12px;
    margin-bottom: 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transform: translateX(-10px);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    position: relative;
  }

  .sidebar:hover .session-item {
    opacity: 1;
    transform: translateX(0);
  }

  /* 为每个会话项添加延迟，实现级联动画 */
  .sidebar:hover .session-item:nth-child(1) { transition-delay: 0.05s; }
  .sidebar:hover .session-item:nth-child(2) { transition-delay: 0.1s; }
  .sidebar:hover .session-item:nth-child(3) { transition-delay: 0.15s; }
  .sidebar:hover .session-item:nth-child(4) { transition-delay: 0.2s; }
  .sidebar:hover .session-item:nth-child(5) { transition-delay: 0.25s; }

  .session-item:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .session-item.active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }

  .session-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 70%;
    background: var(--vscode-list-activeSelectionForeground);
    border-radius: 0 2px 2px 0;
  }

  /* ✅ 会话标题文本 */
  .session-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ✅ 删除按钮（默认隐藏，悬停显示） */
  .session-delete-btn {
    opacity: 0;
    visibility: hidden;
    padding: 2px 6px;
    background: transparent;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    transition: all 0.15s ease;
    flex-shrink: 0;
    line-height: 1;
  }

  .session-item:hover .session-delete-btn {
    opacity: 1;
    visibility: visible;
  }

  .session-delete-btn:hover {
    background: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-inputValidation-errorForeground);
  }

  /* ✅ 侧边栏图标（默认显示） */
  .sidebar-icon {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 20px;
    opacity: 1;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .sidebar:hover .sidebar-icon {
    opacity: 0;
  }

  /* 主聊天区域 */
  .chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }

  /* 顶部工具栏 */
  .chat-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--vscode-editor-background);
    backdrop-filter: blur(10px);
  }

  .chat-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toggle-sidebar-btn {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--vscode-input-border);
    color: var(--vscode-foreground);
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-sidebar-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    border-color: var(--vscode-focusBorder);
  }

  .chat-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
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

  /* ✅ 网络搜索按钮样式 */
  #webSearchToggle {
    opacity: 0.6;
  }

  #webSearchToggle:hover {
    opacity: 1;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  #webSearchToggle:active {
    transform: scale(0.95);
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
    border-radius: 6px;
    margin: 8px 0;
    font-size: 13px;
  }

  /* 加载指示器 */
  #loadingIndicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--vscode-editor-background);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    transition: opacity 0.3s ease;
  }

  #loadingIndicator.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--vscode-progressBar-background);
    border-top-color: var(--vscode-button-background);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  .loading-text {
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
  }
`;
