/**
 * 命名检查Agent - CheckNamingCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收check_naming意图
 * 2. 检查选中的变量/类/方法命名是否符合规范
 * 3. 提供改进建议
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ILLMPort } from '../core/ports/ILLMPort';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';

@injectable()
export class CheckNamingAgent implements IAgent {
  readonly id = 'check-naming-agent';
  readonly name = '命名规范检查助手';
  readonly supportedIntents = ['check_naming'];

  private cache: LLMResponseCache;

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort
  ) {
    this.cache = new LLMResponseCache();
  }

  /**
   * 执行命名检查
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent } = params;

    try {
      const editor = vscode.window.activeTextEditor;
      
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件');
        return { success: false, error: 'No active editor', durationMs: Date.now() - startTime };
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('⚠️ 请先选中要检查的命名');
        return { success: false, error: 'No selection', durationMs: Date.now() - startTime };
      }

      const selectedText = editor.document.getText(selection);
      
      if (!selectedText || selectedText.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 选中的内容为空');
        return { success: false, error: 'Empty selection', durationMs: Date.now() - startTime };
      }

      // 显示进度提示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔍 检查命名规范',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: '🤖 分析命名...', increment: 20 });
          
          // 获取文件语言
          const languageId = editor.document.languageId;
          
          // 调用LLM检查命名
          const result = await this.checkNaming(selectedText, languageId);
          
          if (!result.success || !result.data) {
            throw new Error(result.error || '命名检查失败');
          }

          progress.report({ message: '✅ 检查完成', increment: 100 });

          // 展示结果
          vscode.window.showInformationMessage(
            `命名检查结果:\n${result.data}\n\n是否查看详细信息？`,
            '查看详情'
          ).then(selection => {
            if (selection === '查看详情' && result.data) {
              this.showDetailedReport(selectedText, result.data, languageId);
            }
          });
        }
      );

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          checkedName: selectedText,
          language: editor.document.languageId
        },
        modelId: this.llmPort.getModelId()
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`命名检查失败: ${errorMessage}`);
      
      return { success: false, error: errorMessage, durationMs };
    }
  }

  /**
   * 检查Agent是否可用
   */
  async isAvailable(): Promise<boolean> {
    return await this.llmPort.isAvailable();
  }

  /**
   * 获取Agent能力
   */
  getCapabilities() {
    return [
      {
        name: 'check_naming',
        description: '检查代码命名是否符合规范',
        priority: 8
      }
    ];
  }

  /**
   * 检查命名
   */
  private async checkNaming(name: string, languageId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    const prompt = `请检查以下${languageId}代码中的命名"${name}"是否符合规范：

要求：
1. 变量使用camelCase
2. 类名使用PascalCase
3. 常量使用UPPER_SNAKE_CASE
4. 函数名使用动词+名词形式
5. 避免缩写（除非是公认的如id、url）

请给出：
- 是否符合规范（是/否）
- 如果不符合，建议的命名是什么
- 简短的理由`;

    // 尝试从缓存获取
    const disableCache = process.env.DISABLE_LLM_CACHE === 'true';
    if (!disableCache) {
      const cachedResult = this.cache.get(prompt);
      if (cachedResult) {
        return { success: true, data: cachedResult };
      }
    }

    const result = await this.llmPort.call({
      messages: [
        { role: 'system', content: '你是一位代码规范专家，擅长审查命名规范。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      maxTokens: 300
    });

    if (!result.success || !result.text) {
      return { success: false, error: result.error || 'LLM 调用失败' };
    }

    // 存入缓存
    this.cache.set(prompt, result.text);

    return { success: true, data: result.text };
  }

  /**
   * 展示详细报告
   */
  private showDetailedReport(name: string, analysis: string, languageId: string): void {
    const panel = vscode.window.createWebviewPanel(
      'xiaoweiba.naming-check',
      '命名检查报告 - 小尾巴',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          h1 { color: var(--vscode-foreground); }
          .code { background: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 4px; }
          .analysis { margin-top: 20px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>🔍 命名检查报告</h1>
        <div class="code">
          <strong>检查的命名:</strong> ${this.escapeHtml(name)}<br>
          <strong>语言:</strong> ${languageId}
        </div>
        <div class="analysis">
          <h2>分析结果</h2>
          ${this.escapeHtml(analysis).replace(/\n/g, '<br>')}
        </div>
      </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * 转义HTML
   */
  private escapeHtml(text: string): string {
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
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.cache.clear();
    // Agent已清理
  }
}
