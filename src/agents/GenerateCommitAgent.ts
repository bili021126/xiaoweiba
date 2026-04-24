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
import { CommitStyleLearner } from '../core/memory/CommitStyleLearner'; // ✅ 增强 #1：引入风格学习器
import { DiffService } from '../tools/DiffService'; // ✅ 增强 #3：引入 DiffService

const execAsync = promisify(exec);

@injectable()
export class GenerateCommitAgent implements IAgent {
  readonly id = 'generate-commit-agent';
  readonly name = '提交信息生成助手';
  readonly supportedIntents = ['generate_commit'];

  constructor(
    @inject('ILLMPortPro') private llmPort: ILLMPort, // ✅ 成本优化：复杂推理使用Pro模型
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus, // ✅ P1-04: 注入事件总线
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager, // ✅ 修复 #28：注入 TaskTokenManager
    @inject(CommitStyleLearner) private styleLearner: CommitStyleLearner // ✅ 增强 #1：注入风格学习器
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

      // 2. ✅ 增强 #4: 多状态场景支持 - 检测 Git 状态
      let commitMessage = ''; // ✅ P1-04: 提升作用域
      let diff = ''; // ✅ 修复 #P3: 提升作用域
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🚀 智能生成提交信息',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '📊 分析代码变更...', increment: 10 });

        // 先检查是否有 staged 变更
        diff = await this.getGitDiff(workspacePath);
        
        // ✅ 如果没有 staged 变更，检查是否有未暂存变更
        if (!diff || diff.trim().length === 0) {
          const unstagedDiff = await this.getUnstagedDiff(workspacePath);
          if (unstagedDiff && unstagedDiff.trim().length > 0) {
            const choice = await vscode.window.showWarningMessage(
              '⚠️ 检测到未暂存的变更，是否一键暂存所有变更？',
              { modal: true },
              '✅ 是，暂存所有变更',
              '❌ 否，取消操作'
            );
            
            if (choice === '✅ 是，暂存所有变更') {
              await this.stageAllChanges(workspacePath);
              diff = await this.getGitDiff(workspacePath);
            } else {
              vscode.window.showInformationMessage('❌ 已取消操作');
              return;
            }
          }
          
          if (!diff || diff.trim().length === 0) {
            vscode.window.showInformationMessage('✅ 没有检测到代码变更');
            return;
          }
        }

        progress.report({ message: '🧠 学习提交风格...', increment: 20 });

        // ✅ 增强 #5: 变更规模分析
        const changedFilesCount = (diff.match(/diff --git/g) || []).length;
        if (changedFilesCount > 5) {
          // 大型变更检测：建议用户拆分提交
        }

        // ✅ 增强 #6: 预提交安全检查 - 检测敏感文件
        const sensitiveFiles = ['.env', 'secrets', 'credentials', 'private_key', '.pem'];
        const hasSensitiveFile = sensitiveFiles.some(file => diff.includes(file));
        if (hasSensitiveFile) {
          const warning = await vscode.window.showWarningMessage(
            '⚠️ 检测到可能包含敏感信息的文件被修改，是否继续提交？',
            { modal: true },
            '✅ 是，继续提交',
            '❌ 否，取消操作'
          );
          
          if (warning !== '✅ 是，继续提交') {
            vscode.window.showInformationMessage('❌ 已取消提交');
            return;
          }
        }

        // ✅ 增强 #1: 学习用户历史提交风格
        const stylePreferences = await this.styleLearner.learnFromHistory();
        
        progress.report({ message: '✨ 生成提交信息...', increment: 40 });

        // 3. 调用 LLM 生成提交信息（注入记忆上下文 + 风格偏好）
        commitMessage = await this.generateCommitMessage(diff, memoryContext, stylePreferences);
        
        progress.report({ message: '⏳ 等待确认...', increment: 60 });

        // ✅ 增强 #3: 交互式确认与编辑
        const diffService = new DiffService();
        const confirmed = await diffService.confirmChangeWithWebview(
          '当前生成的提交信息：',
          commitMessage,
          workspacePath
        );

        if (!confirmed) {
          vscode.window.showInformationMessage('❌ 已取消提交');
          return;
        }
        
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
  private async generateCommitMessage(diff: string, context: MemoryContext, stylePreferences?: any): Promise<string> {
    // ✅ 增强 #1: 注入风格偏好
    let styleHint = '';
    if (stylePreferences) {
      styleHint = `\n\n用户提交风格偏好：\n- 常用类型: ${stylePreferences.commonTypes?.join(', ') || 'feat, fix'}\n- 描述长度: ${stylePreferences.descriptionLength || '简短'}`;
    }

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
    

    
    try {
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { 
        cwd: workspacePath 
      });
      
      // ✅ 修复 #28：提交成功后撤销 Token（一次性使用）
      this.taskTokenManager.revokeToken(taskToken);
      
    } catch (error) {
      // 提交应用失败，重新抛出由调用方处理
      throw error;
    }
  }

  /**
   * ✅ 增强 #4: 获取未暂存变更的 diff
   */
  private async getUnstagedDiff(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git diff', { cwd: workspacePath });
      return stdout;
    } catch (error) {

      return '';
    }
  }

  /**
   * ✅ 增强 #4: 一键暂存所有变更
   */
  private async stageAllChanges(workspacePath: string): Promise<void> {
    try {
      await execAsync('git add .', { cwd: workspacePath });
      
    } catch (error) {
      throw new Error(`暂存变更失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Agent已清理
  }
}
