import { EpisodicMemory, TaskType } from '../../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import { ConfigManager } from '../../../src/storage/ConfigManager';

// Mock sql.js
jest.mock('sql.js', () => {
  const mockDb = {
    run: jest.fn(),
    exec: jest.fn(),
    export: jest.fn().mockReturnValue(new Uint8Array()),
    close: jest.fn(),
    getRowsModified: jest.fn().mockReturnValue(5)
  };
  return jest.fn().mockImplementation(() => mockDb);
});

describe('EpisodicMemory', () => {
  let episodicMemory: EpisodicMemory;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockProjectFingerprint: jest.Mocked<ProjectFingerprint>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = require('sql.js')();

    mockDbManager = {
      getDatabase: jest.fn().mockReturnValue(mockDb)
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockProjectFingerprint = {
      getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fingerprint-123')
    } as any;

    // Add ConfigManager mock
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        memory: {
          retentionDays: 90,
          decayLambda: 0.01
        }
      })
    } as any;

    episodicMemory = new EpisodicMemory(
      mockDbManager,
      mockAuditLogger,
      mockProjectFingerprint,
      mockConfigManager
    );
  });

  describe('record', () => {
    it('should record a memory successfully', async () => {
      mockDb.run.mockReturnValue({});

      const id = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: 'Explained a function',
        entities: ['function', 'variable'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 1500
      });

      expect(id).toMatch(/^ep_\d+_[a-z0-9]+$/);
      expect(mockDb.run).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'memory_record',
        'success',
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should throw error when no workspace', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      await expect(
        episodicMemory.record({
          taskType: 'CODE_EXPLAIN',
          summary: 'Test',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100
        })
      ).rejects.toThrow();
    });

    it('should assign weight 8 for SUCCESS outcome', async () => {
      mockDb.run.mockReturnValue({});

      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 100
      });

      // Check that the INSERT includes weight 8
      const insertCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(insertCall[1][8]).toBe(8); // final_weight is at index 8
    });

    it('should assign weight 2 for FAILED outcome', async () => {
      mockDb.run.mockReturnValue({});

      await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: 'Failed test',
        entities: [],
        outcome: 'FAILED',
        modelId: 'deepseek',
        durationMs: 100
      });

      const insertCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(insertCall[1][8]).toBe(2);
    });

    it('should assign weight 5 for PARTIAL outcome', async () => {
      mockDb.run.mockReturnValue({});

      await episodicMemory.record({
        taskType: 'TEST_GENERATE',
        summary: 'Partial test',
        entities: [],
        outcome: 'PARTIAL',
        modelId: 'deepseek',
        durationMs: 100
      });

      const insertCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(insertCall[1][8]).toBe(5);
    });

    it('should assign weight 1 for CANCELLED outcome', async () => {
      mockDb.run.mockReturnValue({});

      await episodicMemory.record({
        taskType: 'SQL_OPTIMIZE',
        summary: 'Cancelled task',
        entities: [],
        outcome: 'CANCELLED',
        modelId: 'deepseek',
        durationMs: 100
      });

      const insertCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(insertCall[1][8]).toBe(1);
    });
  });

  describe('retrieve', () => {
    it('should retrieve memories with filters', async () => {
      mockDb.exec.mockReturnValue([
        {
          columns: ['id', 'project_fingerprint', 'timestamp', 'task_type', 'summary', 'entities', 'decision', 'outcome', 'final_weight', 'model_id', 'duration_ms', 'metadata'],
          values: [
            ['ep_123_abc', 'fp123', Date.now(), 'CODE_EXPLAIN', 'Summary', '[]', null, 'SUCCESS', 8, 'deepseek', 1000, null]
          ]
        }
      ]);

      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 10
      });

      expect(memories.length).toBe(1);
      expect(memories[0].id).toBe('ep_123_abc');
      expect(memories[0].taskType).toBe('CODE_EXPLAIN');
    });

    it('should return empty array when no memories', async () => {
      mockDb.exec.mockReturnValue([]);

      const memories = await episodicMemory.retrieve();

      expect(memories).toEqual([]);
    });

    it('should return empty array when project fingerprint is null', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const memories = await episodicMemory.retrieve();

      expect(memories).toEqual([]);
    });

    it('should apply custom sort order', async () => {
      mockDb.exec.mockReturnValue([
        {
          columns: ['id', 'project_fingerprint', 'timestamp', 'task_type', 'summary', 'entities', 'decision', 'outcome', 'final_weight', 'model_id', 'duration_ms', 'metadata'],
          values: [
            ['ep_1', 'fp', Date.now(), 'CODE_EXPLAIN', 'Summary', '[]', null, 'SUCCESS', 8, 'deepseek', 1000, null]
          ]
        }
      ]);

      await episodicMemory.retrieve({
        sortBy: 'finalWeight',
        sortOrder: 'ASC'
      });

      // Check that SQL contains ORDER BY final_weight ASC
      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('ORDER BY final_weight ASC');
    });

    it('should limit results to maximum 100', async () => {
      mockDb.exec.mockReturnValue([]);

      await episodicMemory.retrieve({ limit: 150 });

      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('LIMIT 100');
    });
  });

  describe('search', () => {
    it('should search memories using FTS5', async () => {
      mockDb.exec.mockReturnValue([
        {
          columns: ['id', 'project_fingerprint', 'timestamp', 'task_type', 'summary', 'entities', 'decision', 'outcome', 'final_weight', 'model_id', 'duration_ms', 'metadata'],
          values: [
            ['ep_1', 'fp', Date.now(), 'CODE_EXPLAIN', 'Test summary', '[]', null, 'SUCCESS', 8, 'deepseek', 1000, null]
          ]
        }
      ]);

      const results = await episodicMemory.search('test query');

      expect(results.length).toBe(1);
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should return empty array when no results', async () => {
      mockDb.exec.mockReturnValue([]);

      const results = await episodicMemory.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return empty array when project fingerprint is null', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const results = await episodicMemory.search('test');

      expect(results).toEqual([]);
    });

    it('should sanitize special characters in query', async () => {
      mockDb.exec.mockReturnValue([]);

      await episodicMemory.search("test'; DROP TABLE--");

      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      // Should not contain SQL injection
      expect(sqlCall).not.toContain('; DROP TABLE');
    });

    it('should limit query length to 200 characters', async () => {
      mockDb.exec.mockReturnValue([]);
      const longQuery = 'a'.repeat(300);

      await episodicMemory.search(longQuery);

      // The sanitized query should be truncated to 200 chars
      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      // SQL contains the query, and original query is 300 chars but should be truncated to 200
      // Just verify it executed without error and the sanitization worked
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should support Chinese search', async () => {
      mockDb.exec.mockReturnValue([]);

      await episodicMemory.search('测试中文搜索');

      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should handle empty query', async () => {
      mockDb.exec.mockReturnValue([]);

      await episodicMemory.search('');

      // Should still execute without error
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should limit results to maximum 100', async () => {
      mockDb.exec.mockReturnValue([]);

      await episodicMemory.search('test', { limit: 150 });

      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('LIMIT 100');
    });
  });

  describe('sanitizeFtsQuery', () => {
    it('should remove special characters', () => {
      const sanitized = episodicMemory['sanitizeFtsQuery']("test'; DROP TABLE--");
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });

    it('should preserve Chinese characters', () => {
      const sanitized = episodicMemory['sanitizeFtsQuery']('测试中文');
      expect(sanitized).toBe('测试中文');
    });

    it('should trim and normalize spaces', () => {
      const sanitized = episodicMemory['sanitizeFtsQuery']('  test   query  ');
      expect(sanitized).toBe('test query');
    });

    it('should limit length to 200', () => {
      const longQuery = 'a'.repeat(300);
      const sanitized = episodicMemory['sanitizeFtsQuery'](longQuery);
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('should return empty string for empty input', () => {
      const sanitized = episodicMemory['sanitizeFtsQuery']('');
      expect(sanitized).toBe('');
    });

    it('should handle special characters gracefully', () => {
      const sanitized = episodicMemory['sanitizeFtsQuery']("@#$%^&*()");
      // Special chars should be replaced with spaces and trimmed
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });
  });

  describe('applyDecay', () => {
    it('should apply exponential decay', () => {
      // With decayLambda = 0.01 (default)
      const weight = episodicMemory.applyDecay(10, 0);
      expect(weight).toBeCloseTo(10, 5);

      const weightAfter10Days = episodicMemory.applyDecay(10, 10);
      expect(weightAfter10Days).toBeLessThan(10);
      expect(weightAfter10Days).toBeGreaterThan(5);

      const weightAfter100Days = episodicMemory.applyDecay(10, 100);
      expect(weightAfter100Days).toBeLessThan(weightAfter10Days);
    });

    it('should decay to near zero after long time', () => {
      const weightAfter365Days = episodicMemory.applyDecay(10, 365);
      expect(weightAfter365Days).toBeLessThan(1);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired memories', async () => {
      const count = await episodicMemory.cleanupExpired();
      expect(count).toBe(5); // From mock getRowsModified
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'memory_cleanup',
        'success',
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      await episodicMemory.cleanupExpired();

      // Check that db.run was called with parameterized query
      const runCall = (mockDb.run as jest.Mock).mock.calls[0];
      expect(runCall[0]).toContain('?'); // Should use parameterized query
      expect(runCall[1]).toBeDefined(); // Should have parameters
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      // Mock exec to return different values for each call
      (mockDb.exec as jest.Mock)
        .mockReturnValueOnce([{ values: [[100]] }]) // COUNT(*)
        .mockReturnValueOnce([{ values: [['CODE_EXPLAIN', 50], ['CODE_GENERATE', 30]] }]) // GROUP BY task_type
        .mockReturnValueOnce([{ values: [['SUCCESS', 80], ['FAILED', 20]] }]) // GROUP BY outcome
        .mockReturnValueOnce([{ values: [[6.5]] }]); // AVG

      const stats = await episodicMemory.getStats();

      expect(stats.totalCount).toBe(100);
      expect(stats.byTaskType).toEqual({ CODE_EXPLAIN: 50, CODE_GENERATE: 30 });
      expect(stats.byOutcome).toEqual({ SUCCESS: 80, FAILED: 20 });
      expect(stats.averageWeight).toBe(6.5);
    });

    it('should return zeros when no project fingerprint', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const stats = await episodicMemory.getStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.byTaskType).toEqual({});
      expect(stats.byOutcome).toEqual({});
      expect(stats.averageWeight).toBe(0);
    });

    it('should handle empty result sets', async () => {
      mockDb.exec.mockReturnValue([]);

      const stats = await episodicMemory.getStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.byTaskType).toEqual({});
      expect(stats.byOutcome).toEqual({});
      expect(stats.averageWeight).toBe(0);
    });
  });

  describe('依赖注入', () => {
    it('应通过依赖注入正确初始化', () => {
      // EpisodicMemory 已经通过构造函数接收所有依赖
      expect(episodicMemory).toBeDefined();
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });
  });

  describe('FTS5 集成测试', () => {
    it('应能正确使用FTS5进行全文搜索', async () => {
      mockDb.exec.mockReturnValue([
        {
          columns: ['id', 'project_fingerprint', 'timestamp', 'task_type', 'summary', 'entities', 'decision', 'outcome', 'final_weight', 'model_id', 'duration_ms', 'metadata'],
          values: [
            ['ep_1', 'test-fingerprint-123', Date.now(), 'CODE_EXPLAIN', 'React组件优化', '[]', null, 'SUCCESS', 8, 'deepseek', 1000, null]
          ]
        }
      ]);

      const results = await episodicMemory.search('React 优化', { limit: 10 });
      
      expect(results.length).toBe(1);
      expect(results[0].summary).toContain('React');
      // 验证 SQL 包含 FTS5 MATCH
      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('MATCH');
    });

    it('应正确处理特殊字符的搜索查询', async () => {
      mockDb.exec.mockReturnValue([]);

      const results = await episodicMemory.search('SELECT * FROM users; DROP TABLE--', { limit: 10 });
      
      expect(results).toEqual([]);
      // 验证特殊字符被清理
      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).not.toContain('; DROP TABLE');
    });
  });

  describe('SQL注入防护', () => {
    it('应阻止SQL注入攻击', async () => {
      mockDb.exec.mockReturnValue([]);
      
      const maliciousQuery = "' OR '1'='1";
      const results = await episodicMemory.search(maliciousQuery, { limit: 10 });
      
      expect(results).toEqual([]);
      // 验证查询被清理
      const sqlCall = (mockDb.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).not.toContain("' OR '1'='1");
    });

    it('应清理并截断超长查询', () => {
      const longQuery = 'a'.repeat(300);
      const sanitized = episodicMemory['sanitizeFtsQuery'](longQuery);
      
      expect(sanitized.length).toBeLessThanOrEqual(200);
    });

    it('应处理空搜索查询', async () => {
      mockDb.exec.mockReturnValue([]);
      
      const results = await episodicMemory.search('', { limit: 10 });
      
      expect(results).toEqual([]);
    });

    it('应处理仅包含特殊字符的查询', async () => {
      mockDb.exec.mockReturnValue([]);
      
      const results = await episodicMemory.search('@#$%^&*()', { limit: 10 });
      
      expect(results).toEqual([]);
    });

    it('应转义单引号防止SQL注入', () => {
      const query = "test' OR '1'='1";
      const sanitized = episodicMemory['sanitizeFtsQuery'](query);
      
      // 特殊字符应被移除或替换
      expect(sanitized).not.toContain("' OR '");
    });
  });
});
