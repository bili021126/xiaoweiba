/**
 * DatabaseManager 单元测试 - 补充迁移与异常分支覆盖
 */

import 'reflect-metadata';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import initSqlJs from 'sql.js';
import { container } from 'tsyringe';
import { ConfigManager } from '../../../src/storage/ConfigManager';

jest.mock('sql.js', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('../../../src/storage/ConfigManager', () => {
  return {
    ConfigManager: jest.fn().mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue({ database: { path: '/test/path/memory.db' } })
    }))
  };
});

describe('DatabaseManager Branch Coverage', () => {
  let dbManager: DatabaseManager;
  let mockDb: any;

  beforeEach(async () => {
    container.clearInstances();
    
    mockDb = {
      run: jest.fn(),
      exec: jest.fn(),
      export: jest.fn().mockReturnValue(new Uint8Array()),
      close: jest.fn()
    };
    
    (initSqlJs as jest.Mock).mockResolvedValue({
      Database: jest.fn(() => mockDb)
    });

    const mockContext = { globalStorageUri: { fsPath: '/test/storage' } };
    container.registerInstance('extensionContext', mockContext);
    
    dbManager = container.resolve(DatabaseManager);
    await dbManager.initialize();
  });

  it('should handle migration failure gracefully', async () => {
    mockDb.run.mockImplementationOnce(() => { throw new Error('Migration error'); });
    
    // 应该捕获错误并抛出，而不是让进程崩溃
    await expect((dbManager as any).runMigrations()).rejects.toThrow();
  });

  it('should handle database export failure', () => {
    mockDb.export.mockImplementationOnce(() => { throw new Error('Export failed'); });
    
    expect(() => (dbManager as any).export()).toThrow();
  });

  it('should handle query execution with parameters', () => {
    const result = [{ id: 1, name: 'test' }];
    mockDb.exec.mockReturnValue([{ columns: ['id', 'name'], values: [[1, 'test']] }]);
    
    const rows = dbManager.query('SELECT * FROM test WHERE id = ?', [1]);
    expect(rows).toEqual(result);
  });
});
