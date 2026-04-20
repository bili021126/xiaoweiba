import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { injectable } from 'tsyringe';

const execAsync = promisify(exec);

@injectable()
export class ProjectFingerprint {
  private cache: Map<string, string> = new Map();

  /**
   * 获取当前工作区的项目指纹
   * 基于 Git 远程 URL + 工作区路径生成 SHA256 哈希
   */
  async getCurrentProjectFingerprint(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // 没有工作区时，使用默认指纹（允许单文件模式使用记忆）
      return 'default_workspace';
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // 检查缓存
    if (this.cache.has(workspacePath)) {
      return this.cache.get(workspacePath)!;
    }

    try {
      // 获取 Git 远程 URL
      const remoteUrl = await this.getGitRemoteUrl(workspacePath);

      // 生成指纹：SHA256(远程URL + 工作区路径)
      const fingerprint = this.generateFingerprint(remoteUrl, workspacePath);

      // 缓存结果
      this.cache.set(workspacePath, fingerprint);

      return fingerprint;
    } catch (error) {
      // 非 Git 项目，使用工作区路径哈希
      const fingerprint = this.generateFingerprint('', workspacePath);
      this.cache.set(workspacePath, fingerprint);
      return fingerprint;
    }
  }

  /**
   * 清除缓存（用于工作区切换时）
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取 Git 远程 URL
   */
  private async getGitRemoteUrl(workspacePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', {
        cwd: workspacePath,
        timeout: 5000
      });
      return stdout.trim();
    } catch {
      // 尝试其他远程名称
      try {
        const { stdout } = await execAsync('git remote', {
          cwd: workspacePath,
          timeout: 5000
        });
        const remotes = stdout.trim().split('\n').filter(Boolean);
        if (remotes.length > 0) {
          const { stdout: url } = await execAsync(
            `git remote get-url ${remotes[0]}`,
            { cwd: workspacePath, timeout: 5000 }
          );
          return url.trim();
        }
      } catch {
        // 无 Git 仓库
      }
      return '';
    }
  }

  /**
   * 生成指纹哈希
   */
  private generateFingerprint(remoteUrl: string, workspacePath: string): string {
    const input = `${remoteUrl}::${workspacePath}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}
