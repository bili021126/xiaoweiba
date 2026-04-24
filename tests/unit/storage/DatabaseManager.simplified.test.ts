/**
 * DatabaseManager 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { ConfigManager } from '../../../src/storage/ConfigManager';

jest.mock('fs');
jest.mock('path');
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/mock/home')
}));

describe('DatabaseManager Simplified', () => {
  let dbManager: DatabaseManager;
  const mockSecretStorage = { get: jest.fn(), store: jest.fn() };

  beforeEach(() => {
    container.clearInstances();
    
    const mockConfigManager = new ConfigManager(mockSecretStorage as any);
    container.registerInstance(ConfigManager, mockConfigManager);
    
    dbManager = container.resolve(DatabaseManager);
  });

  it('should initialize without errors', async () => {
    await expect(dbManager.initialize()).resolves.toBeUndefined();
  });

  it('should handle query execution', async () => {
    await dbManager.initialize();
    
    // 执行一个简单的查询
    const result = (dbManager as any).runQuery('SELECT 1 as test');
    expect(result).toBeDefined();
  });
});
