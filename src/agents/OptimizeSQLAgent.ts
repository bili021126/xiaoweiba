/**
 * SQL优化Agent - OptimizeSQLCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收optimize_sql意图
 * 2. 分析选中的SQL语句
 * 3. 提供优化建议
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ILLMPort } from '../core/ports/ILLMPort';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';

@injectable()
export class OptimizeSQLAgent implements IAgent {
  readonly id = 'optimize-sql-agent';
  readonly name = 'SQL优化助手';
  readonly supportedIntents = ['optimize_sql'];

  private cache: LLMResponseCache;

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort
  ) {
    this.cache = new LLMResponseCache();
  }

  /**
   * 执行SQL优化
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
      const selectedSQL = editor.document.getText(selection);
      
      if (!selectedSQL || selectedSQL.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 请先选中要优化的SQL语句');
        return { success: false, error: 'No SQL selected', durationMs: Date.now() - startTime };
      }

      // 显示进度提示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔧 优化SQL查询',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: '🤖 分析SQL...', increment: 20 });
          
          // 调用LLM优化SQL
          const optimizationResult = await this.optimizeSQL(selectedSQL);
          
          if (!optimizationResult.success || !optimizationResult.data) {
            throw new Error(optimizationResult.error || 'SQL优化失败');
          }

          progress.report({ message: '✅ 优化完成', increment: 100 });

          // 展示优化结果
          await this.showOptimizationReport(selectedSQL, optimizationResult.data);
        }
      );

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          originalSQL: selectedSQL,
          optimized: true
        },
        modelId: this.llmPort.getModelId()
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`SQL优化失败: ${errorMessage}`);
      
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
        name: 'optimize_sql',
        description: '分析和优化SQL查询语句',
        priority: 9
      }
    ];
  }

  /**
   * 优化SQL
   */
  private async optimizeSQL(sql: string): Promise<{ success: boolean; data?: string; error?: string }> {
    const prompt = `请优化以下SQL查询语句，并提供详细的优化建议：

\`\`\`sql
${sql}
\`\`\`

请提供：
1. **优化后的SQL**（如果不需要优化，说明原因）
2. **优化点分析**（索引、JOIN、子查询等）
3. **性能提升预期**
4. **注意事项**`;

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
        { role: 'system', content: '你是一位数据库专家，擅长SQL性能优化。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1500
    });

    if (!result.success || !result.text) {
      return { success: false, error: result.error || 'LLM 调用失败' };
    }

    // 存入缓存
    this.cache.set(prompt, result.text);

    return { success: true, data: result.text };
  }

  /**
   * 展示优化报告
   */
  private async showOptimizationReport(originalSQL: string, optimization: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'xiaoweiba.sql-optimization',
      'SQL优化报告 - 小尾巴',
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
          body { font-family: var(--vscode-font-family); padding: 20px; line-height: 1.6; }
          h1 { color: var(--vscode-foreground); border-bottom: 2px solid var(--vscode-focusBorder); padding-bottom: 10px; }
          h2 { color: var(--vscode-descriptionForeground); margin-top: 24px; }
          .sql-block { 
            background: var(--vscode-textBlockQuote-background); 
            padding: 15px; 
            border-radius: 6px; 
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            margin: 10px 0;
          }
          .optimization { 
            background: var(--vscode-editor-background);
            border-left: 4px solid var(--vscode-charts-green);
            padding: 15px;
            margin: 15px 0;
            white-space: pre-wrap;
          }
          .label { font-weight: bold; color: var(--vscode-charts-blue); }
        </style>
      </head>
      <body>
        <h1>🔧 SQL优化报告</h1>
        
        <div>
          <span class="label">原始SQL:</span>
          <div class="sql-block">${this.escapeHtml(originalSQL)}</div>
        </div>

        <div>
          <span class="label">优化建议:</span>
          <div class="optimization">${this.formatOptimization(optimization)}</div>
        </div>
      </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * 格式化优化建议
   */
  private formatOptimization(text: string): string {
    return this.escapeHtml(text).replace(/\n/g, '<br>');
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
    console.log('[OptimizeSQLAgent] Disposed');
  }
}
