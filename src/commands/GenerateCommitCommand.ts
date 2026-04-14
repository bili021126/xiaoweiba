import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';

const execAsync = promisify(exec);

/**
 * 提交信息生成命令处理器
 */
export class GenerateCommitCommand {
  private auditLogger: AuditLogger;
  private episodicMemory: EpisodicMemory;
  private llmTool: LLMTool;

  constructor(episodicMemory?: EpisodicMemory, llmTool?: LLMTool) {
    this.auditLogger = container.resolve(AuditLogger);
    this.episodicMemory = episodicMemory || container.resolve(EpisodicMemory);
    this.llmTool = llmTool || container.resolve(LLMTool);
  }

  /**
   * 执行提交信息生成命令
   */
  async execute(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 检查工作区是否有 Git 仓库
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('请先打开一个工作区');
        return;
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;

      // 2. 获取 Git diff
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在分析代码变更...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '获取 Git 差异...' });

        const diff = await this.getGitDiff(workspacePath);
        
        if (!diff || diff.trim().length === 0) {
          vscode.window.showInformationMessage('没有检测到代码变更');
          return;
        }

        progress.report({ message: '调用 AI 生成提交信息...' });

        // 3. 调用 LLM 生成提交信息
        const commitMessage = await this.generateCommitMessage(diff);
        
        progress.report({ message: '生成完成' });

        // 4. 展示生成结果并提供操作选项
        await this.showCommitMessageOptions(commitMessage, diff, workspacePath);

        // 5. 记录情景记忆
        const durationMs = Date.now() - startTime;
        console.log('[GenerateCommitCommand] About to record memory, duration:', durationMs);
        try {
          await this.recordMemory(commitMessage, diff, durationMs);
          console.log('[GenerateCommitCommand] Memory recording completed');
        } catch (memoryError) {
          console.error('[GenerateCommitCommand] Memory recording failed:', memoryError);
        }
      });

      // 6. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('generate_commit', 'success', durationMs, {
        parameters: {
          hasChanges: true
        }
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`生成提交信息失败: ${errorMessage}`);
      
      await this.auditLogger.logError('generate_commit', error as Error, durationMs);
    }
  }

  /**
   * 获取 Git 差异
   */
  private async getGitDiff(workspacePath: string): Promise<string> {
    try {
      // 先检查是否是 Git 仓库
      await execAsync('git rev-parse --git-dir', { cwd: workspacePath });
      
      // 获取暂存区和未暂存区的差异
      const { stdout: stagedDiff } = await execAsync(
        'git diff --cached',
        { cwd: workspacePath, maxBuffer: 1024 * 1024 }
      );
      
      const { stdout: unstagedDiff } = await execAsync(
        'git diff',
        { cwd: workspacePath, maxBuffer: 1024 * 1024 }
      );

      // 合并两个差异
      let diff = '';
      if (stagedDiff) {
        diff += '# 暂存区的变更:\n' + stagedDiff;
      }
      if (unstagedDiff) {
        if (stagedDiff) {
          diff += '\n\n';
        }
        diff += '# 未暂存区的变更:\n' + unstagedDiff;
      }

      return diff;
    } catch (error) {
      if ((error as any).message?.includes('not a git repository')) {
        throw new Error('当前工作区不是 Git 仓库');
      }
      throw error;
    }
  }

  /**
   * 使用 LLM 生成提交信息
   */
  private async generateCommitMessage(diff: string): Promise<string> {
    // 限制 diff 长度，避免超出 token 限制
    const maxDiffLength = 8000;
    const truncatedDiff = diff.length > maxDiffLength 
      ? diff.substring(0, maxDiffLength) + '\n...(内容过长已截断)'
      : diff;

    const prompt = `请根据以下 Git diff 生成简洁、规范的提交信息（commit message）。

要求：
1. 使用中文
2. 遵循 Conventional Commits 规范（feat/fix/docs/style/refactor/test/chore 等类型）
3. 第一行是标题（不超过 50 字符）
4. 空一行后是详细描述（可选，每条 bullet point 不超过 72 字符）
5. 只返回提交信息本身，不要其他解释

Git Diff：
\`\`\`diff
${truncatedDiff}
\`\`\``;

    const result = await this.llmTool.call({
      messages: [
        { role: 'system', content: '你是一位经验丰富的开发者，擅长编写规范的 Git 提交信息。你会根据代码变更生成简洁、准确、符合 Conventional Commits 规范的提交信息。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      maxTokens: 500
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 清理返回结果，去除可能的 markdown 代码块标记
    let commitMessage = result.data.trim();
    commitMessage = commitMessage.replace(/^```commit\s*/m, '').replace(/```\s*$/m, '');
    commitMessage = commitMessage.replace(/^```\s*/m, '').replace(/```\s*$/m, '');
    
    commitMessage = commitMessage.trim();
    
    // 如果LLM返回空内容，使用默认提交消息
    if (!commitMessage) {
      console.warn('[GenerateCommitCommand] LLM returned empty message, using fallback');
      commitMessage = 'chore: update files';
    }
    
    console.log('[GenerateCommitCommand] Generated commit message:', commitMessage.substring(0, 60));
    return commitMessage;
  }

  /**
   * 展示提交信息选项
   */
  private async showCommitMessageOptions(
    commitMessage: string,
    diff: string,
    workspacePath: string
  ): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      '提交信息已生成',
      { modal: true, detail: commitMessage },
      '复制并提交',
      '仅复制',
      '编辑后提交',
      '重新生成'
    );

    switch (action) {
      case '复制并提交':
        await this.copyAndCommit(commitMessage, workspacePath);
        break;
      case '仅复制':
        await vscode.env.clipboard.writeText(commitMessage);
        vscode.window.showInformationMessage('提交信息已复制到剪贴板');
        break;
      case '编辑后提交':
        await this.editAndCommit(commitMessage, workspacePath);
        break;
      case '重新生成':
        await this.execute();
        break;
      default:
        // 用户取消
        break;
    }
  }

  /**
   * 复制并提交
   */
  private async copyAndCommit(commitMessage: string, workspacePath: string): Promise<void> {
    // 复制到剪贴板
    await vscode.env.clipboard.writeText(commitMessage);

    // 如果有未暂存的变更，询问是否自动暂存
    const { stdout: unstagedFiles } = await execAsync('git diff --name-only', { cwd: workspacePath });
    
    if (unstagedFiles.trim()) {
      const shouldStage = await vscode.window.showWarningMessage(
        '检测到未暂存的文件，是否自动暂存所有变更？',
        { modal: true },
        '是',
        '否'
      );

      if (shouldStage === '是') {
        await execAsync('git add .', { cwd: workspacePath });
      }
    }

    // 执行提交
    try {
      await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: workspacePath });
      vscode.window.showInformationMessage('提交成功！');
      
      // 刷新 Git 视图
      vscode.commands.executeCommand('git.refresh');
    } catch (error) {
      vscode.window.showErrorMessage(`提交失败: ${(error as Error).message}`);
    }
  }

  /**
   * 编辑后提交
   */
  private async editAndCommit(initialMessage: string, workspacePath: string): Promise<void> {
    // 创建临时文档供用户编辑
    const document = await vscode.workspace.openTextDocument({
      content: initialMessage,
      language: 'plaintext'
    });

    const editor = await vscode.window.showTextDocument(document);

    // 等待用户保存并关闭
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
      if (savedDoc.uri === document.uri) {
        saveListener.dispose();
        
        const editedMessage = savedDoc.getText().trim();
        
        if (!editedMessage) {
          vscode.window.showWarningMessage('提交信息不能为空');
          return;
        }

        // 关闭编辑器
        await vscode.window.showTextDocument(savedDoc, { preview: true });
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // 执行提交
        try {
          await execAsync(`git commit -m "${editedMessage.replace(/"/g, '\\"')}"`, { cwd: workspacePath });
          vscode.window.showInformationMessage('提交成功！');
          
          // 刷新 Git 视图
          vscode.commands.executeCommand('git.refresh');
        } catch (error) {
          vscode.window.showErrorMessage(`提交失败: ${(error as Error).message}`);
        }
      }
    });
  }

  /**
   * 记录情景记忆
   */
  private async recordMemory(
    commitMessage: string,
    diff: string,
    durationMs: number
  ): Promise<void> {
    console.log('[GenerateCommitCommand] recordMemory() called');
    try {
      // 提取变更的文件列表
      const changedFiles = diff
        .split('\n')
        .filter(line => line.startsWith('diff --git'))
        .map(line => line.match(/b\/(.+)$/)?.[1])
        .filter(Boolean) as string[];

      // 提取提交类型
      const commitType = commitMessage.split(':')[0]?.split('(')[0] || 'unknown';

      console.log('[GenerateCommitCommand] Calling episodicMemory.record...');
      await this.episodicMemory.record({
        taskType: 'COMMIT_GENERATE',
        summary: `生成${commitType}类型的提交信息`,
        entities: changedFiles.length > 0 ? changedFiles.slice(0, 5) : ['unknown'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs,
        decision: commitMessage.substring(0, 200) // 截取前200字符作为决策摘要
      });
      console.log('[GenerateCommitCommand] episodicMemory.record() completed');
    } catch (error) {
      // 记忆记录失败不影响主流程，仅记录日志
      console.warn('记忆记录失败:', error);
    }
  }
}
