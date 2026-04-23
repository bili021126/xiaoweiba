/**
 * 代码生成Agent - CodeGenerationCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收generate_code意图
 * 2. 根据用户需求生成代码
 * 3. 在编辑器中插入或展示生成的代码
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ILLMPort } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { DiffService } from '../tools/DiffService'; // ✅ 引入 DiffService

@injectable()
export class CodeGenerationAgent implements IAgent {
  readonly id = 'code-generation-agent';
  readonly name = '代码生成助手';
  readonly supportedIntents = ['generate_code'];

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort,
    @inject('IMemoryPort') private memoryPort: IMemoryPort
  ) {}

  /**
   * 执行代码生成
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent, memoryContext } = params;
    const editor = vscode.window.activeTextEditor;

    try {
      // 1. 获取用户输入（从intent或弹出输入框）
      let userInput = intent.userInput;
      
      if (!userInput) {
        userInput = await vscode.window.showInputBox({
          prompt: '请输入要生成的代码描述',
          placeHolder: '例如：创建一个TypeScript接口，包含id、name、email字段'
        });

        if (!userInput) {
          return { success: false, error: 'User cancelled', durationMs: Date.now() - startTime };
        }
      }

      // 2. 显示进度提示
      let generatedCode = '';
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在生成代码...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '分析需求...' });

        // 3. 调用 LLM 生成代码（注入记忆上下文）
        generatedCode = await this.generateCode(userInput, memoryContext);
        
        progress.report({ message: '生成完成' });
      });

      // 4. ✅ 修复 #P2: 插入代码前调用 DiffService 确认
      if (editor && generatedCode) {
        const originalContent = editor.document.getText(editor.selection);
        const diffService = new DiffService();
        const confirmed = await diffService.confirmChangeWithWebview(
          originalContent || '// 新代码',
          generatedCode,
          editor.document.uri.fsPath
        );

        if (confirmed) {
          await editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, generatedCode);
          });
        }
      }

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          userInput,
          generatedCode: 'Generated'
        },
        modelId: this.llmPort.getModelId(),
        memoryMetadata: { // ✅ 修复 #P2: 顶层元数据
          taskType: 'CODE_GENERATION',
          summary: `生成了代码：${userInput.substring(0, 50)}`,
          entities: [userInput],
          outcome: 'SUCCESS'
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`代码生成失败: ${errorMessage}`);
      
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
        name: 'generate_code',
        description: '根据自然语言描述生成代码',
        priority: 10
      }
    ];
  }

  /**
   * 生成代码
   */
  private async generateCode(userInput: string, context: MemoryContext): Promise<string> {
    // 获取当前编辑器的语言
    const editor = vscode.window.activeTextEditor;
    const language = editor?.document.languageId || 'typescript';

    // 添加相关记忆到Prompt
    let memoryHint = '';
    if (context.episodicMemories && context.episodicMemories.length > 0) {
      memoryHint = '\n\n相关历史代码模式：\n';
      context.episodicMemories.slice(0, 3).forEach((mem, index) => {
        memoryHint += `${index + 1}. ${mem.summary}\n`;
      });
    }

    const prompt = `请生成以下需求的${language}代码：

需求：${userInput}

要求：
1. 代码规范、可读性强
2. 包含必要的注释
3. 遵循最佳实践${memoryHint}

只返回代码本身，用\`\`\`${language}包裹。`;

    const result = await this.llmPort.call({
      messages: [
        { role: 'system', content: '你是一位资深软件工程师，擅长编写高质量、规范的代码。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 2000
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 提取代码块
    const codeMatch = result.text.match(/```[\w]*\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : result.text.trim();
  }

  /**
   * 插入或展示代码
   */
  private async insertOrShowCode(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      // 如果有活动编辑器，在光标位置插入代码
      const selection = editor.selection;
      await editor.edit(editBuilder => {
        editBuilder.replace(selection, code);
      });
      
      vscode.window.showInformationMessage('✅ 代码已生成并插入');
    } else {
      // 否则在新文件中展示
      const document = await vscode.workspace.openTextDocument({
        content: code,
        language: 'typescript'
      });
      await vscode.window.showTextDocument(document);
      
      vscode.window.showInformationMessage('✅ 代码已生成并在新文件中打开');
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Agent已清理
  }
}
