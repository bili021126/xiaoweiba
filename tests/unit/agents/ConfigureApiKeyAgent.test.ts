/**
 * ConfigureApiKeyAgent 单元测试 - 纯逻辑测试
 */

import 'reflect-metadata';
import { ConfigureApiKeyAgent } from '../../../src/agents/ConfigureApiKeyAgent';
import { ConfigManager } from '../../../src/storage/ConfigManager';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    showInputBox: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}));

describe('ConfigureApiKeyAgent (Pure Logic)', () => {
  let agent: ConfigureApiKeyAgent;
  let mockConfigManager: any;

  beforeEach(() => {
    mockConfigManager = {
      setApiKey: jest.fn()
    } as any;
    
    agent = new ConfigureApiKeyAgent(mockConfigManager);
  });

  it('should return failure when user cancels input', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue(undefined);

    const result = await agent.execute({
      intent: { name: 'configure_api_key' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('User cancelled');
  });

  it('should call setApiKey with valid DeepSeek key', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('sk-test-key-123');

    await agent.execute({
      intent: { name: 'configure_api_key' } as any,
      memoryContext: {} as any
    });

    expect(mockConfigManager.setApiKey).toHaveBeenCalledWith('deepseek', 'sk-test-key-123');
  });

  it('should call setApiKey with valid GitHub key', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('ghp_test_token');

    await agent.execute({
      intent: { name: 'configure_api_key' } as any,
      memoryContext: {} as any
    });

    expect(mockConfigManager.setApiKey).toHaveBeenCalledWith('github', 'ghp_test_token');
  });

  it('should reject invalid key format and show warning', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('invalid-key');
    vscode.window.showWarningMessage.mockResolvedValue('取消');

    const result = await agent.execute({
      intent: { name: 'configure_api_key' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  it('should handle config save errors gracefully', async () => {
    const vscode = require('vscode');
    vscode.window.showInputBox.mockResolvedValue('sk-valid-key');
    mockConfigManager.setApiKey.mockRejectedValue(new Error('Save failed'));

    await expect(agent.execute({
      intent: { name: 'configure_api_key' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('Save failed');
  });
});
