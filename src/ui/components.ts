/**
 * UI组件生成器
 * 
 * 提供可复用的HTML组件生成函数
 */

import { DesignTokens } from './styles';

export interface ButtonOptions {
  text: string;
  type?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: string;
  onClick?: string;
}

export interface BadgeOptions {
  text: string;
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

export interface CardOptions {
  title: string;
  content: string;
  footer?: string;
  icon?: string;
}

export interface CodeBlockOptions {
  code: string;
  language?: string;
  showCopyButton?: boolean;
}

export interface ProgressOptions {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
}

/**
 * 生成按钮HTML
 */
export function generateButton(options: ButtonOptions): string {
  const {
    text,
    type = 'primary',
    size = 'md',
    disabled = false,
    icon,
    onClick
  } = options;

  const classes = [`btn`, `btn-${type}`, size !== 'md' ? `btn-${size}` : ''];
  if (disabled) classes.push('disabled');

  const iconHtml = icon ? `<span class="btn-icon">${icon}</span>` : '';
  const onClickAttr = onClick ? `onclick="${onClick}"` : '';
  const disabledAttr = disabled ? 'disabled' : '';

  return `
    <button class="${classes.join(' ')}" ${onClickAttr} ${disabledAttr}>
      ${iconHtml}
      <span>${text}</span>
    </button>
  `;
}

/**
 * 生成徽章HTML
 */
export function generateBadge(options: BadgeOptions): string {
  const { text, type = 'primary' } = options;
  return `<span class="badge badge-${type}">${text}</span>`;
}

/**
 * 生成卡片HTML
 */
export function generateCard(options: CardOptions): string {
  const { title, content, footer, icon } = options;
  
  const iconHtml = icon ? `<span class="card-icon">${icon}</span>` : '';
  const footerHtml = footer ? `
    <div class="card-footer">
      ${footer}
    </div>
  ` : '';

  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="card-title">
          ${iconHtml}
          ${title}
        </h3>
      </div>
      <div class="card-body">
        ${content}
      </div>
      ${footerHtml}
    </div>
  `;
}

/**
 * 生成代码块HTML
 */
export function generateCodeBlock(options: CodeBlockOptions): string {
  const { code, language = 'text', showCopyButton = true } = options;
  
  const escapedCode = escapeHtml(code);
  const copyButtonHtml = showCopyButton ? `
    <button class="copy-btn" onclick="copyCode(this)" title="复制代码">
      📋 复制
    </button>
  ` : '';

  return `
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-language">${language}</span>
      </div>
      ${copyButtonHtml}
      <pre><code class="language-${language}">${escapedCode}</code></pre>
    </div>
  `;
}

/**
 * 生成进度条HTML
 */
export function generateProgress(options: ProgressOptions): string {
  const { value, max = 100, label, showPercentage = true } = options;
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const labelHtml = label || (showPercentage ? `${Math.round(percentage)}%` : '');

  return `
    <div class="progress-container">
      <div class="progress-bar" style="width: ${percentage}%"></div>
    </div>
    ${labelHtml ? `<div class="progress-label"><span>${labelHtml}</span></div>` : ''}
  `;
}

/**
 * 生成警告框HTML
 */
export function generateAlert(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): string {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅'
  };

  const colors = {
    info: 'var(--vscode-textLink-foreground)',
    warning: '#ffc107',
    error: '#dc3545',
    success: '#28a745'
  };

  return `
    <div class="alert alert-${type}" style="
      padding: ${DesignTokens.spacing.md};
      margin: ${DesignTokens.spacing.md} 0;
      border-left: 4px solid ${colors[type]};
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: ${DesignTokens.borderRadius.md};
      display: flex;
      align-items: center;
      gap: ${DesignTokens.spacing.sm};
    ">
      <span style="font-size: ${DesignTokens.fontSize.lg}">${icons[type]}</span>
      <span>${message}</span>
    </div>
  `;
}

/**
 * 生成加载动画HTML
 */
export function generateLoadingSpinner(text: string = '加载中...'): string {
  return `
    <div class="loading-spinner" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: ${DesignTokens.spacing.xxl};
      gap: ${DesignTokens.spacing.md};
    ">
      <div style="
        width: 40px;
        height: 40px;
        border: 4px solid var(--vscode-widget-border);
        border-top-color: var(--vscode-focusBorder);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="color: var(--vscode-descriptionForeground);">${text}</span>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </div>
  `;
}

/**
 * 生成空状态HTML
 */
export function generateEmptyState(icon: string, title: string, description?: string): string {
  const descriptionHtml = description ? `
    <p style="
      color: var(--vscode-descriptionForeground);
      font-size: ${DesignTokens.fontSize.sm};
      margin-top: ${DesignTokens.spacing.sm};
    ">${description}</p>
  ` : '';

  return `
    <div class="empty-state" style="
      text-align: center;
      padding: ${DesignTokens.spacing.xxl};
      color: var(--vscode-descriptionForeground);
    ">
      <div style="font-size: 48px; margin-bottom: ${DesignTokens.spacing.md};">${icon}</div>
      <h3 style="
        font-size: ${DesignTokens.fontSize.lg};
        font-weight: ${DesignTokens.fontWeight.medium};
        margin-bottom: ${DesignTokens.spacing.xs};
      ">${title}</h3>
      ${descriptionHtml}
    </div>
  `;
}

/**
 * 转义HTML特殊字符
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 生成完整的Webview HTML模板
 */
export function generateWebviewTemplate(
  title: string,
  content: string,
  customStyles?: string,
  customScripts?: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>${title}</title>
  <style>
    ${customStyles || ''}
  </style>
</head>
<body>
  ${content}
  <script>
    // VS Code API
    const vscode = acquireVsCodeApi();
    
    // 复制代码功能
    function copyCode(button) {
      const codeBlock = button.parentElement.querySelector('code');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
          button.textContent = '✅ 已复制';
          setTimeout(() => {
            button.textContent = '📋 复制';
          }, 2000);
        });
      }
    }
    
    ${customScripts || ''}
  </script>
</body>
</html>`;
}
