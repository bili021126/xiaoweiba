import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';
import { generateCompleteStyles } from '../ui/styles';
import { generateCard, generateCodeBlock, generateBadge, generateWebviewTemplate } from '../ui/components';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';

/**
 * 代码解释命令处理器
 */
export class ExplainCodeCommand extends BaseCommand {
  private auditLogger: AuditLogger;
  private preferenceMemory: PreferenceMemory;
  private llmTool: LLMTool;
  private cache: LLMResponseCache;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus,
    llmTool?: LLMTool
  ) {
    super(memorySystem, eventBus, 'explainCode');
    
    this.auditLogger = container.resolve(AuditLogger);
    this.preferenceMemory = container.resolve(PreferenceMemory);
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.cache = new LLMResponseCache();
  }

  /**
   * 核心执行逻辑（由 MemorySystem 调用）
   */
  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 获取当前编辑器和选中代码
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件并选中要解释的代码');
        return { success: false, error: 'No active editor' };
      }

      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);
      
      if (!selectedCode || selectedCode.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 请先选中要解释的代码');
        return { success: false, error: 'No code selected' };
      }

      // 2. 显示进度提示
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在解释代码...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '调用 AI 模型...' });

        // 3. 调用 LLM 解释代码（注入记忆上下文）
        const explanation = await this.explainCodeWithLLM(
          selectedCode, 
          editor.document.languageId,
          context
        );
        
        progress.report({ message: '生成完成' });

        // 4. 在 Webview 中展示结果
        await this.showExplanationInWebview(explanation, selectedCode, editor.document.languageId);

        // 5. 记忆记录已通过 EventBus 发布 TASK_COMPLETED 事件，由 MemorySystem 自动处理
      });

      // 6. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('explain_code', 'success', durationMs, {
        parameters: {
          language: editor.document.languageId,
          codeLength: selectedCode.length
        }
      });

      // ✅ 修复：返回元数据供MemorySystem使用
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri.fsPath);
      
      return { 
        success: true, 
        durationMs,
        data: {
          filePath: editor.document.uri.fsPath,
          fileName: editor.document.fileName.split('/').pop()?.split('\\').pop(),
          language: editor.document.languageId,
          code: selectedCode
        },
        memoryMetadata: {
          taskType: 'CODE_EXPLAIN',
          summary: `解释了 ${relativePath} 中的代码`,
          entities: [relativePath]
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`代码解释失败: ${errorMessage}`);
      
      await this.auditLogger.logError('explain_code', error as Error, durationMs);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 使用 LLM 解释代码（注入记忆上下文）
   */
  private async explainCodeWithLLM(
    code: string, 
    languageId: string,
    context: MemoryContext
  ): Promise<string> {
    // F04: 查询用户偏好（优先使用注入的偏好，其次实时查询）
    let preferences = context.preferenceRecommendations || [];
    if (preferences.length === 0) {
      const rawPrefs = await this.preferenceMemory.getRecommendations(
        'CODE_PATTERN',
        { language: languageId }
      );
      // 转换为标准格式
      preferences = rawPrefs.map(p => ({
        domain: p.record.domain,
        pattern: p.record.pattern,
        confidence: p.record.confidence
      }));
    }
    
    let preferenceHint = '';
    if (preferences.length > 0) {
      preferenceHint = '\n\n根据用户历史偏好：\n';
      preferences.forEach((pref, index) => {
        preferenceHint += `${index + 1}. ${JSON.stringify(pref.pattern)} (置信度: ${(pref.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    // 添加相关记忆到Prompt
    let memoryHint = '';
    if (context.episodicMemories && context.episodicMemories.length > 0) {
      memoryHint = '\n\n相关历史记忆：\n';
      context.episodicMemories.forEach((mem, index) => {
        memoryHint += `${index + 1}. [${mem.taskType}] ${mem.summary}\n`;
      });
    }

    const prompt = `请简要解释以下${languageId}代码：

\`\`\`${languageId}
${code}
\`\`\`

请用中文回答（300字以内），包含：
1. 功能概述
2. 关键逻辑
3. 改进建议（如有）${preferenceHint}${memoryHint}`;

    // 尝试从缓存获取（可通过环境变量 DISABLE_LLM_CACHE 禁用）
    const disableCache = process.env.DISABLE_LLM_CACHE === 'true';
    if (!disableCache) {
      const cachedResult = this.cache.get(prompt);
      if (cachedResult) {
        console.log('[ExplainCodeCommand] Using cached result');
        return cachedResult;
      }
    } else {
      console.log('[ExplainCodeCommand] Cache disabled by environment variable');
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
      content: this.escapeHtml(explanation).replace(/\n/g, '<br>'),
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
   * 记录情景记忆（已废弃，改为通过 EventBus 发布事件）
   * @deprecated 使用 EventBus.publish(CoreEventType.TASK_COMPLETED) 替代
   */
  private async recordMemory(
    fileName: string,
    code: string,
    explanation: string,
    durationMs: number
  ): Promise<void> {
    // 此方法已废弃，记忆记录由 MemorySystem 通过 TASK_COMPLETED 事件自动处理
    console.debug('[ExplainCodeCommand] recordMemory deprecated - using EventBus instead');
  }
}
