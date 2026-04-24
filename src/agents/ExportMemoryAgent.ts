/**
 * 记忆导出Agent - ExportMemoryCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收export_memory意图
 * 2. 导出情景记忆到JSON文件
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { TaskTokenManager } from '../core/security/TaskTokenManager'; // ✅ 修复 #28：引入 TaskTokenManager

@injectable()
export class ExportMemoryAgent implements IAgent {
  readonly id = 'export-memory-agent';
  readonly name = '记忆导出助手';
  readonly supportedIntents = ['export_memory'];

  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager // ✅ 修复 #28：注入 TaskTokenManager
  ) {}

  /**
   * 执行记忆导出
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent, memoryContext } = params; // ✅ 修复：解构 intent

    try {
      // 1. 选择导出路径
      const defaultPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(defaultPath, 'memories.json')),
        filters: {
          'JSON Files': ['json']
        },
        title: '导出记忆'
      });

      if (!saveUri) {
        return { success: false, error: 'User cancelled', durationMs: Date.now() - startTime };
      }

      // 2. ✅ 通过IMemoryPort端口获取所有情景记忆
      const allMemories = await this.memoryPort.retrieveAll({ limit: 1000 });
      
      // 3. 转换为可导出的格式
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalCount: allMemories.length,
        memories: allMemories.map(m => ({
          id: m.id,
          projectFingerprint: m.projectFingerprint,
          timestamp: m.timestamp,
          taskType: m.taskType,
          summary: m.summary,
          entities: m.entities,
          outcome: m.outcome,
          modelId: m.modelId,
          durationMs: m.durationMs,
          metadata: m.metadata
        }))
      };

      // 4. ✅ 修复 #28：校验 TaskToken（写文件操作）
      const taskToken = intent.metadata.taskToken;
      if (!taskToken) {
        throw new Error('缺少写操作授权令牌（TaskToken），无法导出记忆');
      }
      
      const isValid = this.taskTokenManager.validateToken(taskToken, 'write');
      if (!isValid) {
        throw new Error('写操作授权令牌无效或已过期，请重新尝试');
      }
      
      

      // 5. 写入文件
      const jsonContent = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(saveUri.fsPath, jsonContent, 'utf-8');
      
      // ✅ 修复 #28：导出成功后撤销 Token（一次性使用）
      this.taskTokenManager.revokeToken(taskToken);
      

      vscode.window.showInformationMessage(
        `✅ 成功导出 ${allMemories.length} 条记忆到 ${saveUri.fsPath}`
      );

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          exportPath: saveUri.fsPath,
          note: 'Feature pending IMemoryPort extension'
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`导出失败: ${errorMessage}`);
      
      return { success: false, error: errorMessage, durationMs };
    }
  }

  /**
   * 检查Agent是否可用
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * 获取Agent能力
   */
  getCapabilities() {
    return [
      {
        name: 'export_memory',
        description: '导出情景记忆到JSON文件',
        priority: 3
      }
    ];
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // Agent已清理
  }
}
