/**
 * 提交信息生成Agent - GenerateCommitCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收generate_commit意图
 * 2. 获取Git diff
 * 3. 调用LLM生成提交信息
 * 4. 应用到Git仓库
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ILLMPort } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus'; // ✅ P1-04: 引入事件总线
import { AssistantResponseEvent } from '../core/events/DomainEvent'; // ✅ P1-04: 引入响应事件
import { TaskTokenManager } from '../core/security/TaskTokenManager'; // ✅ 修复 #28：引入 TaskTokenManager

const execAsync = promisify(exec);

@injectable()
export class GenerateCommitAgent implements IAgent {
  readonly id = 'generate-commit-agent';
  readonly name = '提交信息生成助手';
  readonly supportedIntents = ['generate_commit'];

  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort,
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus, // ✅ P1-04: 注入事件总线
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager // ✅ 修复 #28：注入 TaskTokenManager
  ) {}

  /**
   * 执行提交信息生成
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent, memoryContext } = params;

    try {
      // 1. 检查工作区
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('请先打开一个工作区');
        return { success: false, error: 'No workspace', durationMs: Date.now() - startTime };
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;

      // 2. 获取 Git diff
      let commitMessage = ''; // ✅ P1-04: 提升作用域
      let diff = ''; // ✅ 修复 #P3: 提升作用域
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🚀 智能生成提交信息',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '📊 分析代码变更...', increment: 10 });

        diff = await this.getGitDiff(workspacePath);
        
        if (!diff || diff.trim().length === 0) {
          vscode.window.showInformationMessage('✅ 没有检测到代码变更');
          return;
        }

        progress.report({ message: '🧠 检索历史记忆...', increment: 20 });

        // 3. 调用 LLM 生成提交信息（注入记忆上下文）
        commitMessage = await this.generateCommitMessage(diff, memoryContext);
        
        progress.report({ message: '✨ 应用提交信息...', increment: 80 });

        // 4. 应用提交信息
        await this.applyCommitMessage(workspacePath, commitMessage, intent);

        progress.report({ message: '✅ 完成', increment: 100 });

        // ✅ P1-04: 通过 EventBus 发布提交信息到聊天窗口
        this.eventBus.publish(new AssistantResponseEvent({
          messageId: `msg_${Date.now()}_commit`,
          content: `✅ **提交信息已生成并应用**\n\n\`\`\`\n${commitMessage}\n\`\`\``,
          timestamp: Date.now()
        }));

        vscode.window.showInformationMessage(`✅ 提交信息已生成并应用`);
      });

      const durationMs = Date.now() - startTime;

      // ✅ 修复 #P3: 从 diff 中解析实际的文件名
      const changedFiles = diff.match(/diff --git a\/(.+?) b\//g)?.map(s => s.split('a/')[1]?.split(' b/')[0]) || [];

      return { 
        success: true, 
        durationMs,
        data: {
          commitMessage, // ✅ P1-04: 返回真实的提交信息
          workspacePath
        },
        modelId: this.llmPort.getModelId(),
        // ✅ P1-04: 添加记忆元数据
        memoryMetadata: {
          taskType: 'COMMIT_GENERATE',
          summary: `生成并应用了Git提交信息：${commitMessage.substring(0, 50)}`,
          entities: changedFiles.length > 0 ? changedFiles : ['Git', 'Commit'], // ✅ 使用实际变更文件
          outcome: 'SUCCESS'
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`生成提交信息失败: ${errorMessage}`);
      
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
        name: 'generate_commit',
        description: '根据Git diff智能生成提交信息',
        priority: 10
      }
    ];
  }

  /**
   * 获取 Git diff
   */
  private async getGitDiff(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git diff --cached', { 
        cwd: workspacePath,
        maxBuffer: 1024 * 1024 // 1MB
      });
      return stdout;
    } catch (error) {
      // Git diff获取失败，返回空字符串
      return '';
    }
  }

  /**
   * 生成提交信息
   */
  private async generateCommitMessage(diff: string, context: MemoryContext): Promise<string> {
    // 添加相关记忆到Prompt
    let memoryHint = '';
    if (context.episodicMemories && context.episodicMemories.length > 0) {
      memoryHint = '\n\n历史提交风格参考：\n';
      context.episodicMemories.slice(0, 3).forEach((mem, index) => {
        memoryHint += `${index + 1}. ${mem.summary}\n`;
      });
    }

    const prompt = `请为以下Git变更生成简洁的提交信息（Conventional Commits格式）：

\`\`\`diff
${diff.substring(0, 8000)}
\`\`\`

要求：
1. 使用中文
2. 格式：<type>: <description>
3. type可选：feat/fix/docs/style/refactor/test/chore
4. 不超过50个字${memoryHint}

只返回提交信息本身，不要其他解释。`;

    const result = await this.llmPort.call({
      messages: [
        { role: 'system', content: '你是一位经验丰富的Git专家，擅长编写规范的提交信息。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 200
    });

    if (!result.success || !result.text) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    return result.text.trim();
  }

  /**
   * 应用提交信息
   */
  private async applyCommitMessage(workspacePath: string, message: string, intent: Intent): Promise<void> {
    // ✅ 修复 #28：校验 TaskToken
    const taskToken = intent.metadata.taskToken;
    if (!taskToken) {
      throw new Error('缺少写操作授权令牌（TaskToken），无法执行 Git 提交');
    }
    
    const isValid = this.taskTokenManager.validateToken(taskToken, 'write');
    if (!isValid) {
      throw new Error('写操作授权令牌无效或已过期，请重新尝试');
    }
    
    console.log(`[GenerateCommitAgent] TaskToken validated: ${taskToken}`);
    
    try {
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { 
        cwd: workspacePath 
      });
      
      // ✅ 修复 #28：提交成功后撤销 Token（一次性使用）
      this.taskTokenManager.revokeToken(taskToken);
      console.log(`[GenerateCommitAgent] TaskToken revoked after successful commit`);
    } catch (error) {
      // 提交应用失败，重新抛出由调用方处理
      throw error;
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Agent已清理
  }
}
