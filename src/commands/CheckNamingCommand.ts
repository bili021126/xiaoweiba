/**
 * 命名检查命令
 * 
 * 检查选中变量/类/方法命名是否符合规范
 */

import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';

export class CheckNamingCommand extends BaseCommand {
  private auditLogger: AuditLogger;
  private llmTool: LLMTool;
  private cache: LLMResponseCache;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus,
    llmTool?: LLMTool
  ) {
    super(memorySystem, eventBus, 'checkNaming');
    this.auditLogger = container.resolve(AuditLogger);
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.cache = new LLMResponseCache();
  }

  /**
   * 执行命名检查
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    try {
      await this.executeLegacy();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeLegacy(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const editor = vscode.window.activeTextEditor;
      
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('⚠️ 请先选中要检查的命名');
        return;
      }

      const selectedText = editor.document.getText(selection);
      
      if (!selectedText || selectedText.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 选中的内容为空');
        return;
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

          progress.report({ message: '✨ 生成报告...', increment: 60 });

          // 显示检查结果
          await this.showNamingResult(result.data, selectedText);
          
          progress.report({ message: '💾 记录记忆...', increment: 80 });

          // 发布任务完成事件（由 MemorySystem 订阅并记录记忆）
          const durationMs = Date.now() - startTime;
          this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
            actionId: 'checkNaming',
            result: { success: true },
            durationMs
          }, { source: 'CheckNamingCommand' });
          
          progress.report({ message: '✅ 完成！', increment: 100 });
        }
      );

      // 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('check_naming', 'success', durationMs, {
        parameters: {
          language: editor.document.languageId,
          nameLength: selectedText.length
        }
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`命名检查失败: ${errorMessage}`);
      
      await this.auditLogger.logError('check_naming', error as Error, durationMs);
      
      // 即使失败也发布事件，让 MemorySystem 记录失败结果
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId: 'checkNaming',
        result: { success: false, error: errorMessage },
        durationMs
      }, { source: 'CheckNamingCommand' });
    }
  }

  /**
   * 调用LLM检查命名
   */
  private async checkNaming(
    name: string,
    languageId: string
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const prompt = `请检查以下${languageId}代码中的命名是否符合规范：

命名: \`${name}\`

请从以下维度检查：
1. **命名风格**：是否符合语言惯例（如JavaScript用camelCase，Python用snake_case）
2. **语义清晰**：名称是否清晰表达意图
3. **长度适中**：是否过长或过短
4. **常见错误**：是否有拼写错误、缩写不当等

请以JSON格式返回检查结果：
\`\`\`json
{
  "isValid": true/false,
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "recommendedName": "推荐的命名（如果有更好的）"
}
\`\`\`

如果命名完全符合规范，issues和suggestions可以为空数组。`;

    // 尝试从缓存获取
    const cachedResult = this.cache.get(prompt);
    if (cachedResult) {
      console.log('[CheckNamingCommand] Using cached result');
      return { success: true, data: cachedResult };
    }

    const result = await this.llmTool.call({
      messages: [
        { role: 'system', content: '你是一个专业的代码命名检查助手，擅长分析各种编程语言的命名规范。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    if (result.success && result.data) {
      // 存入缓存
      this.cache.set(prompt, result.data);
    }

    return result;
  }

  /**
   * 显示命名检查结果
   */
  private async showNamingResult(resultJson: string, originalName: string): Promise<void> {
    try {
      const result = JSON.parse(resultJson);
      
      const isValid = result.isValid;
      const score = result.score || 0;
      const issues = result.issues || [];
      const suggestions = result.suggestions || [];
      const recommendedName = result.recommendedName;

      // 构建Markdown内容
      let markdown = `## 命名检查结果\n\n`;
      markdown += `**原始命名**: \`${originalName}\`\n\n`;
      
      // 评分和状态
      const statusIcon = isValid ? '✅' : '❌';
      const scoreColor = score >= 80 ? '#4CAF50' : score >= 60 ? '#FF9800' : '#F44336';
      markdown += `**状态**: ${statusIcon} ${isValid ? '符合规范' : '存在问题'}\n\n`;
      markdown += `**评分**: <span style="color:${scoreColor};font-weight:bold;">${score}/100</span>\n\n`;

      // 问题列表
      if (issues.length > 0) {
        markdown += `### ⚠️ 发现的问题\n\n`;
        issues.forEach((issue: string, index: number) => {
          markdown += `${index + 1}. ${issue}\n`;
        });
        markdown += '\n';
      }

      // 建议列表
      if (suggestions.length > 0) {
        markdown += `### 💡 改进建议\n\n`;
        suggestions.forEach((suggestion: string, index: number) => {
          markdown += `${index + 1}. ${suggestion}\n`;
        });
        markdown += '\n';
      }

      // 推荐命名
      if (recommendedName && recommendedName !== originalName) {
        markdown += `### ✨ 推荐命名\n\n`;
        markdown += `\`${recommendedName}\`\n\n`;
        markdown += `> 点击下方的"应用建议"按钮可以一键重命名\n\n`;
      }

      // 显示Webview
      const panel = vscode.window.createWebviewPanel(
        'xiaoweiba.namingCheck',
        '命名检查 - 小尾巴',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      panel.webview.html = this.getWebviewContent(markdown, originalName, recommendedName);

      // 处理消息
      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'applyRename') {
          await this.applyRename(message.newName);
          panel.dispose();
        }
      });

    } catch (error) {
      // 如果JSON解析失败，直接显示原始结果
      vscode.window.showInformationMessage(resultJson);
    }
  }

  /**
   * 生成Webview HTML
   */
  private getWebviewContent(markdown: string, originalName: string, recommendedName?: string): string {
    const hasRecommendation = recommendedName && recommendedName !== originalName;
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>命名检查</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h3 { color: #34495e; margin-top: 20px; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
    }
    .button {
      background: #3498db;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 20px;
    }
    .button:hover { background: #2980b9; }
    blockquote {
      border-left: 4px solid #3498db;
      padding-left: 15px;
      margin: 15px 0;
      color: #666;
    }
  </style>
</head>
<body>
  ${markdown.replace(/\n/g, '<br>')}
  ${hasRecommendation ? `
    <button class="button" onclick="applyRename()">应用建议: ${recommendedName}</button>
    <script>
      function applyRename() {
        vscode.postMessage({
          command: 'applyRename',
          newName: '${recommendedName}'
        });
      }
    </script>
  ` : ''}
</body>
</html>`;
  }

  /**
   * 应用重命名
   */
  private async applyRename(newName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('无法获取编辑器');
      return;
    }

    const selection = editor.selection;
    
    try {
      await editor.edit(editBuilder => {
        editBuilder.replace(selection, newName);
      });
      
      vscode.window.showInformationMessage(`已将 \`${editor.document.getText(selection)}\` 重命名为 \`${newName}\``);
    } catch (error) {
      vscode.window.showErrorMessage(`重命名失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 记录情景记忆（已废弃，改为通过 EventBus 发布事件）
   * @deprecated 使用 EventBus.publish(CoreEventType.TASK_COMPLETED) 替代
   */
  private async recordMemory(name: string, result: string): Promise<void> {
    // 此方法已废弃，记忆记录由 MemorySystem 通过 TASK_COMPLETED 事件自动处理
    console.debug('[CheckNamingCommand] recordMemory deprecated - using EventBus instead');
  }
}
