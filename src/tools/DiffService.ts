/**
 * Diff服务
 * 
 * 提供代码差异对比和确认功能
 */

import * as vscode from 'vscode';

// ✅ 修复 #35：将中文硬编码提取为常量
const DIFF_SERVICE_TEXT = {
  APPLY_CHANGE: '$(check) 应用更改',
  CANCEL: '$(close) 取消',
  APPLY_CHANGE_DESC: '将新代码插入到当前位置',
  CANCEL_DESC: '不执行任何操作',
  CONFIRM_PLACEHOLDER: (fileName: string) => `确认修改 ${fileName}`,
  WEBVIEW_TITLE: '代码差异预览',
  ORIGINAL_HEADER: (length: number) => `原始内容 (${length} 字符)`,
  MODIFIED_HEADER: (length: number) => `新内容 (${length} 字符)`,
  EMPTY_CONTENT: '(空)',
  TIP_TEXT: '💡 提示：仔细检查差异后，点击“应用更改”将新代码插入到编辑器中。',
  BTN_CANCEL: '❌ 取消',
  BTN_CONFIRM: '✅ 应用更改',
  FILE_LABEL: '文件:',
} as const;

export class DiffService {
  /**
   * 显示差异确认对话框
   * @param original 原始内容
   * @param modified 修改后的内容
   * @param filePath 文件路径
   * @returns 用户是否确认应用更改
   */
  async confirmChange(
    original: string,
    modified: string,
    filePath: string
  ): Promise<boolean> {
    // ✅ 生成简化的diff文本（用于日志或未来扩展）
    this.generateSimpleDiff(original, modified);
    
    // 使用QuickPick展示差异并让用户确认
    const choice = await vscode.window.showQuickPick(
      [
        { label: DIFF_SERVICE_TEXT.APPLY_CHANGE, description: DIFF_SERVICE_TEXT.APPLY_CHANGE_DESC },
        { label: DIFF_SERVICE_TEXT.CANCEL, description: DIFF_SERVICE_TEXT.CANCEL_DESC }
      ],
      {
        placeHolder: DIFF_SERVICE_TEXT.CONFIRM_PLACEHOLDER(this.getFileName(filePath)),
        title: DIFF_SERVICE_TEXT.WEBVIEW_TITLE,
        ignoreFocusOut: true
      }
    );

    return choice?.label.includes('应用更改') || false;
  }

  /**
   * 在Webview中显示详细的差异对比（增强版）
   * @param original 原始内容
   * @param modified 修改后的内容
   * @param filePath 文件路径
   * @returns 用户是否确认应用更改
   */
  async confirmChangeWithWebview(
    original: string,
    modified: string,
    filePath: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // ✅ 防止Promise重复resolve
      let isResolved = false;
      
      const safeResolve = (value: boolean) => {
        if (!isResolved) {
          isResolved = true;
          resolve(value);
        }
      };
      
      const panel = vscode.window.createWebviewPanel(
        'diffPreview',
        DIFF_SERVICE_TEXT.WEBVIEW_TITLE,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      const html = this.generateDiffHtml(original, modified, filePath);
      panel.webview.html = html;

      // 监听来自Webview的消息
      panel.webview.onDidReceiveMessage((message) => {
        if (message.action === 'confirm') {
          panel.dispose();
          safeResolve(true);
        } else if (message.action === 'cancel') {
          panel.dispose();
          safeResolve(false);
        }
      });

      // 面板关闭时视为取消
      panel.onDidDispose(() => {
        safeResolve(false);
      });
    });
  }

  /**
   * 生成简化的diff文本
   */
  private generateSimpleDiff(original: string, modified: string): string {
    const maxPreviewLength = 200;
    
    let diff = '';
    
    if (original) {
      diff += `原始内容 (${original.length} 字符):\n`;
      diff += '─'.repeat(50) + '\n';
      diff += original.substring(0, maxPreviewLength);
      if (original.length > maxPreviewLength) {
        diff += '...';
      }
      diff += '\n\n';
    }
    
    diff += `新内容 (${modified.length} 字符):\n`;
    diff += '─'.repeat(50) + '\n';
    diff += modified.substring(0, maxPreviewLength);
    if (modified.length > maxPreviewLength) {
      diff += '...';
    }
    
    return diff;
  }

  /**
   * 生成详细的差异对比HTML
   */
  private generateDiffHtml(original: string, modified: string, filePath: string): string {
    const fileName = this.getFileName(filePath);
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>代码差异预览</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
          }
          h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
          }
          .file-name {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
          }
          .diff-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .diff-panel {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            overflow: hidden;
          }
          .diff-header {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 10px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-widget-border);
          }
          .diff-header.original {
            background-color: var(--vscode-diffEditor-removedTextBackground);
          }
          .diff-header.modified {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
          }
          .diff-content {
            padding: 15px;
            background-color: var(--vscode-textCodeBlock-background);
            overflow-x: auto;
            max-height: 400px;
            overflow-y: auto;
          }
          .diff-content pre {
            margin: 0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-widget-border);
          }
          button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: opacity 0.2s;
          }
          button:hover {
            opacity: 0.8;
          }
          .btn-confirm {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          .btn-cancel {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .stats {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <h2>${DIFF_SERVICE_TEXT.WEBVIEW_TITLE}</h2>
        <div class="file-name">${DIFF_SERVICE_TEXT.FILE_LABEL} ${fileName}</div>
        
        <div class="diff-container">
          <div class="diff-panel">
            <div class="diff-header original">${DIFF_SERVICE_TEXT.ORIGINAL_HEADER(original.length)}</div>
            <div class="diff-content">
              <pre>${this.escapeHtml(original || DIFF_SERVICE_TEXT.EMPTY_CONTENT)}</pre>
            </div>
          </div>
          
          <div class="diff-panel">
            <div class="diff-header modified">${DIFF_SERVICE_TEXT.MODIFIED_HEADER(modified.length)}</div>
            <div class="diff-content">
              <pre>${this.escapeHtml(modified)}</pre>
            </div>
          </div>
        </div>

        <div class="stats">
          ${DIFF_SERVICE_TEXT.TIP_TEXT}
        </div>

        <div class="button-group">
          <button class="btn-cancel" onclick="vscode.postMessage({ action: 'cancel' })">
            ${DIFF_SERVICE_TEXT.BTN_CANCEL}
          </button>
          <button class="btn-confirm" onclick="vscode.postMessage({ action: 'confirm' })">
            ${DIFF_SERVICE_TEXT.BTN_CONFIRM}
          </button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取文件名
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || filePath;
  }

  /**
   * HTML转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
