/**
 * 代码解释Agent - ExplainCodeCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收explain_code意图
 * 2. 获取编辑器选中的代码
 * 3. 调用LLM生成解释
 * 4. 在Webview中展示结果
 * 
 * 设计原则：
 * - 通过端口访问LLM和记忆能力（不直接依赖LLMTool/EpisodicMemory）
 * - 业务逻辑从ExplainCodeCommand无损迁移
 * - 返回标准化结果供AgentRunner处理
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ILLMPort } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus'; // ✅ 修复 #7：引入事件总线
import { LLMResponseCache } from '../core/cache/LLMResponseCache';
import { generateCompleteStyles } from '../ui/styles';
import { generateCard, generateCodeBlock, generateBadge, generateWebviewTemplate } from '../ui/components';
import { AssistantResponseEvent } from '../core/events/DomainEvent';

@injectable()
export class ExplainCodeAgent implements IAgent {
  readonly id = 'explain-code-agent';
  readonly name = '代码解释助手';
  readonly supportedIntents = ['explain_code'];
  
  private cache: LLMResponseCache;

  constructor(
    @inject('ILLMPortPro') private llmPort: ILLMPort, // ✅ 成本优化：复杂推理使用Pro模型
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus // ✅ 修复 #7：注入事件总线
  ) {
    this.cache = new LLMResponseCache();
  }

  /**
   * 执行代码解释
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent, memoryContext } = params;

    try {
      // 1. 获取当前编辑器和选中代码
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件并选中要解释的代码');
        return { 
          success: false, 
          error: 'No active editor',
          durationMs: Date.now() - startTime
        };
      }

      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);
      
      if (!selectedCode || selectedCode.trim().length === 0) {
        vscode.window.showWarningMessage('⚠️ 请先选中要解释的代码');
        return { 
          success: false, 
          error: 'No code selected',
          durationMs: Date.now() - startTime
        };
      }

      // 2. 显示进度提示并执行LLM调用
      let explanation = '';
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在解释代码...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '调用 AI 模型...' });

        // 3. 调用 LLM 解释代码（注入记忆上下文）
        explanation = await this.explainCodeWithLLM(
          selectedCode, 
          editor.document.languageId,
          memoryContext
        );
        
        progress.report({ message: '生成完成' });
      });

      // 4. 在 Webview 中展示结果
      await this.showExplanationInWebview(explanation, selectedCode, editor.document.languageId);

      const durationMs = Date.now() - startTime;

      // 5. 返回结果（✅ 修复 #8：将 metadata 提升到顶层 memoryMetadata）
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri.fsPath);
      
      return { 
        success: true, 
        durationMs,
        data: {
          filePath: editor.document.uri.fsPath,
          fileName: editor.document.fileName.split('/').pop()?.split('\\').pop(),
          language: editor.document.languageId,
          code: selectedCode,
          explanation
        },
        memoryMetadata: { // ✅ 修复 #8：顶层元数据
          taskType: 'CODE_EXPLAIN',
          summary: `解释了 ${relativePath} 中的代码`,
          entities: [relativePath]
        },
        modelId: this.llmPort.getModelId()
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`代码解释失败: ${errorMessage}`);
      
      // ✅ 修复 #7：发布错误事件
      this.eventBus.publish(new AssistantResponseEvent({ 
        messageId: `error_${Date.now()}`,
        content: errorMessage,
        timestamp: Date.now()
      }));
      
      return { 
        success: false, 
        error: errorMessage,
        durationMs
      };
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
        name: 'explain_code',
        description: '解释选中的代码片段',
        priority: 10
      }
    ];
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
        return cachedResult;
      }
    }

    // 通过端口调用LLM
    const result = await this.llmPort.call({
      messages: [
        { role: 'system', content: '你是一位资深的软件工程师，擅长代码审查和技术解释。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 1000
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 存入缓存
    this.cache.set(prompt, result.text);

    return result.text;
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
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.cache.clear();
    // Agent已清理
  }
}
