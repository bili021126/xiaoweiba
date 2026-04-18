import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { DatabaseManager } from '../storage/DatabaseManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';
import * as crypto from 'crypto';

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
export class ExportMemoryCommand extends BaseCommand {
  private episodicMemory: EpisodicMemory;
  private databaseManager: DatabaseManager;
  private auditLogger: AuditLogger;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus
  ) {
    super(memorySystem, eventBus, 'exportMemory');
    this.episodicMemory = container.resolve(EpisodicMemory);
    this.databaseManager = container.resolve(DatabaseManager);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行记忆导出命令
   */
  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 获取记忆统计信息
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在准备导出记忆...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '获取记忆统计...' });

        // 获取所有记忆
        const memories = await this.retrieveAllMemories();
        
        if (memories.length === 0) {
          vscode.window.showInformationMessage('当前没有可导出的记忆');
          return { success: true, data: { count: 0 } };
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
          return { success: false, error: 'User cancelled' };
        }

        // 3. 构建导出数据
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

        // 4. 写入文件
        progress.report({ message: '写入文件...' });
        
        await writeFile(saveUri.fsPath, JSON.stringify(exportData, null, 2), 'utf-8');

        // 5. 显示成功消息
        vscode.window.showInformationMessage(
          `成功导出 ${memories.length} 条记忆到 ${path.basename(saveUri.fsPath)}`,
          '打开文件位置'
        ).then(selection => {
          if (selection === '打开文件位置') {
            vscode.commands.executeCommand('revealFileInOS', saveUri);
          }
        });

        // 6. 记录审计日志
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('export_memory', 'success', durationMs, {
          parameters: {
            exportedCount: memories.length,
            filePath: saveUri.fsPath
          }
        });

        // 7. 发布任务完成事件
        this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
          actionId: 'exportMemory',
          result: { success: true, count: memories.length },
          durationMs
        }, { source: 'ExportMemoryCommand' });

        return { success: true, data: { count: memories.length, filePath: saveUri.fsPath } };
      });

      return result;

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`记忆导出失败: ${errorMessage}`);
      
      await this.auditLogger.logError('export_memory', error as Error, durationMs);
      
      // 即使失败也发布事件
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId: 'exportMemory',
        result: { success: false, error: errorMessage },
        durationMs
      }, { source: 'ExportMemoryCommand' });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 检索所有记忆
   */
  private async retrieveAllMemories(): Promise<any[]> {
    try {
      // 直接使用episodicMemory.getAll()获取所有记忆
      const db = this.databaseManager.getDatabase();
      if (!db) {
        console.warn('[ExportMemoryCommand] Database not initialized');
        return [];
      }

      // 查询所有情景记忆
      const stmt = db.prepare('SELECT * FROM episodic_memories ORDER BY timestamp DESC');
      const rows: any[] = [];
      
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      
      stmt.free();
      
      // 转换为对象数组
      return rows.map((row: any) => ({
        id: row.id,
        taskType: row.task_type,
        summary: row.summary,
        entities: row.entities ? JSON.parse(row.entities) : [],
        outcome: row.outcome,
        modelId: row.model_id,
        durationMs: row.duration_ms,
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));
    } catch (error) {
      console.error('[ExportMemoryCommand] Failed to retrieve memories:', error);
      return [];
    }
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
