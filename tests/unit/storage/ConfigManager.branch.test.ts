/**
 * ConfigManager 单元测试 - 补充异常分支覆盖
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('ConfigManager Branch Coverage', () => {
  let configManager: ConfigManager;
  const mockSecretStorage = { get: jest.fn(), store: jest.fn() };

  beforeEach(() => {
    container.clearInstances();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    
    container.registerInstance('SecretStorage', mockSecretStorage);
    configManager = container.resolve(ConfigManager);
  });

  it('should handle missing config file gracefully', () => {
    const config = configManager.getConfig();
    expect(config).toBeDefined();
    expect(config.model.default).toBe('deepseek');
  });

  it('should handle invalid JSON in config file', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('{ invalid json');
    
    // 应该回退到默认配置而不抛出异常
    const config = configManager.getConfig();
    expect(config).toBeDefined();
  });

  it('should merge user config with defaults', () => {
    const userConfig = { model: { default: 'ollama' } };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(userConfig));
    
    // 重新实例化以触发加载逻辑
    const newManager = container.resolve(ConfigManager);
    const config = newManager.getConfig();
    expect(config.model.default).toBe('ollama');
    // 确保其他默认值依然存在
    expect(config.model.providers).toBeDefined();
  });
});
