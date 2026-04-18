import * as vscode from 'vscode';
import * as fs from 'fs';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { DatabaseManager } from '../storage/DatabaseManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';
import { BaseCommand, CommandInput, CommandResult } from '../core/memory/BaseCommand';
import { MemorySystem, MemoryContext } from '../core/memory/MemorySystem';
import { EventBus, CoreEventType } from '../core/eventbus/EventBus';

const readFile = promisify(fs.readFile);

/**
 * 导入的记忆数据接口
 */
interface ImportedMemoryData {
  metadata: {
    version: string;
    exportDate: string;
    totalCount: number;
    projectFingerprint?: string;
  };
  episodicMemories: any[];
}

/**
 * 记忆导入命令处理器
 */
export class ImportMemoryCommand extends BaseCommand {
  private databaseManager: DatabaseManager;
  private auditLogger: AuditLogger;

  constructor(
    memorySystem: MemorySystem,
    eventBus: EventBus
  ) {
    super(memorySystem, eventBus, 'importMemory');
    this.databaseManager = container.resolve(DatabaseManager);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行记忆导入命令
   */
  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // 1. 选择导入文件
      const openUri = await vscode.window.showOpenDialog({
        filters: {
          'JSON Files': ['json'],
          'All Files': ['*']
        },
        canSelectMany: false,
        title: '选择要导入的记忆文件'
      });

      if (!openUri || openUri.length === 0) {
        return { success: false, error: 'User cancelled' };
      }

      const filePath = openUri[0].fsPath;

      // 2. 读取并验证文件
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在导入记忆...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '读取文件...' });

        const fileContent = await readFile(filePath, 'utf-8');
        let importData: ImportedMemoryData;

        try {
          importData = JSON.parse(fileContent);
        } catch (parseError) {
          throw new Error('文件格式错误：无法解析JSON');
        }

        // 3. 验证数据结构
        progress.report({ message: '验证数据...' });
        
        if (!this.validateImportData(importData)) {
          throw new Error('数据格式错误：缺少必要字段');
        }

        // 4. 显示导入确认对话框
        const confirmed = await this.showImportConfirmation(importData);
        if (!confirmed) {
          vscode.window.showInformationMessage('已取消导入');
          return { success: false, error: 'User cancelled' };
        }

        // 5. 执行导入
        progress.report({ message: `导入 ${importData.episodicMemories.length} 条记忆...` });
        
        const importResult = await this.importMemories(importData.episodicMemories);

        // 6. 显示导入结果
        const message = `成功导入 ${importResult.successCount} 条记忆，跳过 ${importResult.skipCount} 条`;
        
        if (importResult.errorCount > 0) {
          vscode.window.showWarningMessage(
            `${message}，${importResult.errorCount} 条失败`,
            '查看详情'
          ).then(selection => {
            if (selection === '查看详情') {
              this.showImportErrors(importResult.errors);
            }
          });
        } else {
          vscode.window.showInformationMessage(message);
        }

        // 7. 记录审计日志
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('import_memory', 'success', durationMs, {
          parameters: {
            importedCount: importResult.successCount,
            skippedCount: importResult.skipCount,
            errorCount: importResult.errorCount,
            sourceFile: filePath
          }
        });

        return { success: true, data: importResult };
      });

      return result;

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`记忆导入失败: ${errorMessage}`);
      
      await this.auditLogger.logError('import_memory', error as Error, durationMs);
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 验证导入数据结构
   */
  private validateImportData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!data.metadata || !Array.isArray(data.episodicMemories)) {
      return false;
    }

    if (!data.metadata.version || !data.metadata.exportDate) {
      return false;
    }

    return true;
  }

  /**
   * 显示导入确认对话框
   */
  private async showImportConfirmation(importData: ImportedMemoryData): Promise<boolean> {
    const memoryCount = importData.episodicMemories.length;
    const exportDate = new Date(importData.metadata.exportDate).toLocaleString('zh-CN');
    const version = importData.metadata.version;

    const detail = [
      `导出时间: ${exportDate}`,
      `数据版本: ${version}`,
      `记忆数量: ${memoryCount} 条`,
      '',
      '是否继续导入？'
    ].join('\n');

    const result = await vscode.window.showWarningMessage(
      '确认导入记忆',
      { modal: true, detail },
      '导入',
      '取消'
    );

    return result === '导入';
  }

  /**
   * 执行记忆导入
   */
  private async importMemories(memories: any[]): Promise<{
    successCount: number;
    skipCount: number;
    errorCount: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const result = {
      successCount: 0,
      skipCount: 0,
      errorCount: 0,
      errors: [] as Array<{ index: number; error: string }>
    };

    const db = this.databaseManager.getDatabase();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    for (let i = 0; i < memories.length; i++) {
      try {
        const memory = memories[i];

        // 验证记忆数据结构
        if (!this.validateMemoryRecord(memory)) {
          result.skipCount++;
          continue;
        }

        // 检查是否已存在（通过ID或时间戳+摘要判断）
        const exists = await this.checkMemoryExists(db, memory);
        if (exists) {
          result.skipCount++;
          continue;
        }

        // 插入记忆到数据库
        let stmt: any = null;
        try {
          stmt = db.prepare(`
            INSERT INTO episodic_memories 
            (task_type, summary, entities, outcome, model_id, duration_ms, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.bind([
            memory.taskType,
            memory.summary,
            JSON.stringify(memory.entities || []),
            memory.outcome,
            memory.modelId || 'unknown',
            memory.durationMs || 0,
            memory.timestamp || Date.now(),
            JSON.stringify(memory.metadata || {})
          ]);
          
          stmt.step();
          result.successCount++;
        } finally {
          if (stmt) {
            try {
              stmt.free();
            } catch (e) {
              // 忽略free错误
            }
          }
        }
      } catch (error) {
        result.errorCount++;
        result.errors.push({
          index: i,
          error: (error as Error).message
        });
      }
    }

    return result;
  }

  /**
   * 验证单条记忆记录
   */
  private validateMemoryRecord(memory: any): boolean {
    if (!memory || typeof memory !== 'object') {
      return false;
    }

    // 必需字段检查
    if (!memory.taskType || !memory.summary || !memory.outcome) {
      return false;
    }

    // 任务类型有效性检查
    const validTaskTypes = [
      'CODE_EXPLAIN',
      'COMMIT_GENERATE',
      'CODE_REVIEW',
      'SQL_OPTIMIZE',
      'NAMING_CHECK',
      'REFACTOR',
      'DEBUG',
      'TEST_GENERATE',
      'CHAT_COMMAND'
    ];

    if (!validTaskTypes.includes(memory.taskType)) {
      return false;
    }

    // 结果有效性检查
    const validOutcomes = ['SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED'];
    if (!validOutcomes.includes(memory.outcome)) {
      return false;
    }

    return true;
  }

  /**
   * 检查记忆是否已存在
   */
  private async checkMemoryExists(db: any, memory: any): Promise<boolean> {
    let stmt: any = null;
    try {
      // 优先通过ID检查
      if (memory.id) {
        stmt = db.prepare('SELECT COUNT(*) as count FROM episodic_memories WHERE id = ?');
        stmt.bind([memory.id]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          return row.count > 0;
        }
        return false;
      }

      // 其次通过摘要和时间范围搜索相似记忆
      stmt = db.prepare(`
        SELECT COUNT(*) as count FROM episodic_memories 
        WHERE summary = ? AND task_type = ? AND ABS(timestamp - ?) < 2000
      `);
      stmt.bind([memory.summary, memory.taskType, memory.timestamp || Date.now()]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        return row.count > 0;
      }
      
      return false;
    } catch (error) {
      console.warn('[ImportMemoryCommand] checkMemoryExists failed:', error);
      return false;
    } finally {
      // 确保stmt被释放
      if (stmt) {
        try {
          stmt.free();
        } catch (e) {
          // 忽略free错误
        }
      }
    }
  }

  /**
   * 显示导入错误详情
   */
  private async showImportErrors(errors: Array<{ index: number; error: string }>): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'xiaoweiba.importErrors',
      '导入错误详情 - 小尾巴',
      vscode.ViewColumn.Beside,
      {
        enableScripts: false
      }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>导入错误详情</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      line-height: 1.6;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 {
      color: var(--vscode-errorForeground);
      border-bottom: 2px solid var(--vscode-errorForeground);
      padding-bottom: 10px;
    }
    .error-item {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 10px;
      margin: 10px 0;
      border-radius: 3px;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <h1>❌ 导入错误详情</h1>
  <p>共 ${errors.length} 条记忆导入失败：</p>
  ${errors.map(e => `
    <div class="error-item">
      <strong>${e.index + 1}. 第 ${e.index + 1} 条记忆</strong><br>
      <pre>${this.escapeHtml(e.error)}</pre>
    </div>
  `).join('')}
</body>
</html>`;
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
}
