/**
 * 代码生成命令
 * 
 * 根据自然语言需求生成代码，支持Diff确认后写入
 */

import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { LLMResponseCache } from '../core/cache/LLMResponseCache';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';
import { BestPracticeLibrary } from '../core/knowledge/BestPracticeLibrary';
import { DiffService } from '../tools/DiffService';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';

export class CodeGenerationCommand extends BaseCommand {
  private auditLogger: AuditLogger;
  private llmTool: LLMTool;
  private cache: LLMResponseCache;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus,
    llmTool?: LLMTool
  ) {
    super(memorySystem, eventBus, 'generateCode');
    this.auditLogger = container.resolve(AuditLogger);
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.cache = new LLMResponseCache();
  }

  /**
   * 执行代码生成命令
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    try {
      await this.executeLegacy(input);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    // 当前使用executeLegacy包装层，此方法暂不直接使用
    return { success: true };
  }

  private async executeLegacy(input: CommandInput): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 获取当前编辑器
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件');
        return;
      }

      // 2. 检查是否有选中的注释，如果有则预填充
      let defaultRequirement = '';
      const selection = editor.selection;
      if (!selection.isEmpty) {
        const selectedText = editor.document.getText(selection);
        // 检查是否为注释（以 // 或 /* 开头）
        const trimmedText = selectedText.trim();
        if (trimmedText.startsWith('//') || trimmedText.startsWith('/*')) {
          // 去除注释符号，提取注释内容
          defaultRequirement = trimmedText
            .replace(/^\/\//, '')
            .replace(/^\/\*/, '')
            .replace(/\*\/$/, '')
            .trim();
          console.log('[CodeGenerationCommand] Detected comment:', defaultRequirement);
        }
      }

      // 3. 弹出输入框获取用户需求（预填充注释内容）
      const requirement = await vscode.window.showInputBox({
        prompt: '请输入代码生成需求',
        placeHolder: '例如：创建一个函数，计算数组中所有偶数的和',
        value: defaultRequirement, // 预填充注释内容
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return '需求不能为空';
          }
          if (value.length > 500) {
            return '需求不能超过500个字符';
          }
          return null;
        }
      });

      if (!requirement || requirement.trim().length === 0) {
        vscode.window.showInformationMessage('已取消代码生成');
        return;
      }

      // 3. 显示进度提示
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🚀 生成代码',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '🤖 分析需求...', increment: 10 });

        // 4. 调用LLM生成代码
        const generatedCode = await this.generateCode(
          requirement,
          editor.document.languageId,
          editor.document.getText()
        );
        
        progress.report({ message: '✨ 生成完成，准备展示...', increment: 60 });

        // 5. 展示生成的代码并提供操作选项
        await this.showGeneratedCodeOptions(generatedCode, requirement, editor);

        progress.report({ message: '💾 记录情景记忆...', increment: 80 });

        // 6. 发布任务完成事件（由 MemorySystem 订阅并记录记忆）
        const durationMs = Date.now() - startTime;
        this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
          actionId: 'codeGenerate',
          result: { success: true },
          durationMs
        }, { source: 'CodeGenerationCommand' });
        
        progress.report({ message: '✅ 全部完成！', increment: 100 });
      });

      // 7. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('code_generation', 'success', durationMs, {
        parameters: {
          language: editor.document.languageId,
          requirementLength: requirement.length
        }
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`代码生成失败: ${errorMessage}`);
      
      await this.auditLogger.logError('code_generation', error as Error, durationMs);
      
      // 即使失败也发布事件，让 MemorySystem 记录失败结果
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId: 'codeGenerate',
        result: { success: false, error: errorMessage },
        durationMs
      }, { source: 'CodeGenerationCommand' });
    }
  }

  /**
   * 调用LLM生成代码
   */
  private async generateCode(
    requirement: string,
    languageId: string,
    contextCode?: string
  ): Promise<string> {
    const contextInfo = contextCode && contextCode.length > 0 
      ? `\n\n当前文件上下文：\n\`\`\`${languageId}\n${contextCode.substring(0, 1000)}\n\`\`\``
      : '';

    // 获取最佳实践建议
    const bestPracticeLib = container.resolve(BestPracticeLibrary);
    const allPractices = bestPracticeLib.getAll();
    // 简单过滤：查找与语言相关的实践
    const relevantPractices = allPractices.filter(p => 
      p.title.toLowerCase().includes(languageId.toLowerCase()) ||
      p.description.toLowerCase().includes(languageId.toLowerCase())
    ).slice(0, 3); // 最多取3条

    let bestPracticeHint = '';
    if (relevantPractices.length > 0) {
      bestPracticeHint = '\n\n推荐的最佳实践：\n' + 
        relevantPractices.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n');
    }

    const prompt = `请根据以下需求生成${languageId}代码：

需求：${requirement}${contextInfo}${bestPracticeHint}

要求：
1. 代码必须符合${languageId}语言规范
2. 包含必要的注释说明
3. 遵循最佳实践和设计模式
4. 考虑边界情况和错误处理
5. 保持代码简洁、可读性强

请直接返回代码，使用markdown代码块格式：
\`\`\`${languageId}
// 你的代码
\`\`\`

如果需求不明确或无法实现，请说明原因。`;

    // 尝试从缓存获取
    const cachedResult = this.cache.get(prompt);
    if (cachedResult) {
      console.log('[CodeGenerationCommand] Using cached result');
      return this.extractCodeFromMarkdown(cachedResult, languageId);
    }

    const result = await this.llmTool.call({
      messages: [
        { role: 'system', content: '你是一位资深的软件工程师，擅长编写高质量、可维护的代码。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 存入缓存
    this.cache.set(prompt, result.data);

    // 提取代码块
    return this.extractCodeFromMarkdown(result.data, languageId);
  }

  /**
   * 从Markdown中提取代码
   */
  private extractCodeFromMarkdown(markdown: string, languageId: string): string {
    // 匹配代码块
    const codeBlockRegex = new RegExp(`\`\`\`${languageId}\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = markdown.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }

    // 如果没有找到指定语言的代码块，尝试通用代码块
    const genericCodeBlockRegex = /```[\w]*\s*([\s\S]*?)```/;
    const genericMatch = markdown.match(genericCodeBlockRegex);
    
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].trim();
    }

    // 如果没有代码块标记，返回原始内容
    return markdown.trim();
  }

  /**
   * 展示生成的代码并提供操作选项
   */
  private async showGeneratedCodeOptions(
    code: string,
    requirement: string,
    editor: vscode.TextEditor
  ): Promise<void> {
    const options: vscode.QuickPickItem[] = [
      {
        label: '$(check) 插入到当前位置',
        description: '在光标位置插入生成的代码'
      },
      {
        label: '$(new-file) 创建新文件',
        description: '将代码保存到新文件'
      },
      {
        label: '$(copy) 复制到剪贴板',
        description: '复制生成的代码'
      },
      {
        label: '$(refresh) 重新生成',
        description: '使用相同需求重新生成'
      }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: '选择操作',
      title: `代码生成完成 - ${requirement.substring(0, 50)}...`
    });

    if (!selected) {
      return;
    }

    switch (selected.label) {
      case '$(check) 插入到当前位置':
        await this.insertCodeAtCursor(editor, code);
        break;
      case '$(new-file) 创建新文件':
        await this.createNewFile(code, editor.document.languageId);
        break;
      case '$(copy) 复制到剪贴板':
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('✅ 代码已复制到剪贴板');
        break;
      case '$(refresh) 重新生成':
        // 清除缓存后异步重新执行，避免递归调用栈溢出
        this.cache.clear();
        vscode.window.showInformationMessage('🔄 正在重新生成...');
        setTimeout(() => this.executeLegacy({}), 100);
        break;
    }
  }

  /**
   * 在光标位置插入代码（带Diff确认）
   */
  private async insertCodeAtCursor(editor: vscode.TextEditor, code: string): Promise<void> {
    const position = editor.selection.active;
    
    // 获取当前位置的原始内容（前后各50字符作为上下文）
    const document = editor.document;
    const startLine = Math.max(0, position.line - 2);
    const endLine = Math.min(document.lineCount - 1, position.line + 2);
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const originalContext = document.getText(range);
    
    // 显示Diff确认对话框
    const diffService = new DiffService();
    const confirmed = await diffService.confirmChangeWithWebview(
      originalContext,
      code,
      document.fileName
    );
    
    if (!confirmed) {
      vscode.window.showInformationMessage('⚠️ 已取消代码插入');
      return;
    }
    
    // 用户确认后插入代码
    const success = await editor.edit(editBuilder => {
      editBuilder.insert(position, code + '\n');
    });

    if (success) {
      vscode.window.showInformationMessage('✅ 代码已插入');
    } else {
      vscode.window.showErrorMessage('❌ 代码插入失败，请重试');
      console.error('[CodeGenerationCommand] Failed to insert code at cursor');
    }
  }

  /**
   * 创建新文件
   */
  private async createNewFile(code: string, languageId: string): Promise<void> {
    const extension = this.getExtensionForLanguage(languageId);
    const fileName = `generated_${Date.now()}.${extension}`;
    
    const document = await vscode.workspace.openTextDocument({
      content: code,
      language: languageId
    });

    await vscode.window.showTextDocument(document);
    
    // 提示用户保存
    await document.save();
    
    vscode.window.showInformationMessage(`✅ 新文件已创建: ${fileName}`);
  }

  /**
   * 获取语言对应的文件扩展名
   */
  private getExtensionForLanguage(languageId: string): string {
    const extensions: { [key: string]: string } = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
      sql: 'sql',
      shellscript: 'sh',
      powershell: 'ps1'
    };

    return extensions[languageId] || 'txt';
  }

  /**
   * 记录情景记忆（已废弃，改为通过 EventBus 发布事件）
   * @deprecated 使用 EventBus.publish(CoreEventType.TASK_COMPLETED) 替代
   */
  private async recordMemory(
    requirement: string,
    code: string,
    durationMs: number
  ): Promise<void> {
    // 此方法已废弃，记忆记录由 MemorySystem 通过 TASK_COMPLETED 事件自动处理
    console.debug('[CodeGenerationCommand] recordMemory deprecated - using EventBus instead');
  }
}
