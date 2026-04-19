/**
 * SQL优化命令
 * 
 * 根据选中的SQL语句生成优化建议（静态分析，不连接数据库）
 */

import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';

export class OptimizeSQLCommand extends BaseCommand {
  private llmTool: LLMTool;
  private auditLogger: AuditLogger;

  // ✅ 修复：SQL优化不需要记忆上下文
  protected requiresMemoryContext = false;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus,
    llmTool?: LLMTool
  ) {
    super(memorySystem, eventBus, 'optimizeSQL');
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行SQL优化命令
   */
  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 获取当前编辑器和选中的SQL
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件');
        return { success: false, error: 'No active editor' };
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('⚠️ 请先选中要优化的SQL语句');
        return { success: false, error: 'No selection' };
      }

      const sql = editor.document.getText(selection).trim();
      if (!sql) {
        vscode.window.showWarningMessage('⚠️ 选中的内容为空');
        return { success: false, error: 'Empty selection' };
      }

      // 2. 显示进度提示
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '🔍 正在分析SQL...',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: '✨ 调用LLM分析...', increment: 30 });

          // 3. 调用LLM生成优化建议
          const optimizationResult = await this.analyzeSQL(sql);
          
          progress.report({ message: '📊 生成报告...', increment: 70 });

          // 4. 在Webview中展示优化建议
          this.showOptimizationPanel(optimizationResult, sql);
          
          progress.report({ message: '✅ 完成！', increment: 100 });
        }
      );

      // 5. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('optimize_sql', 'success', durationMs, {
        parameters: {
          sqlLength: sql.length
        }
      });

      // ✅ 修复：返回元数据供MemorySystem使用
      const relativePath = editor ? vscode.workspace.asRelativePath(editor.document.uri.fsPath) : 'unknown';
      return { 
        success: true,
        durationMs,
        memoryMetadata: {
          taskType: 'SQL_OPTIMIZE',
          summary: `优化了 ${relativePath} 中的 SQL 查询`,
          entities: [relativePath]
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`SQL优化失败: ${errorMessage}`);
      
      await this.auditLogger.logError('optimize_sql', error as Error, durationMs);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 调用LLM分析SQL
   */
  private async analyzeSQL(sql: string): Promise<string> {
    const prompt = `请分析以下SQL语句，给出专业的优化建议：

SQL语句：
\`\`\`sql
${sql}
\`\`\`

请从以下几个方面进行分析：
1. **索引建议**：哪些字段应该添加索引？为什么？
2. **查询改写建议**：是否有更高效的写法？
3. **潜在性能问题**：是否存在N+1查询、全表扫描等风险？
4. **最佳实践**：是否符合SQL编写规范？

请以清晰的Markdown格式返回分析结果。`;

    const result = await this.llmTool.call({
      messages: [
        { role: 'system', content: '你是一位资深的数据库优化专家，擅长SQL性能分析和优化。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1500
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'LLM调用失败');
    }

    return result.data;
  }

  /**
   * 在Webview面板中展示优化建议
   */
  private showOptimizationPanel(optimizationResult: string, originalSQL: string): void {
    const panel = vscode.window.createWebviewPanel(
      'sqlOptimization',
      'SQL优化建议',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SQL优化建议</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          h1 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
          }
          h2 {
            color: var(--vscode-textPreformat-foreground);
            margin-top: 20px;
          }
          .sql-block {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
            overflow-x: auto;
          }
          .sql-block code {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
          }
          .recommendation {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 4px solid var(--vscode-gitDecoration-addedResourceForeground);
            padding: 12px;
            margin: 10px 0;
            border-radius: 0 4px 4px 0;
          }
          .warning {
            border-left-color: var(--vscode-gitDecoration-modifiedResourceForeground);
          }
          .critical {
            border-left-color: var(--vscode-gitDecoration-deletedResourceForeground);
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <h1>🔍 SQL优化分析报告</h1>
        
        <h2>原始SQL</h2>
        <div class="sql-block">
          <code><pre>${this.escapeHtml(originalSQL)}</pre></code>
        </div>

        <h2>优化建议</h2>
        <div class="recommendations">
          ${this.renderMarkdown(optimizationResult)}
        </div>
      </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * 简单的Markdown渲染（简化版）
   */
  private renderMarkdown(text: string): string {
    let html = text
      // 标题
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 代码块
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<div class="sql-block"><code><pre>$2</pre></code></div>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code style="background:var(--vscode-textCodeBlock-background);padding:2px 4px;border-radius:3px;">$1</code>')
      // 无序列表
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      // 将连续的<li>包裹在<ul>中
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      // 换行
      .replace(/\n/g, '<br>');

    return html;
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
