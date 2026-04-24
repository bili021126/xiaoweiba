/**
 * 记忆导入Agent - ImportMemoryCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收import_memory意图
 * 2. 从JSON文件导入情景记忆
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { TaskTokenManager } from '../core/security/TaskTokenManager'; // ✅ 修复 #28：引入 TaskTokenManager

@injectable()
export class ImportMemoryAgent implements IAgent {
  readonly id = 'import-memory-agent';
  readonly name = '记忆导入助手';
  readonly supportedIntents = ['import_memory'];

  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager // ✅ 修复 #28：注入 TaskTokenManager
  ) {}

  /**
   * 执行记忆导入
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    const { intent, memoryContext } = params; // ✅ 修复：解构 intent

    try {
      // 1. 选择导入文件
      const openUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'JSON Files': ['json']
        },
        title: '导入记忆'
      });

      if (!openUri || openUri.length === 0) {
        return { success: false, error: 'User cancelled', durationMs: Date.now() - startTime };
      }

      const filePath = openUri[0].fsPath;

      // 2. ✅ 读取并解析JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      const importData = JSON.parse(content);

      if (!importData.memories || !Array.isArray(importData.memories)) {
        throw new Error('无效的记忆文件格式：缺少memories数组');
      }

      const memories = importData.memories;

      // 3. ✅ 修复 #28：校验 TaskToken（写数据库操作）
      const taskToken = intent.metadata.taskToken;
      if (!taskToken) {
        throw new Error('缺少写操作授权令牌（TaskToken），无法导入记忆');
      }
      
      const isValid = this.taskTokenManager.validateToken(taskToken, 'write');
      if (!isValid) {
        throw new Error('写操作授权令牌无效或已过期，请重新尝试');
      }
      
      

      // 4. ✅ 通过IMemoryPort端口导入记忆
      let importedCount = 0;
      let skippedCount = 0;

      for (const mem of memories) {
        try {
          await this.memoryPort.recordMemory({
            taskType: mem.taskType,
            summary: mem.summary,
            entities: mem.entities || [],
            outcome: mem.outcome,
            modelId: mem.modelId || 'unknown',
            durationMs: mem.durationMs || 0,
            metadata: mem.metadata || {}
          });
          importedCount++;
        } catch (err) {
          // 导入失败，静默跳过
          skippedCount++;
        }
      }
      
      // ✅ 修复 #28：导入成功后撤销 Token（一次性使用）
      this.taskTokenManager.revokeToken(taskToken);
      

      vscode.window.showInformationMessage(
        `✅ 成功导入 ${importedCount} 条记忆，跳过 ${skippedCount} 条`
      );

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          importPath: filePath,
          count: memories.length,
          note: 'Feature pending IMemoryPort extension'
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`导入失败: ${errorMessage}`);
      
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
        name: 'import_memory',
        description: '从JSON文件导入情景记忆',
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
