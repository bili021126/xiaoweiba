/**
 * ConfigManager 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ConfigManager } from '../../../src/storage/ConfigManager';

jest.mock('fs');
jest.mock('path');
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/mock/home')
}));

describe('ConfigManager Simplified', () => {
  let configManager: ConfigManager;
  const mockSecretStorage = { get: jest.fn(), store: jest.fn() };

  beforeEach(() => {
    container.clearInstances();
    container.registerInstance('SecretStorage', mockSecretStorage);
    configManager = container.resolve(ConfigManager);
  });

  it('should initialize with default config', () => {
    const config = configManager.getConfig();
    expect(config).toBeDefined();
    expect(config.model.default).toBe('deepseek');
  });
});
