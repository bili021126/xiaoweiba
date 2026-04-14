import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { ConfigManager } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';

/**
 * 配置API Key命令处理器
 */
export class ConfigureApiKeyCommand {
  private configManager: ConfigManager;
  private auditLogger: AuditLogger;

  constructor() {
    this.configManager = container.resolve(ConfigManager);
    this.auditLogger = container.resolve(AuditLogger);
  }

  /**
   * 执行配置API Key流程
   */
  async execute(): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. 让用户选择提供商
      const providers = this.configManager.getConfig().model.providers;
      const providerItems = providers.map(p => ({
        label: p.id,
        description: p.apiUrl,
        provider: p
      }));

      const selected = await vscode.window.showQuickPick(providerItems, {
        placeHolder: '选择要配置的LLM提供商',
        title: '配置 API Key'
      });

      if (!selected) {
        return; // 用户取消
      }

      // 2. 输入API Key
      const apiKey = await vscode.window.showInputBox({
        prompt: `请输入 ${selected.label} 的 API Key`,
        password: true, // 隐藏输入
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'API Key 不能为空';
          }
          return null;
        }
      });

      if (!apiKey) {
        return; // 用户取消
      }

      // 3. 存储到 SecretStorage
      await this.configManager.setApiKey(selected.label, apiKey.trim());

      // 4. 提示成功
      vscode.window.showInformationMessage(
        `✅ ${selected.label} 的 API Key 已配置成功`
      );

      // 5. 记录审计日志
      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('configure_api_key', 'success', durationMs, {
        parameters: {
          provider: selected.label
        }
      });

      console.log(`[ConfigureApiKeyCommand] API key configured for ${selected.label}`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      vscode.window.showErrorMessage(`配置 API Key 失败: ${errorMessage}`);
      
      await this.auditLogger.logError('configure_api_key', error as Error, durationMs);
      console.error('[ConfigureApiKeyCommand] Failed to configure API key:', error);
    }
  }
}
