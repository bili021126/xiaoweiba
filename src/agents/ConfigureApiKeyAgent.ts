/**
 * API密钥配置Agent - ConfigureApiKeyCommand的Agent化版本
 * 
 * 职责：
 * 1. 接收configure_api_key意图
 * 2. 引导用户配置API密钥
 * 3. 保存到配置文件
 */

import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';
import { ConfigManager } from '../storage/ConfigManager';

@injectable()
export class ConfigureApiKeyAgent implements IAgent {
  readonly id = 'configure-api-key-agent';
  readonly name = 'API密钥配置助手';
  readonly supportedIntents = ['configure_api_key'];

  constructor(
    @inject(ConfigManager) private configManager: ConfigManager
  ) {}

  /**
   * 执行API密钥配置
   */
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. 提示用户输入API密钥
      const apiKey = await vscode.window.showInputBox({
        prompt: '请输入您的API密钥',
        password: true,
        placeHolder: 'sk-...',
        ignoreFocusOut: true
      });

      if (!apiKey) {
        return { success: false, error: 'User cancelled', durationMs: Date.now() - startTime };
      }

      // 2. 验证API密钥格式（简单验证）
      if (!apiKey.startsWith('sk-') && !apiKey.startsWith('ghp_')) {
        const confirmed = await vscode.window.showWarningMessage(
          'API密钥格式可能不正确，是否继续？',
          '继续',
          '取消'
        );
        
        if (confirmed !== '继续') {
          return { success: false, error: 'Invalid API key format', durationMs: Date.now() - startTime };
        }
      }

      // 3. 保存到 SecretStorage（通过 ConfigManager）
      await this.configManager.setApiKey('deepseek', apiKey);

      const durationMs = Date.now() - startTime;

      return { 
        success: true, 
        durationMs,
        data: {
          configured: true,
          keyPrefix: apiKey.substring(0, 8) + '...'
        }
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`配置失败: ${errorMessage}`);
      
      return { success: false, error: errorMessage, durationMs };
    }
  }

  /**
   * 检查Agent是否可用（始终可用）
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
        name: 'configure_api_key',
        description: '配置LLM API密钥',
        priority: 5
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
