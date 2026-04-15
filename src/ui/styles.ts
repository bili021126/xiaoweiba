/**
 * UI样式系统
 * 
 * 提供统一的设计令牌和工具类
 */

export const DesignTokens = {
  // 间距系统 (8px基准)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },

  // 圆角
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },

  // 阴影
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1)'
  },

  // 过渡动画
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease'
  },

  // 字体大小
  fontSize: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    xxl: '24px',
    xxxl: '32px'
  },

  // 字重
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
};

/**
 * 生成基础CSS样式
 */
export function generateBaseStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: ${DesignTokens.fontSize.md};
      line-height: 1.6;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: ${DesignTokens.spacing.lg};
      transition: all ${DesignTokens.transitions.normal};
    }

    /* 滚动条样式 */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: ${DesignTokens.borderRadius.sm};
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: ${DesignTokens.borderRadius.sm};
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground);
    }
  `;
}

/**
 * 生成卡片组件样式
 */
export function generateCardStyles(): string {
  return `
    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: ${DesignTokens.borderRadius.lg};
      padding: ${DesignTokens.spacing.lg};
      margin-bottom: ${DesignTokens.spacing.md};
      box-shadow: ${DesignTokens.shadows.md};
      transition: all ${DesignTokens.transitions.normal};
    }

    .card:hover {
      box-shadow: ${DesignTokens.shadows.lg};
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: ${DesignTokens.spacing.md};
      padding-bottom: ${DesignTokens.spacing.sm};
      border-bottom: 2px solid var(--vscode-focusBorder);
    }

    .card-title {
      font-size: ${DesignTokens.fontSize.lg};
      font-weight: ${DesignTokens.fontWeight.semibold};
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: ${DesignTokens.spacing.sm};
    }

    .card-body {
      color: var(--vscode-descriptionForeground);
    }

    .card-footer {
      margin-top: ${DesignTokens.spacing.md};
      padding-top: ${DesignTokens.spacing.sm};
      border-top: 1px solid var(--vscode-widget-border);
      display: flex;
      gap: ${DesignTokens.spacing.sm};
      justify-content: flex-end;
    }
  `;
}

/**
 * 生成按钮组件样式
 */
export function generateButtonStyles(): string {
  return `
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: ${DesignTokens.spacing.xs};
      padding: ${DesignTokens.spacing.sm} ${DesignTokens.spacing.md};
      font-size: ${DesignTokens.fontSize.sm};
      font-weight: ${DesignTokens.fontWeight.medium};
      border: none;
      border-radius: ${DesignTokens.borderRadius.md};
      cursor: pointer;
      transition: all ${DesignTokens.transitions.fast};
      text-decoration: none;
      white-space: nowrap;
      user-select: none;
    }

    .btn:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .btn-success {
      background: #28a745;
      color: white;
    }

    .btn-success:hover {
      background: #218838;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover {
      background: #c82333;
    }

    .btn-sm {
      padding: ${DesignTokens.spacing.xs} ${DesignTokens.spacing.sm};
      font-size: ${DesignTokens.fontSize.xs};
    }

    .btn-lg {
      padding: ${DesignTokens.spacing.md} ${DesignTokens.spacing.lg};
      font-size: ${DesignTokens.fontSize.md};
    }

    .btn-block {
      width: 100%;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

/**
 * 生成徽章组件样式
 */
export function generateBadgeStyles(): string {
  return `
    .badge {
      display: inline-flex;
      align-items: center;
      padding: ${DesignTokens.spacing.xs} ${DesignTokens.spacing.sm};
      font-size: ${DesignTokens.fontSize.xs};
      font-weight: ${DesignTokens.fontWeight.medium};
      border-radius: ${DesignTokens.borderRadius.full};
      white-space: nowrap;
    }

    .badge-primary {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .badge-success {
      background: #d4edda;
      color: #155724;
    }

    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }

    .badge-danger {
      background: #f8d7da;
      color: #721c24;
    }

    .badge-info {
      background: #d1ecf1;
      color: #0c5460;
    }
  `;
}

/**
 * 生成代码块样式
 */
export function generateCodeBlockStyles(): string {
  return `
    .code-block {
      position: relative;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-widget-border);
      border-left: 4px solid var(--vscode-focusBorder);
      border-radius: ${DesignTokens.borderRadius.md};
      padding: ${DesignTokens.spacing.md};
      margin: ${DesignTokens.spacing.md} 0;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: ${DesignTokens.fontSize.sm};
      line-height: 1.5;
      box-shadow: ${DesignTokens.shadows.sm};
    }

    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${DesignTokens.spacing.sm};
      padding-bottom: ${DesignTokens.spacing.xs};
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .code-block-language {
      font-size: ${DesignTokens.fontSize.xs};
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      font-weight: ${DesignTokens.fontWeight.medium};
    }

    .code-block pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .code-block code {
      color: var(--vscode-textPreformat-foreground);
    }

    .copy-btn {
      position: absolute;
      top: ${DesignTokens.spacing.sm};
      right: ${DesignTokens.spacing.sm};
      padding: ${DesignTokens.spacing.xs} ${DesignTokens.spacing.sm};
      font-size: ${DesignTokens.fontSize.xs};
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: ${DesignTokens.borderRadius.sm};
      cursor: pointer;
      opacity: 0;
      transition: opacity ${DesignTokens.transitions.fast};
    }

    .code-block:hover .copy-btn {
      opacity: 1;
    }

    .copy-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  `;
}

/**
 * 生成进度条样式
 */
export function generateProgressStyles(): string {
  return `
    .progress-container {
      width: 100%;
      background: var(--vscode-progressBar-background);
      border-radius: ${DesignTokens.borderRadius.full};
      overflow: hidden;
      height: 8px;
      margin: ${DesignTokens.spacing.md} 0;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--vscode-focusBorder), var(--vscode-button-background));
      border-radius: ${DesignTokens.borderRadius.full};
      transition: width ${DesignTokens.transitions.slow};
      position: relative;
      overflow: hidden;
    }

    .progress-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: ${DesignTokens.fontSize.xs};
      color: var(--vscode-descriptionForeground);
      margin-top: ${DesignTokens.spacing.xs};
    }
  `;
}

/**
 * 生成完整样式表
 */
export function generateCompleteStyles(): string {
  return `
    ${generateBaseStyles()}
    ${generateCardStyles()}
    ${generateButtonStyles()}
    ${generateBadgeStyles()}
    ${generateCodeBlockStyles()}
    ${generateProgressStyles()}

    /* 工具类 */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mt-1 { margin-top: ${DesignTokens.spacing.xs}; }
    .mt-2 { margin-top: ${DesignTokens.spacing.sm}; }
    .mt-3 { margin-top: ${DesignTokens.spacing.md}; }
    .mb-1 { margin-bottom: ${DesignTokens.spacing.xs}; }
    .mb-2 { margin-bottom: ${DesignTokens.spacing.sm}; }
    .mb-3 { margin-bottom: ${DesignTokens.spacing.md}; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-1 { gap: ${DesignTokens.spacing.xs}; }
    .gap-2 { gap: ${DesignTokens.spacing.sm}; }
    .gap-3 { gap: ${DesignTokens.spacing.md}; }
    .hidden { display: none; }
    .fade-in { animation: fadeIn ${DesignTokens.transitions.normal}; }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
}
