import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';

const writeFile = promisify(fs.writeFile);

/**
 * 记忆数据接口（用于导出）
 */
interface ExportedMemoryData {
  /** 导出元信息 */
  metadata: {
    version: string;
    exportDate: string;
    totalCount: number;
    projectFingerprint?: string;
  };
  /** 情景记忆记录 */
  episodicMemories: any[];
}

/**
 * 记忆导出命令处理器
 */
export class ExportMemoryCommand {
  private episodicMemory: EpisodicMemory;
  private auditLogger: AuditLogger;

  constructor() {
    this.episodicMemory = container.resolve(EpisodicMemory);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行记忆导出命令
   */
  async execute(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. 获取记忆统计信息
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在准备导出记忆...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '获取记忆统计...' });

        const stats = await this.episodicMemory.getStats();
        
        if (stats.totalCount === 0) {
          vscode.window.showInformationMessage('当前没有可导出的记忆');
          return;
        }

        // 2. 选择导出路径
        progress.report({ message: '选择保存位置...' });
        
        const saveUri = await vscode.window.showSaveDialog({
          filters: {
            'JSON Files': ['json'],
            'All Files': ['*']
          },
          defaultUri: vscode.Uri.file(`xiaoweiba-memory-${this.formatDate(new Date())}.json`),
          title: '选择记忆导出文件保存位置'
        });

        if (!saveUri) {
          // 用户取消
          return;
        }

        // 3. 检索所有记忆
        progress.report({ message: `检索 ${stats.totalCount} 条记忆...` });
        
        const memories = await this.retrieveAllMemories();

        // 4. 构建导出数据
        progress.report({ message: '构建导出数据...' });
        
        const exportData: ExportedMemoryData = {
          metadata: {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            totalCount: memories.length,
            projectFingerprint: await this.getProjectFingerprint()
          },
          episodicMemories: memories
        };

        // 5. 写入文件
        progress.report({ message: '写入文件...' });
        
        await writeFile(saveUri.fsPath, JSON.stringify(exportData, null, 2), 'utf-8');

        // 6. 显示成功消息
        vscode.window.showInformationMessage(
          `成功导出 ${memories.length} 条记忆到 ${path.basename(saveUri.fsPath)}`,
          '打开文件位置'
        ).then(selection => {
          if (selection === '打开文件位置') {
            vscode.commands.executeCommand('revealFileInOS', saveUri);
          }
        });

        // 7. 记录审计日志
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('export_memory', 'success', durationMs, {
          parameters: {
            exportedCount: memories.length,
            filePath: saveUri.fsPath
          }
        });
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`记忆导出失败: ${errorMessage}`);
      
      await this.auditLogger.logError('export_memory', error as Error, durationMs);
    }
  }

  /**
   * 检索所有记忆
   */
  private async retrieveAllMemories(): Promise<any[]> {
    // 分批检索，避免一次性加载过多数据
    const batchSize = 100;
    const allMemories: any[] = [];
    let offset = 0;

    while (true) {
      // 使用retrieve方法获取记忆（不带过滤条件）
      const batch = await this.episodicMemory.retrieve({});
      
      if (!batch || batch.length === 0) {
        break;
      }

      allMemories.push(...batch);
      offset += batchSize;

      // 如果返回数量小于批次大小，说明已经是最后一批
      if (batch.length < batchSize) {
        break;
      }
    }

    return allMemories;
  }

  /**
   * 获取项目指纹
   */
  private async getProjectFingerprint(): Promise<string | undefined> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
      }

      // 简单实现：使用工作区路径的哈希
      const crypto = require('crypto');
      const workspacePath = workspaceFolders[0].uri.fsPath;
      return crypto.createHash('sha256').update(workspacePath).digest('hex').substring(0, 16);
    } catch (error) {
      console.warn('获取项目指纹失败:', error);
      return undefined;
    }
  }

  /**
   * 格式化日期为字符串
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}-${hours}${minutes}`;
  }
}
