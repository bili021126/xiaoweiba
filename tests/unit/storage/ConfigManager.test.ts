import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { ErrorCode, XiaoWeibaException } from '../../../src/utils/ErrorCodes';

// Mock fs and os modules
jest.mock('fs');
jest.mock('path');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockPath = path as jest.Mocked<typeof path>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockHomeDir = '/mock/home';
  const mockConfigPath = '/mock/home/.xiaoweiba/config.yaml';
  const mockBackupPath = '/mock/home/.xiaoweiba/config.yaml.bak';
  let mockSecretStorage: jest.Mocked<vscode.SecretStorage>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    (mockOs.homedir as jest.Mock).mockReturnValue(mockHomeDir);
    (mockPath.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Mock SecretStorage
    mockSecretStorage = {
      get: jest.fn(),
      store: jest.fn(),
      delete: jest.fn(),
      onDidChange: jest.fn()
    } as any;

    // Reset ConfigManager instance with SecretStorage
    configManager = new ConfigManager(mockSecretStorage);
  });

  describe('loadConfig', () => {
    it('should create default config if not exists', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');

      const config = await configManager.loadConfig();

      expect(config.mode).toBe('private');
      expect(config.model.default).toBe('deepseek');
      expect(config.security.trustLevel).toBe('moderate');
      expect(config.memory.retentionDays).toBe(90);
    });

    it('should load existing config', async () => {
      const mockConfig = `
mode: general
model:
  default: ollama
security:
  trustLevel: strict
memory:
  retentionDays: 30
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      const config = await configManager.loadConfig();

      expect(config.mode).toBe('general');
      expect(config.model.default).toBe('ollama');
      expect(config.security.trustLevel).toBe('strict');
      expect(config.memory.retentionDays).toBe(30);
    });

    it('should resolve environment variables', async () => {
      const mockConfig = `
model:
  providers:
    - id: deepseek
      apiUrl: \${env:DEEPSEEK_API_URL}
      apiKey: \${env:DEEPSEEK_API_KEY}
      maxTokens: 4096
      temperature: 0.6
`;
      process.env.DEEPSEEK_API_URL = 'https://custom.api.com/v1';
      process.env.DEEPSEEK_API_KEY = 'sk-test-key';

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      const config = await configManager.loadConfig();

      expect(config.model.providers[0].apiUrl).toBe('https://custom.api.com/v1');
      expect(config.model.providers[0].apiKey).toBe('sk-test-key');

      delete process.env.DEEPSEEK_API_URL;
      delete process.env.DEEPSEEK_API_KEY;
    });

    it('should throw error on invalid mode', async () => {
      const mockConfig = 'mode: invalid_mode\n';
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('should throw error on invalid trust level', async () => {
      const mockConfig = `
mode: private
security:
  trustLevel: invalid
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save config and create backup', async () => {
      const mockConfig = {
        mode: 'private' as const,
        model: {
          default: 'deepseek',
          providers: []
        },
        security: {
          trustLevel: 'moderate' as const,
          autoApproveRead: true,
          requireDiffForWrite: true,
          gitPushEnabled: false
        },
        memory: {
          retentionDays: 90,
          decayLambda: 0.01,
          coldStartTrust: 20
        },
        skill: {
          userDir: '.xiaoweiba/skills/user',
          autoDir: '.xiaoweiba/skills/auto',
          maxWorkflowDepth: 5,
          trialPeriod: 5
        },
        audit: {
          level: 'info' as const,
          maxFileSizeMB: 20,
          maxFiles: 10
        },
        bestPractice: {
          sources: ['builtin'],
          builtinOnly: true
        }
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      // First load config
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      await configManager.loadConfig();

      // Then save
      await configManager.saveConfig(mockConfig);

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(mockConfigPath, mockBackupPath);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('rollbackConfig', () => {
    it('should rollback to backup config', async () => {
      const mockBackupContent = 'mode: private\n';
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockBackupContent);

      await configManager.rollbackConfig();

      expect(mockFs.copyFileSync).toHaveBeenCalledWith(mockBackupPath, mockConfigPath);
    });

    it('should create default config if no backup exists', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);
      (mockFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      await configManager.rollbackConfig();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return default config even before loadConfig', () => {
      // ConfigManager now initializes with default config in constructor
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.mode).toBe('private');
      expect(config.model.default).toBe('deepseek');
    });

    it('should return loaded config', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');

      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config.mode).toBe('private');
    });
  });

  describe('dispose', () => {
    it('should close file watcher', async () => {
      const mockWatcher = { close: jest.fn() };
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.watch as jest.Mock).mockReturnValue(mockWatcher);

      await configManager.loadConfig();
      configManager.dispose();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('SecretStorage集成', () => {
    it('应优先从SecretStorage获取API Key', async () => {
      (mockSecretStorage.get as jest.Mock).mockResolvedValue('secret-api-key');
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\nmodel:\n  providers:\n    - id: deepseek\n      apiUrl: https://api.deepseek.com/v1\n      maxTokens: 4096\n      temperature: 0.6\n');

      await configManager.loadConfig();
      const apiKey = await configManager.getApiKey('deepseek');

      expect(apiKey).toBe('secret-api-key');
      expect(mockSecretStorage.get).toHaveBeenCalledWith('deepseek_api_key');
    });

    it('应从配置文件降级获取API Key', async () => {
      (mockSecretStorage.get as jest.Mock).mockResolvedValue(undefined);
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        'mode: private\nmodel:\n  providers:\n    - id: deepseek\n      apiUrl: https://api.deepseek.com/v1\n      apiKey: config-api-key\n      maxTokens: 4096\n      temperature: 0.6\n'
      );

      await configManager.loadConfig();
      const apiKey = await configManager.getApiKey('deepseek');

      expect(apiKey).toBe('config-api-key');
    });

    it('应将API Key存储到SecretStorage', async () => {
      // Mock showInformationMessage to return a thenable
      (vscode.window.showInformationMessage as jest.Mock).mockReturnValue({
        then: jest.fn().mockResolvedValue(undefined)
      });

      await configManager.setApiKey('deepseek', 'new-api-key');

      expect(mockSecretStorage.store).toHaveBeenCalledWith('deepseek_api_key', 'new-api-key');
    });
  });

  describe('环境变量解析增强', () => {
    it('应处理不存在的环境变量（保留原值）', async () => {
      const mockConfig = `
model:
  providers:
    - id: deepseek
      apiUrl: \${env:NONEXISTENT_VAR}
      maxTokens: 4096
      temperature: 0.6
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await configManager.loadConfig();
      const config = configManager.getConfig();

      // Should keep the original placeholder if env var doesn't exist
      expect(config.model.providers[0].apiUrl).toBe('${env:NONEXISTENT_VAR}');
    });
  });

  describe('配置验证边界条件', () => {
    it('应拒绝无效的retentionDays（小于1）', async () => {
      const mockConfig = `
mode: private
memory:
  retentionDays: 0
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('应拒绝无效的retentionDays（大于365）', async () => {
      const mockConfig = `
mode: private
memory:
  retentionDays: 400
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('应拒绝无效的decayLambda（等于0）', async () => {
      const mockConfig = `
mode: private
memory:
  decayLambda: 0
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('应拒绝无效的decayLambda（大于1）', async () => {
      const mockConfig = `
mode: private
memory:
  decayLambda: 1.5
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('应拒绝无效的maxWorkflowDepth（小于1）', async () => {
      const mockConfig = `
mode: private
skill:
  maxWorkflowDepth: 0
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('应拒绝无效的maxWorkflowDepth（大于10）', async () => {
      const mockConfig = `
mode: private
skill:
  maxWorkflowDepth: 15
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await expect(configManager.loadConfig()).rejects.toThrow();
    });
  });

  describe('saveConfig错误处理', () => {
    it('应在保存失败时回滚并抛出错误', async () => {
      const mockConfig = {
        mode: 'private' as const,
        model: { default: 'deepseek', providers: [] },
        security: { trustLevel: 'moderate' as const, autoApproveRead: true, requireDiffForWrite: true, gitPushEnabled: false },
        memory: { retentionDays: 90, decayLambda: 0.01, coldStartTrust: 20 },
        skill: { userDir: '.xiaoweiba/skills/user', autoDir: '.xiaoweiba/skills/auto', maxWorkflowDepth: 5, trialPeriod: 5 },
        audit: { level: 'info' as const, maxFileSizeMB: 20, maxFiles: 10 },
        bestPractice: { sources: ['builtin'], builtinOnly: true }
      };

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => { throw new Error('Disk full'); });
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');

      await configManager.loadConfig();
      await expect(configManager.saveConfig(mockConfig)).rejects.toThrow();
    });

    it('应在回滚失败时抛出错误', async () => {
      // Simulate a scenario where rollback itself fails
      (mockFs.existsSync as jest.Mock).mockReturnValueOnce(false); // No backup exists
      (mockFs.mkdirSync as jest.Mock).mockImplementation(() => { throw new Error('Permission denied'); });

      await expect(configManager.rollbackConfig()).rejects.toThrow();
    });
  });

  describe('getConfigHistory', () => {
    it('应返回最近3份配置历史', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});

      await configManager.loadConfig();

      // Manually add some history entries by calling save multiple times
      const mockConfig = {
        mode: 'private' as const,
        model: { default: 'deepseek', providers: [] },
        security: { trustLevel: 'moderate' as const, autoApproveRead: true, requireDiffForWrite: true, gitPushEnabled: false },
        memory: { retentionDays: 90, decayLambda: 0.01, coldStartTrust: 20 },
        skill: { userDir: '.xiaoweiba/skills/user', autoDir: '.xiaoweiba/skills/auto', maxWorkflowDepth: 5, trialPeriod: 5 },
        audit: { level: 'info' as const, maxFileSizeMB: 20, maxFiles: 10 },
        bestPractice: { sources: ['builtin'], builtinOnly: true }
      };

      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig); // 4th save should trigger cleanup

      const history = configManager.getConfigHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe('setupWatcher热加载', () => {
    it('应在文件变化时重新加载配置', async () => {
      const mockWatcher = { 
        close: jest.fn(),
        on: jest.fn()
      };
      
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.watch as jest.Mock).mockReturnValue(mockWatcher);

      await configManager.loadConfig();

      // Simulate file change event
      const watchCallback = (mockFs.watch as jest.Mock).mock.calls[0][1];
      watchCallback('change');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('应在watch不支持时静默失败', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.watch as jest.Mock).mockImplementation(() => { throw new Error('Watch not supported'); });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await configManager.loadConfig();

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('应在已有watcher时关闭旧的watcher', async () => {
      const mockWatcher1 = { close: jest.fn() };
      const mockWatcher2 = { close: jest.fn() };
      
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.watch as jest.Mock)
        .mockReturnValueOnce(mockWatcher1)
        .mockReturnValueOnce(mockWatcher2);

      await configManager.loadConfig();
      await configManager.loadConfig(); // Second load should close first watcher

      expect(mockWatcher1.close).toHaveBeenCalled();
    });
  });

  describe('addToHistory清理旧备份', () => {
    it('应在超过3份备份时删除最旧的', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      await configManager.loadConfig();

      const mockConfig = {
        mode: 'private' as const,
        model: { default: 'deepseek', providers: [] },
        security: { trustLevel: 'moderate' as const, autoApproveRead: true, requireDiffForWrite: true, gitPushEnabled: false },
        memory: { retentionDays: 90, decayLambda: 0.01, coldStartTrust: 20 },
        skill: { userDir: '.xiaoweiba/skills/user', autoDir: '.xiaoweiba/skills/auto', maxWorkflowDepth: 5, trialPeriod: 5 },
        audit: { level: 'info' as const, maxFileSizeMB: 20, maxFiles: 10 },
        bestPractice: { sources: ['builtin'], builtinOnly: true }
      };

      // Save 4 times to trigger cleanup
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);

      // unlinkSync should be called to remove old backups
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('应在删除不存在的备份时静默失败', async () => {
      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(true) // config exists
        .mockReturnValueOnce(false); // old backup doesn't exist
      
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.copyFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      await configManager.loadConfig();

      const mockConfig = {
        mode: 'private' as const,
        model: { default: 'deepseek', providers: [] },
        security: { trustLevel: 'moderate' as const, autoApproveRead: true, requireDiffForWrite: true, gitPushEnabled: false },
        memory: { retentionDays: 90, decayLambda: 0.01, coldStartTrust: 20 },
        skill: { userDir: '.xiaoweiba/skills/user', autoDir: '.xiaoweiba/skills/auto', maxWorkflowDepth: 5, trialPeriod: 5 },
        audit: { level: 'info' as const, maxFileSizeMB: 20, maxFiles: 10 },
        bestPractice: { sources: ['builtin'], builtinOnly: true }
      };

      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);
      await configManager.saveConfig(mockConfig);

      // Should not throw even if backup doesn't exist
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('getApiKey边界条件', () => {
    it('应返回undefined当SecretStorage和配置文件都没有API Key时', async () => {
      (mockSecretStorage.get as jest.Mock).mockResolvedValue(undefined);
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        'mode: private\nmodel:\n  providers:\n    - id: deepseek\n      apiUrl: https://api.deepseek.com/v1\n      maxTokens: 4096\n      temperature: 0.6\n'
      );

      await configManager.loadConfig();
      const apiKey = await configManager.getApiKey('deepseek');

      expect(apiKey).toBeUndefined();
    });

    it('应返回undefined当provider不存在时', async () => {
      (mockSecretStorage.get as jest.Mock).mockResolvedValue(undefined);
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        'mode: private\nmodel:\n  providers:\n    - id: deepseek\n      apiUrl: https://api.deepseek.com/v1\n      maxTokens: 4096\n      temperature: 0.6\n'
      );

      await configManager.loadConfig();
      const apiKey = await configManager.getApiKey('nonexistent');

      expect(apiKey).toBeUndefined();
    });

    it('应该从环境变量获取API Key', async () => {
      (mockSecretStorage.get as jest.Mock).mockResolvedValue(undefined);
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(
        'mode: private\nmodel:\n  providers:\n    - id: deepseek\n      apiUrl: https://api.deepseek.com/v1\n'
      );

      // 设置环境变量
      process.env.DEEPSEEK_API_KEY = 'env-api-key-123';

      await configManager.loadConfig();
      const apiKey = await configManager.getApiKey('deepseek');

      expect(apiKey).toBe('env-api-key-123');

      // 清理
      delete process.env.DEEPSEEK_API_KEY;
    });
  });

  describe('resolveEnvVariables数组和嵌套对象', () => {
    it('应解析数组中的环境变量', async () => {
      process.env.API_URL_1 = 'https://api1.com/v1';
      process.env.API_URL_2 = 'https://api2.com/v1';
      
      const mockConfig = `
model:
  providers:
    - id: provider1
      apiUrl: \${env:API_URL_1}
      maxTokens: 4096
      temperature: 0.6
    - id: provider2
      apiUrl: \${env:API_URL_2}
      maxTokens: 2048
      temperature: 0.7
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config.model.providers[0].apiUrl).toBe('https://api1.com/v1');
      expect(config.model.providers[1].apiUrl).toBe('https://api2.com/v1');

      delete process.env.API_URL_1;
      delete process.env.API_URL_2;
    });

    it('应解析嵌套对象中的环境变量', async () => {
      process.env.SKILL_USER_DIR = '/custom/skills/user';
      process.env.SKILL_AUTO_DIR = '/custom/skills/auto';
      
      const mockConfig = `
skill:
  userDir: \${env:SKILL_USER_DIR}
  autoDir: \${env:SKILL_AUTO_DIR}
  maxWorkflowDepth: 5
  trialPeriod: 5
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config.skill.userDir).toBe('/custom/skills/user');
      expect(config.skill.autoDir).toBe('/custom/skills/auto');

      delete process.env.SKILL_USER_DIR;
      delete process.env.SKILL_AUTO_DIR;
    });
  });

  describe('setupWatcher错误处理', () => {
    it('应在热加载失败时记录错误', async () => {
      const mockWatcher = { close: jest.fn() };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce('mode: private\n')
        .mockReturnValueOnce('mode: invalid_mode\n');
      (mockFs.watch as jest.Mock).mockReturnValue(mockWatcher);

      await configManager.loadConfig();

      const watchCallback = (mockFs.watch as jest.Mock).mock.calls[0][1];
      watchCallback('change');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('addToHistory错误处理', () => {
    it('应在copyFileSync失败时记录警告', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mode: private\n');
      (mockFs.copyFileSync as jest.Mock)
        .mockImplementationOnce(() => {}) // backup copy succeeds
        .mockImplementation(() => { throw new Error('Permission denied'); }); // history copy fails
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      await configManager.loadConfig();

      const mockConfig = {
        mode: 'private' as const,
        model: { default: 'deepseek', providers: [] },
        security: { trustLevel: 'moderate' as const, autoApproveRead: true, requireDiffForWrite: true, gitPushEnabled: false },
        memory: { retentionDays: 90, decayLambda: 0.01, coldStartTrust: 20 },
        skill: { userDir: '.xiaoweiba/skills/user', autoDir: '.xiaoweiba/skills/auto', maxWorkflowDepth: 5, trialPeriod: 5 },
        audit: { level: 'info' as const, maxFileSizeMB: 20, maxFiles: 10 },
        bestPractice: { sources: ['builtin'], builtinOnly: true }
      };

      await configManager.saveConfig(mockConfig);

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('mergeWithDefaults完整合并', () => {
    it('应正确合并所有配置字段', async () => {
      const mockConfig = `
mode: general
model:
  default: ollama
security:
  trustLevel: strict
  autoApproveRead: false
memory:
  retentionDays: 60
  decayLambda: 0.05
skill:
  maxWorkflowDepth: 3
audit:
  level: debug
bestPractice:
  sources: ['builtin', 'external']
  builtinOnly: false
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config.mode).toBe('general');
      expect(config.model.default).toBe('ollama');
      expect(config.security.trustLevel).toBe('strict');
      expect(config.security.autoApproveRead).toBe(false);
      expect(config.memory.retentionDays).toBe(60);
      expect(config.memory.decayLambda).toBe(0.05);
      expect(config.skill.maxWorkflowDepth).toBe(3);
      expect(config.audit.level).toBe('debug');
      expect(config.bestPractice.sources).toEqual(['builtin', 'external']);
      expect(config.bestPractice.builtinOnly).toBe(false);
    });

    it('应保留未指定字段的默认值', async () => {
      const mockConfig = `
mode: private
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      await configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config.security.trustLevel).toBe('moderate');
      expect(config.memory.retentionDays).toBe(90);
      expect(config.skill.maxWorkflowDepth).toBe(5);
      expect(config.audit.level).toBe('info');
    });
  });

  describe('validateConfig边界值', () => {
    it('应接受有效的retentionDays边界值（1和365）', async () => {
      const mockConfig1 = `
mode: private
memory:
  retentionDays: 1
`;
      const mockConfig2 = `
mode: private
memory:
  retentionDays: 365
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce(mockConfig1)
        .mockReturnValueOnce(mockConfig2);

      await configManager.loadConfig();
      let config = configManager.getConfig();
      expect(config.memory.retentionDays).toBe(1);

      await configManager.loadConfig();
      config = configManager.getConfig();
      expect(config.memory.retentionDays).toBe(365);
    });

    it('应接受有效的decayLambda边界值（接近0和1）', async () => {
      const mockConfig1 = `
mode: private
memory:
  decayLambda: 0.001
`;
      const mockConfig2 = `
mode: private
memory:
  decayLambda: 1
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce(mockConfig1)
        .mockReturnValueOnce(mockConfig2);

      await configManager.loadConfig();
      let config = configManager.getConfig();
      expect(config.memory.decayLambda).toBe(0.001);

      await configManager.loadConfig();
      config = configManager.getConfig();
      expect(config.memory.decayLambda).toBe(1);
    });

    it('应接受有效的maxWorkflowDepth边界值（1和10）', async () => {
      const mockConfig1 = `
mode: private
skill:
  maxWorkflowDepth: 1
`;
      const mockConfig2 = `
mode: private
skill:
  maxWorkflowDepth: 10
`;
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce(mockConfig1)
        .mockReturnValueOnce(mockConfig2);

      await configManager.loadConfig();
      let config = configManager.getConfig();
      expect(config.skill.maxWorkflowDepth).toBe(1);

      await configManager.loadConfig();
      config = configManager.getConfig();
      expect(config.skill.maxWorkflowDepth).toBe(10);
    });
  });

  describe('loadConfig错误详情', () => {
    it('应在错误对象包含message时显示详细信息', async () => {
      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(true) // config exists
        .mockReturnValueOnce(false); // backup doesn't exist
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Custom parse error');
      });
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);

      await expect(configManager.loadConfig()).rejects.toThrow('Custom parse error');
    });

    it('应在错误不是Error实例时转换为字符串', async () => {
      (mockFs.existsSync as jest.Mock)
        .mockReturnValueOnce(true) // config exists
        .mockReturnValueOnce(false); // backup doesn't exist
      (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
        throw 'String error';
      });
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (mockFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);

      await expect(configManager.loadConfig()).rejects.toThrow('String error');
    });
  });
});
