import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';
import { generateCompleteStyles } from '../ui/styles';
import { generateCard, generateCodeBlock, generateBadge, generateWebviewTemplate } from '../ui/components';

/**
 * 代码解释命令处理器
 */
export class ExplainCodeCommand {
  private auditLogger: AuditLogger;
  private episodicMemory: EpisodicMemory;
  private llmTool: LLMTool;
  private cache: LLMResponseCache;

  constructor(episodicMemory?: EpisodicMemory, llmTool?: LLMTool) {
    console.log('[ExplainCodeCommand] Constructor called');
    console.log('[ExplainCodeCommand] episodicMemory param:', episodicMemory ? 'provided' : 'undefined');
    console.log('[ExplainCodeCommand] llmTool param:', llmTool ? 'provided' : 'undefined');
    
    this.auditLogger = container.resolve(AuditLogger);
    // 如果传入了实例则使用，否则从容器解析（兼容测试）
    this.episodicMemory = episodicMemory || container.resolve(EpisodicMemory);
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.cache = new LLMResponseCache();
    
    console.log('[ExplainCodeCommand] episodicMemory instance:', this.episodicMemory ? 'initialized' : 'null');
    console.log('[ExplainCodeCommand] dbManager:', this.episodicMemory['dbManager'] ? 'exists' : 'null');
  }

  /**
   * 执行代码解释命令
   */
  async execute(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 获取当前编辑器和选中代码
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件并选中要解释的代码');
        return;
      }

      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);
      
      if (!selectedCode || selectedCode.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 请先选中要解释的代码');
        return;
      }

      // 2. 显示进度提示
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在解释代码...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '调用 AI 模型...' });

        // 3. 调用 LLM 解释代码
        const explanation = await this.explainCodeWithLLM(selectedCode, editor.document.languageId);
        
        progress.report({ message: '生成完成' });

        // 4. 在 Webview 中展示结果
        await this.showExplanationInWebview(explanation, selectedCode, editor.document.languageId);

        // 5. 异步记录情景记忆（不阻塞返回）
        const durationMs = Date.now() - startTime;
        this.recordMemory(editor.document.fileName, selectedCode, explanation, durationMs)
          .catch(err => console.error('[ExplainCodeCommand] Memory record failed:', err));
      });

      // 6. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('explain_code', 'success', durationMs, {
        parameters: {
          language: editor.document.languageId,
          codeLength: selectedCode.length
        }
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`代码解释失败: ${errorMessage}`);
      
      await this.auditLogger.logError('explain_code', error as Error, durationMs);
    }
  }

  /**
   * 使用 LLM 解释代码
   */
  private async explainCodeWithLLM(code: string, languageId: string): Promise<string> {
    const prompt = `请简要解释以下${languageId}代码：

\`\`\`${languageId}
${code}
\`\`\`

请用中文回答（300字以内），包含：
1. 功能概述
2. 关键逻辑
3. 改进建议（如有）`;

    // 尝试从缓存获取
    const cachedResult = this.cache.get(prompt);
    if (cachedResult) {
      console.log('[ExplainCodeCommand] Using cached result');
      return cachedResult;
    }

    const result = await this.llmTool.call({
      messages: [
        { role: 'system', content: '你是一位资深的软件工程师，擅长代码审查和技术解释。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1000  // 从2000降至1000，加快响应速度
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 存入缓存
    this.cache.set(prompt, result.data);

    return result.data;
  }

  /**
   * 在 Webview 中展示解释结果
   */
  private async showExplanationInWebview(
    explanation: string,
    code: string,
    languageId: string
  ): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'xiaoweiba.explanation',
      '代码解释 - 小尾巴',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const html = this.generateExplanationHtml(explanation, code, languageId);
    panel.webview.html = html;
  }

  /**
   * 生成 Webview HTML
   */
  private generateExplanationHtml(
    explanation: string,
    code: string,
    languageId: string
  ): string {
    // 使用新UI系统生成
    const badge = generateBadge({ 
      text: languageId.toUpperCase(), 
      type: 'info' 
    });

    const codeBlock = generateCodeBlock({
      code,
      language: languageId,
      showCopyButton: true
    });

    const explanationCard = generateCard({
      title: '💡 AI 解释',
      content: explanation.replace(/\n/g, '<br>'),
      icon: '🤖'
    });

    const content = `
      <div style="max-width: 900px; margin: 0 auto;">
        <h1 style="
          font-size: 28px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 3px solid var(--vscode-focusBorder);
          padding-bottom: 16px;
        ">
          🔍 代码解释
          ${badge}
        </h1>

        <div class="fade-in">
          <h2 style="
            font-size: 18px;
            margin: 24px 0 16px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            📝 选中的代码
          </h2>
          ${codeBlock}
        </div>

        <div class="fade-in" style="animation-delay: 0.1s;">
          ${explanationCard}
        </div>
      </div>
    `;

    return generateWebviewTemplate(
      '代码解释 - 小尾巴',
      content,
      generateCompleteStyles()
    );
  }

  /**
   * 转义 HTML 特殊字符
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
   * 记录情景记忆
   */
  private async recordMemory(
    fileName: string,
    code: string,
    explanation: string,
    durationMs: number
  ): Promise<void> {
    try {
      await this.episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: `解释 ${fileName.split('/').pop()} 中的代码`,
        entities: [fileName.split('.').pop() || 'unknown'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs,
        decision: explanation.substring(0, 200) // 截取前200字符作为决策摘要
      });
    } catch (error) {
      // 记忆记录失败不影响主流程，仅记录日志
      console.warn('记忆记录失败:', error);
    }
  }
}
