/**
 * 文件操作工具类
 * 
 * 提供统一的文件读写删操作，内置Diff确认机制
 * 为未来的Agent协作和技能系统奠定基础
 */

import * as vscode from 'vscode';
import { DiffService } from './DiffService';
import { AuditLogger } from '../core/security/AuditLogger';
import { container } from 'tsyringe';

export class FileTool {
  private diffService: DiffService;
  private auditLogger: AuditLogger;

  constructor() {
    this.diffService = new DiffService();
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 读取文件内容
   * @param uri 文件URI
   * @returns 文件内容字符串
   */
  async readFile(uri: vscode.Uri): Promise<string> {
    const startTime = Date.now();
    
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(data).toString('utf-8');
      
      // 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('file_read', 'success', durationMs, {
        parameters: { path: uri.fsPath, size: content.length }
      });
      
      return content;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await this.auditLogger.logError('file_read', error as Error, durationMs);
      throw new Error(`读取文件失败: ${uri.fsPath} - ${error}`);
    }
  }

  /**
   * 写入文件内容（带Diff确认）
   * @param uri 文件URI
   * @param content 要写入的内容
   * @param force 是否强制写入（跳过Diff确认）
   */
  async writeFile(uri: vscode.Uri, content: string, force: boolean = false): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 如果文件已存在且非强制写入，进行Diff确认
      if (!force && await this.fileExists(uri)) {
        const original = await this.readFile(uri);
        
        // 如果内容相同，直接返回
        if (original === content) {
          return;
        }
        
        const confirmed = await this.diffService.confirmChangeWithWebview(
          original,
          content,
          uri.fsPath
        );
        
        if (!confirmed) {
          const durationMs = Date.now() - startTime;
          await this.auditLogger.log('file_write', 'success', durationMs, {
            parameters: { path: uri.fsPath, reason: 'user_cancelled', status: 'cancelled' }
          });
          throw new Error('用户取消了写入操作');
        }
      }

      // 执行写入
      const data = Buffer.from(content, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, data);
      
      // 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('file_write', 'success', durationMs, {
        parameters: { path: uri.fsPath, size: content.length }
      });
      
      // 文件写入成功，审计日志已在调用方记录
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await this.auditLogger.logError('file_write', error as Error, durationMs);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param uri 文件URI
   * @param requireConfirm 是否需要确认（默认true）
   */
  async deleteFile(uri: vscode.Uri, requireConfirm: boolean = true): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 删除前确认
      if (requireConfirm) {
        const fileName = uri.fsPath.split(/[\\/]/).pop() || uri.fsPath;
        const choice = await vscode.window.showWarningMessage(
          `确定要删除文件 "${fileName}" 吗？此操作不可恢复。`,
          { modal: true },
          '删除',
          '取消'
        );
        
        if (choice !== '删除') {
          const durationMs = Date.now() - startTime;
          await this.auditLogger.log('file_delete', 'success', durationMs, {
            parameters: { path: uri.fsPath, reason: 'user_cancelled', status: 'cancelled' }
          });
          throw new Error('用户取消了删除操作');
        }
      }

      // 执行删除
      await vscode.workspace.fs.delete(uri);
      
      // 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('file_delete', 'success', durationMs, {
        parameters: { path: uri.fsPath }
      });
      
      console.log(`[FileTool] File deleted successfully: ${uri.fsPath}`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await this.auditLogger.logError('file_delete', error as Error, durationMs);
      throw new Error(`删除文件失败: ${uri.fsPath} - ${error}`);
    }
  }

  /**
   * 检查文件是否存在
   * @param uri 文件URI
   * @returns 是否存在
   */
  async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件的Uri
   * @param filePath 文件路径
   * @returns Uri对象
   */
  getFileUri(filePath: string): vscode.Uri {
    return vscode.Uri.file(filePath);
  }

  /**
   * 在编辑器中插入代码（特殊场景：不覆盖整个文件）
   * @param editor 编辑器实例
   * @param code 要插入的代码
   * @param position 插入位置（默认为光标位置）
   */
  async insertCodeAtPosition(
    editor: vscode.TextEditor,
    code: string,
    position?: vscode.Position
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const insertPos = position || editor.selection.active;
      
      // 对于插入操作，使用Diff确认
      const document = editor.document;
      const startLine = Math.max(0, insertPos.line - 2);
      const endLine = Math.min(document.lineCount - 1, insertPos.line + 2);
      const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
      const originalContext = document.getText(range);
      
      const confirmed = await this.diffService.confirmChangeWithWebview(
        originalContext,
        code,
        document.fileName
      );
      
      if (!confirmed) {
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('code_insert', 'success', durationMs, {
          parameters: { path: document.fileName, reason: 'user_cancelled', status: 'cancelled' }
        });
        vscode.window.showInformationMessage('⚠️ 已取消代码插入');
        return;
      }
      
      // 执行插入
      const success = await editor.edit(editBuilder => {
        editBuilder.insert(insertPos, code + '\n');
      });
      
      if (success) {
        const durationMs = Date.now() - startTime;
        await this.auditLogger.log('code_insert', 'success', durationMs, {
          parameters: { path: document.fileName, size: code.length }
        });
        vscode.window.showInformationMessage('✅ 代码已插入');
      } else {
        throw new Error('编辑器插入失败');
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await this.auditLogger.logError('code_insert', error as Error, durationMs);
      throw error;
    }
  }
}
