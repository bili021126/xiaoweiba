import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';

describe('DatabaseManager - 数据库管理器', () => {
  let dbManager: DatabaseManager;
  let mockConfigManager: any;
  const testDbPath = path.join(__dirname, '../../test-database.db');

  beforeEach(async () => {
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Mock SecretStorage
    const mockSecretStorage = {
      get: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    };

    // Create a real ConfigManager instance with mock SecretStorage
    mockConfigManager = new ConfigManager(mockSecretStorage as any);
    
    // Manually set the config to avoid file system dependency
    (mockConfigManager as any).currentConfig = {
      mode: 'private',
      model: {
        default: 'deepseek',
        providers: [{
          id: 'deepseek',
          apiUrl: 'https://api.deepseek.com/v1',
          maxTokens: 4096,
          temperature: 0.6
        }]
      },
      security: {
        trustLevel: 'moderate',
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
        level: 'info',
        maxFileSizeMB: 20,
        maxFiles: 10
      },
      bestPractice: {
        sources: ['builtin'],
        builtinOnly: true
      }
    };

    dbManager = new DatabaseManager(mockConfigManager, undefined, testDbPath);
    await dbManager.initialize();
  });

  afterEach(async () => {
    await dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('runQuery - 参数化查询', () => {
    it('应该正确使用参数化查询防止SQL注入', async () => {
      // 准备测试数据
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)',
        []
      );
      
      const maliciousInput = "'; DROP TABLE test_table; --";
      
      // 使用参数化查询
      dbManager.runMutation(
        'INSERT INTO test_table (name) VALUES (?)',
        [maliciousInput]
      );

      // 验证表仍然存在且数据正确插入
      const result = dbManager.runQuery('SELECT COUNT(*) as count FROM test_table');
      expect(result[0].count).toBe(1);

      // 验证恶意输入被正确转义存储
      const rows = dbManager.runQuery('SELECT name FROM test_table WHERE name = ?', [maliciousInput]);
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe(maliciousInput);
    });

    it('应该在无参数时使用exec方法', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );
      
      dbManager.runMutation(
        "INSERT INTO test_table (value) VALUES ('test')",
        []
      );

      const result = dbManager.runQuery('SELECT * FROM test_table');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('test');
    });

    it('应该正确处理多个参数', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO users (name, age) VALUES (?, ?)',
        ['Alice', 25]
      );

      dbManager.runMutation(
        'INSERT INTO users (name, age) VALUES (?, ?)',
        ['Bob', 30]
      );

      const result = dbManager.runQuery(
        'SELECT * FROM users WHERE age > ? AND name != ?',
        [20, 'Bob']
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
      expect(result[0].age).toBe(25);
    });

    it('应该正确处理LIMIT参数化', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      for (let i = 1; i <= 10; i++) {
        dbManager.runMutation(
          'INSERT INTO items (value) VALUES (?)',
          [`item_${i}`]
        );
      }

      const result = dbManager.runQuery(
        'SELECT * FROM items LIMIT ?',
        [5]
      );

      expect(result).toHaveLength(5);
    });

    it('应该返回空数组当没有结果时', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS empty_table (id INTEGER PRIMARY KEY)',
        []
      );

      const result = dbManager.runQuery('SELECT * FROM empty_table');
      expect(result).toEqual([]);
    });
  });

  describe('runMutation - 修改操作', () => {
    it('应该正确执行INSERT操作', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, data TEXT)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO test (data) VALUES (?)',
        ['test_data']
      );

      const result = dbManager.runQuery('SELECT * FROM test');
      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('test_data');
    });

    it('应该正确执行UPDATE操作', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO test (value) VALUES (?)',
        ['old_value']
      );

      dbManager.runMutation(
        'UPDATE test SET value = ? WHERE value = ?',
        ['new_value', 'old_value']
      );

      const result = dbManager.runQuery('SELECT value FROM test');
      expect(result[0].value).toBe('new_value');
    });

    it('应该正确执行DELETE操作', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO test (value) VALUES (?)',
        ['to_delete']
      );

      dbManager.runMutation(
        'INSERT INTO test (value) VALUES (?)',
        ['to_keep']
      );

      dbManager.runMutation(
        'DELETE FROM test WHERE value = ?',
        ['to_delete']
      );

      const result = dbManager.runQuery('SELECT * FROM test');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('to_keep');
    });
  });

  describe('runQueryOne - 单行查询', () => {
    it('应该返回单个结果', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO test (value) VALUES (?)',
        ['single_row']
      );

      const result = dbManager.runQueryOne('SELECT * FROM test WHERE value = ?', ['single_row']);
      
      expect(result).toBeDefined();
      expect(result.value).toBe('single_row');
    });

    it('应该在无结果时返回null', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)',
        []
      );

      const result = dbManager.runQueryOne('SELECT * FROM test WHERE id = ?', [999]);
      
      expect(result).toBeNull();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该正确处理NULL值', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, nullable_field TEXT)',
        []
      );

      dbManager.runMutation(
        'INSERT INTO test (nullable_field) VALUES (?)',
        [null]
      );

      const result = dbManager.runQuery('SELECT * FROM test WHERE nullable_field IS NULL');
      expect(result).toHaveLength(1);
    });

    it('应该正确处理特殊字符', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, text TEXT)',
        []
      );

      const specialChars = "Hello 'World' \"Test\" ; -- \n \t";
      
      dbManager.runMutation(
        'INSERT INTO test (text) VALUES (?)',
        [specialChars]
      );

      const result = dbManager.runQuery('SELECT text FROM test');
      expect(result[0].text).toBe(specialChars);
    });

    it('应该在SQL语法错误时抛出异常', async () => {
      expect(() => {
        dbManager.runQuery('INVALID SQL SYNTAX');
      }).toThrow();
    });
  });

  describe('性能测试', () => {
    it('应该能够高效处理批量插入', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS bulk_test (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        dbManager.runMutation(
          'INSERT INTO bulk_test (value) VALUES (?)',
          [`value_${i}`]
        );
      }

      const duration = Date.now() - startTime;
      
      // 100次插入应在合理时间内完成（< 1秒）
      expect(duration).toBeLessThan(1000);

      const count = dbManager.runQuery('SELECT COUNT(*) as count FROM bulk_test');
      expect(count[0].count).toBe(100);
    });

    it('应该能够高效处理批量查询', async () => {
      dbManager.runMutation(
        'CREATE TABLE IF NOT EXISTS query_test (id INTEGER PRIMARY KEY, value TEXT)',
        []
      );

      for (let i = 0; i < 100; i++) {
        dbManager.runMutation(
          'INSERT INTO query_test (value) VALUES (?)',
          [`value_${i}`]
        );
      }

      const startTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        dbManager.runQuery(
          'SELECT * FROM query_test WHERE value = ?',
          [`value_${i}`]
        );
      }

      const duration = Date.now() - startTime;
      
      // 50次查询应在合理时间内完成（< 500ms）
      expect(duration).toBeLessThan(500);
    });
  });
});
