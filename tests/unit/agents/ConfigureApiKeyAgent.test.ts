import 'reflect-metadata';
import { ConfigureApiKeyAgent } from '../../../src/agents/ConfigureApiKeyAgent';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    showInputBox: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}));

// Mock ConfigManager
const mockConfigManager = {
  setApiKey: jest.fn()
} as any;

describe('ConfigureApiKeyAgent', () => {
  let agent: ConfigureApiKeyAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new ConfigureApiKeyAgent(mockConfigManager);
  });

  describe('properties', () => {
    it('should have correct id', () => {
      expect(agent.id).toBe('configure-api-key-agent');
    });

    it('should have correct name', () => {
      expect(agent.name).toBe('API密钥配置助手');
    });

    it('should support configure_api_key intent', () => {
      expect(agent.supportedIntents).toContain('configure_api_key');
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities', () => {
      const capabilities = agent.getCapabilities();
      
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBe(1);
      expect(capabilities[0].name).toBe('configure_api_key');
      expect(capabilities[0].priority).toBe(5);
    });
  });

  describe('isAvailable', () => {
    it('should always be available', async () => {
      const available = await agent.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('execute', () => {
    it('should handle user cancellation', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(null);

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User cancelled');
    });

    it('should accept valid API key with sk- prefix', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('sk-test123456');

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(mockConfigManager.setApiKey).toHaveBeenCalledWith('deepseek', 'sk-test123456');
      expect((result.data as any).keyPrefix).toBe('sk-test1...');
    });

    it('should accept valid API key with ghp_ prefix', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('ghp_token123');

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(mockConfigManager.setApiKey).toHaveBeenCalledWith('deepseek', 'ghp_token123');
    });

    it('should warn about invalid format but continue if confirmed', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('invalid_key');
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('继续');

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(true);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should cancel if user rejects invalid format warning', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('invalid_key');
      (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('取消');

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should handle errors gracefully', async () => {
      (vscode.window.showInputBox as jest.Mock).mockRejectedValue(new Error('Test error'));

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should include duration in result', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('sk-valid123');

      const result = await agent.execute({
        intent: { name: 'configure_api_key' as any, userInput: '', metadata: { timestamp: Date.now(), source: 'chat' as const } },
        memoryContext: {} as any
      });

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('dispose', () => {
    it('should dispose without error', async () => {
      await expect(agent.dispose()).resolves.not.toThrow();
    });
  });
});
