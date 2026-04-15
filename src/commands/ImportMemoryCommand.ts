import * as vscode from 'vscode';
import * as fs from 'fs';
import { promisify } from 'util';
import { container } from 'tsyringe';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { AuditLogger } from '../core/security/AuditLogger';
import { getUserFriendlyMessage } from '../utils/ErrorCodes';

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
export class ImportMemoryCommand {
  private episodicMemory: EpisodicMemory;
  private auditLogger: AuditLogger;

  constructor() {
    this.episodicMemory = container.resolve(EpisodicMemory);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行记忆导入命令
   */
  async execute(): Promise<void> {
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
        // 用户取消
        return;
      }

      const filePath = openUri[0].fsPath;

      // 2. 读取并验证文件
      await vscode.window.withProgress({
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
          return;
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
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = getUserFriendlyMessage(error);
      vscode.window.showErrorMessage(`记忆导入失败: ${errorMessage}`);
      
      await this.auditLogger.logError('import_memory', error as Error, durationMs);
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

    for (let i = 0; i < memories.length; i++) {
      try {
        const memory = memories[i];

        // 验证记忆数据结构
        if (!this.validateMemoryRecord(memory)) {
          result.skipCount++;
          continue;
        }

        // 检查是否已存在（通过ID或时间戳+摘要判断）
        console.log('[ImportMemoryCommand] Checking if memory exists:', memory.summary.substring(0, 50));
        const exists = await this.checkMemoryExists(memory);
        console.log('[ImportMemoryCommand] Memory exists:', exists);
        if (exists) {
          console.log('[ImportMemoryCommand] Skipping duplicate memory');
          result.skipCount++;
          continue;
        }

        // 导入记忆
        console.log('[ImportMemoryCommand] Importing memory...');
        await this.episodicMemory.record({
          taskType: memory.taskType,
          summary: memory.summary,
          entities: memory.entities || [],
          outcome: memory.outcome,
          modelId: memory.modelId,
          durationMs: memory.durationMs || 0,
          decision: memory.decision
        });

        result.successCount++;
        console.log('[ImportMemoryCommand] Memory imported successfully, total success:', result.successCount);
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
      'TEST_GENERATE'
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
  private async checkMemoryExists(memory: any): Promise<boolean> {
    try {
      // 优先通过ID检查（如果导出的记录有ID）
      if (memory.id) {
        const db = this.episodicMemory['dbManager'].getDatabase();
        
        // 使用sql.js的真正参数化查询
        const stmt = db.prepare('SELECT COUNT(*) as count FROM episodic_memory WHERE id = ?');
        stmt.bind([memory.id]);
        
        let exists = false;
        if (stmt.step()) {
          const result = stmt.getAsObject();
          exists = (result.count as number) > 0;
        }
        stmt.free();
        
        if (exists) {
          console.log('[ImportMemoryCommand] Memory with same ID exists:', memory.id);
          return true;
        }
      }

      // 其次通过摘要和时间范围搜索相似记忆
      const similarMemories = await this.episodicMemory.search(memory.summary, { limit: 5 });
      
      // 如果找到完全匹配的摘要和任务类型，且时间戳相近（±1秒），认为已存在
      const isDuplicate = similarMemories.some((m: any) => 
        m.summary === memory.summary && 
        m.taskType === memory.taskType &&
        Math.abs(m.timestamp - memory.timestamp) < 2000  // 2秒内视为同一条
      );
      
      if (isDuplicate) {
        console.log('[ImportMemoryCommand] Duplicate memory found by summary+taskType');
      }
      
      return isDuplicate;
    } catch (error) {
      console.warn('[ImportMemoryCommand] checkMemoryExists failed:', error);
      // 搜索失败时，保守处理：不跳过
      return false;
    }
  }

  /**
   * 显示导入错误详情
   */
  private async showImportErrors(errors: Array<{ index: number; error: string }>): Promise<void> {
    const errorMessages = errors.map(e => 
      `第 ${e.index + 1} 条: ${e.error}`
    ).join('\n');

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
