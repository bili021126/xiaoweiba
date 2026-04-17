/**
 * 提交信息生成命令 - 记忆增强版本（Phase 1）
 * 
 * 改进点：
 * 1. 利用历史提交记忆增强Prompt
 * 2. 学习用户提交风格偏好
 * 3. 提供"查看历史提交"UI功能
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { CommitStyleLearner, CommitStylePreference } from '../core/memory/CommitStyleLearner';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { EpisodicMemoryRecord } from '../core/memory/types';

const execAsync = promisify(exec);

export class GenerateCommitCommandV2 {
  private auditLogger: AuditLogger;
  private episodicMemory: EpisodicMemory;
  private commitStyleLearner: CommitStyleLearner;
  private llmTool: LLMTool;

  // 配置常量
  private readonly MAX_FILES_TO_SEARCH = 5;
  private readonly MAX_MEMORIES_TO_RETURN = 5;
  private readonly MAX_MEMORIES_PER_FILE = 3;
  private readonly MAX_DIFF_LENGTH = 8000;
  private readonly LLM_TEMPERATURE = 0.3;
  private readonly LLM_MAX_TOKENS = 500;

  constructor(
    episodicMemory?: EpisodicMemory,
    llmTool?: LLMTool,
    commitStyleLearner?: CommitStyleLearner
  ) {
    this.auditLogger = container.resolve(AuditLogger);
    this.episodicMemory = episodicMemory || container.resolve(EpisodicMemory);
    this.llmTool = llmTool || container.resolve(LLMTool);
    this.commitStyleLearner = commitStyleLearner || container.resolve(CommitStyleLearner);
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
        title: '🚀 智能生成提交信息',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '📊 分析代码变更...', increment: 10 });

        const diff = await this.getGitDiff(workspacePath);
        
        if (!diff || diff.trim().length === 0) {
          vscode.window.showInformationMessage('✅ 没有检测到代码变更');
          return;
        }

        progress.report({ message: '🧠 检索历史记忆...', increment: 20 });

        // 3. 学习用户提交风格
        const preference = await this.commitStyleLearner.learnFromHistory();
        
        // 4. 检索相关文件的历史提交
        const changedFiles = await this.getChangedFiles(workspacePath);
        const relevantMemories = await this.retrieveRelevantMemories(changedFiles);

        progress.report({ message: '🤖 调用 AI 生成提交信息...', increment: 40 });

        // 5. 使用增强的Prompt生成提交信息
        const commitMessage = await this.generateCommitMessageWithMemory(
          diff,
          preference,
          relevantMemories
        );
        
        progress.report({ message: '✨ 生成完成，准备提交...', increment: 60 });

        // 6. 展示生成结果并提供操作选项
        await this.showCommitMessageOptions(commitMessage, diff, workspacePath);

        progress.report({ message: '💾 记录情景记忆...', increment: 80 });

        // 7. 记录情景记忆
        const durationMs = Date.now() - startTime;
        console.log('[GenerateCommitCommandV2] About to record memory, duration:', durationMs);
        try {
          await this.recordMemory(commitMessage, diff, durationMs);
          console.log('[GenerateCommitCommandV2] Memory recording completed');
          progress.report({ message: '✅ 全部完成！', increment: 100 });
        } catch (memoryError) {
          console.error('[GenerateCommitCommandV2] Memory recording failed:', memoryError);
          progress.report({ message: '⚠️ 记忆记录失败，但提交已成功', increment: 100 });
        }
      });

      // 8. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('generate_commit_v2', 'success', durationMs, {
        parameters: {
          hasChanges: true,
          memoriesUsed: true
        }
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`生成提交信息失败: ${errorMessage}`);
      
      await this.auditLogger.logError('generate_commit_v2', error as Error, durationMs);
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
   * 获取变更的文件列表
   */
  private async getChangedFiles(workspacePath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'git status --porcelain',
        { cwd: workspacePath }
      );

      // 解析git status输出，提取文件名
      const files = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          // git status --porcelain 格式: "XY filename"
          const parts = line.trim().split(/\s+/);
          return parts.length >= 2 ? parts.slice(1).join(' ') : parts[0];
        });

      return files;
    } catch (error) {
      console.error('[GenerateCommitCommandV2] Failed to get changed files:', error);
      return [];
    }
  }

  /**
   * 检索相关文件的历史提交记忆
   */
  private async retrieveRelevantMemories(files: string[]): Promise<EpisodicMemoryRecord[]> {
    // 并行检索所有文件的记忆，提升性能
    const searchPromises = files.slice(0, this.MAX_FILES_TO_SEARCH).map(async (file) => {
      const fileName = file.split('/').pop()?.split('\\').pop() || '';
      if (!fileName) return [];

      return await this.episodicMemory.search(fileName, {
        taskType: 'COMMIT_GENERATE',
        limit: this.MAX_MEMORIES_PER_FILE
      });
    });

    const results = await Promise.all(searchPromises);
    const memories = results.flat();

    // 去重并按时间排序
    const uniqueMemories = memories.filter(
      (m, index, self) => index === self.findIndex((t) => t.id === m.id)
    ).sort((a, b) => b.timestamp - a.timestamp);

    return uniqueMemories.slice(0, this.MAX_MEMORIES_TO_RETURN);
  }

  /**
   * 使用记忆增强的Prompt生成提交信息
   */
  private async generateCommitMessageWithMemory(
    diff: string,
    preference: CommitStylePreference,
    relevantMemories: EpisodicMemoryRecord[]
  ): Promise<string> {
    // 限制 diff 长度
    const truncatedDiff = diff.length > this.MAX_DIFF_LENGTH 
      ? diff.substring(0, this.MAX_DIFF_LENGTH) + '\n...(内容过长已截断)'
      : diff;

    // 格式化历史记忆
    const historyText = relevantMemories.length > 0
      ? relevantMemories.map((m, i) => {
          const firstLine = m.decision?.split('\n')[0] || '';
          const date = new Date(m.timestamp).toLocaleDateString('zh-CN');
          return `${i + 1}. ${firstLine} (${date})`;
        }).join('\n')
      : '（无相关历史记录）';

    // 格式化偏好
    const preferenceText = this.commitStyleLearner.formatPreferenceForPrompt(preference);

    // 构建增强Prompt
    const prompt = `你是一位经验丰富的开发者，擅长编写规范的 Git 提交信息。

**用户提交风格偏好**：
${preferenceText}

**该文件的历史提交记录**：
${historyText}

**当前变更**：
\`\`\`diff
${truncatedDiff}
\`\`\`

**要求**：
1. 保持与历史提交一致的风格
2. 遵循 Conventional Commits 规范（feat/fix/docs/style/refactor/test/chore）
3. 如果之前类似变更使用了特定术语，请沿用
4. 第一行是标题（不超过 50 字符）
5. 空一行后是详细描述（可选，每条 bullet point 不超过 72 字符）
6. 只返回提交信息本身，不要其他解释

请生成提交信息：`;

    const result = await this.llmTool.call({
      messages: [
        { 
          role: 'system', 
          content: '你是一位经验丰富的开发者，擅长编写规范的 Git 提交信息。你会根据代码变更、历史提交记录和用户偏好，生成简洁、准确、符合团队风格的提交信息。' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: this.LLM_TEMPERATURE,
      maxTokens: this.LLM_MAX_TOKENS
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'LLM 调用失败');
    }

    // 清理返回结果
    let commitMessage = result.data.trim();
    commitMessage = commitMessage
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    // 提取Conventional Commits格式的行
    const lines = commitMessage.split('\n').filter(l => l.trim());
    const conventionalLine = lines.find(l => /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(l));
    
    if (conventionalLine) {
      commitMessage = conventionalLine;
    } else if (lines.length > 0) {
      commitMessage = lines[0];
    }
    
    commitMessage = commitMessage.trim();
    
    if (!commitMessage) {
      console.warn('[GenerateCommitCommandV2] LLM returned empty message, using fallback');
      commitMessage = 'chore: update files';
    }

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
    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(check) 使用此提交信息', description: commitMessage },
        { label: '$(refresh) 重新生成', description: '基于相同变更重新生成' },
        { label: '$(edit) 手动编辑', description: '在编辑器中修改' },
        { label: '$(info) 查看历史提交', description: '查看相关文件的历史提交记录' },
        { label: '$(close) 取消', description: '放弃本次操作' }
      ],
      { placeHolder: '选择操作' }
    );

    if (!choice) return;

    switch (choice.label) {
      case '$(check) 使用此提交信息':
        await this.executeCommit(commitMessage, workspacePath);
        break;
      
      case '$(refresh) 重新生成':
        vscode.window.showInformationMessage('🔄 正在重新生成...');
        setTimeout(() => this.execute(), 100);  // 异步执行，避免嵌套progress导致内存泄漏
        break;
      
      case '$(edit) 手动编辑':
        await this.editCommitMessage(commitMessage, workspacePath);
        break;
      
      case '$(info) 查看历史提交':
        await this.showHistoryPanel();
        break;
    }
  }

  /**
   * 执行 Git 提交
   */
  private async executeCommit(commitMessage: string, workspacePath: string): Promise<void> {
    try {
      // 先暂存所有更改
      await execAsync('git add .', { cwd: workspacePath });
      
      // 提交
      await execAsync(
        `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
        { cwd: workspacePath }
      );

      vscode.window.showInformationMessage('✅ 提交成功');
    } catch (error) {
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`提交失败: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 手动编辑提交信息
   */
  private async editCommitMessage(commitMessage: string, workspacePath: string): Promise<void> {
    const editedMessage = await vscode.window.showInputBox({
      value: commitMessage,
      placeHolder: '输入提交信息',
      prompt: '编辑提交信息',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return '提交信息不能为空';
        }
        return null;
      }
    });

    if (editedMessage) {
      await this.executeCommit(editedMessage, workspacePath);
    }
  }

  /**
   * 显示历史提交面板
   */
  private async showHistoryPanel(): Promise<void> {
    vscode.commands.executeCommand('xiaoweiba.showCommitHistory');
  }

  /**
   * 记录情景记忆
   */
  private async recordMemory(
    commitMessage: string,
    diff: string,
    durationMs: number
  ): Promise<void> {
    try {
      // 提取type和scope
      const match = commitMessage.match(/^(feat|fix|docs|style|refactor|test|chore)(?:\(([^)]+)\))?:/);
      const commitType = match?.[1] || 'chore';
      const scope = match?.[2];

      // 统计变更文件数
      const filesChanged = diff.split('\n').filter(line => line.startsWith('diff --git')).length;

      await this.episodicMemory.record({
        taskType: 'COMMIT_GENERATE',
        summary: `生成${commitType}类型的提交信息`,
        entities: [],  // TODO: 从diff中提取文件列表
        decision: commitMessage,
        outcome: 'SUCCESS',
        modelId: 'unknown',  // TODO: 从LLMTool获取实际modelId
        durationMs
      });

      console.log('[GenerateCommitCommandV2] Memory recorded successfully');
    } catch (error) {
      console.error('[GenerateCommitCommandV2] Failed to record memory:', error);
      // 不抛出错误，避免影响主流程
    }
  }
}
