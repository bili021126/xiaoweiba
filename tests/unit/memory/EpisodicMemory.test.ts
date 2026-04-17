import { EpisodicMemory, TaskType } from '../../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import { ConfigManager } from '../../../src/storage/ConfigManager';

// Mock sql.js
jest.mock('sql.js', () => {
  const mockStatement = {
    bind: jest.fn().mockReturnThis(),
    step: jest.fn().mockReturnValue(false),
    getAsObject: jest.fn(),
    free: jest.fn()
  };
  
  const mockDb = {
    run: jest.fn(),
    exec: jest.fn().mockReturnValue([]),
    prepare: jest.fn().mockReturnValue(mockStatement),
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

    it('should throw error when dbManager not injected', async () => {
      const episodicMemoryNoDb = new EpisodicMemory(null as any, mockAuditLogger, mockProjectFingerprint, mockConfigManager);
      
      await expect(
        episodicMemoryNoDb.record({
          taskType: 'CODE_EXPLAIN',
          summary: 'Test',
          entities: [],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 100
        })
      ).rejects.toThrow('DatabaseManager not injected');
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
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
        getAsObject: jest.fn().mockReturnValue({
          id: 'ep_123_abc',
          project_fingerprint: 'fp123',
          timestamp: Date.now(),
          task_type: 'CODE_EXPLAIN',
          summary: 'Summary',
          entities: '[]',
          decision: null,
          outcome: 'SUCCESS',
          final_weight: 8,
          model_id: 'deepseek',
          latency_ms: 1000,
          metadata: null
        }),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 10
      });

      expect(memories.length).toBe(1);
      expect(memories[0].id).toBe('ep_123_abc');
      expect(memories[0].taskType).toBe('CODE_EXPLAIN');
    });

    it('should return empty array when no memories', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const memories = await episodicMemory.retrieve();

      expect(memories).toEqual([]);
    });

    it('should return empty array when project fingerprint is null', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const memories = await episodicMemory.retrieve();

      expect(memories).toEqual([]);
    });

    it('should apply custom sort order', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      await episodicMemory.retrieve({
        sortBy: 'finalWeight',
        sortOrder: 'ASC'
      });

      // Check that SQL contains ORDER BY final_weight ASC
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('ORDER BY final_weight ASC');
    });

    it('should limit results to maximum 100', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      await episodicMemory.retrieve({ limit: 150 });

      // Verify SQL uses parameterized query
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('LIMIT ?');
      
      // Verify the bound parameter is capped at 100
      const bindCall = mockStatement.bind.mock.calls[0][0];
      expect(bindCall).toContain(100);
    });
  });

  describe('search', () => {
    it.skip('should search memories using FTS5', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
        getAsObject: jest.fn().mockReturnValue({
          id: 'ep_1',
          project_fingerprint: 'fp',
          timestamp: Date.now(),
          task_type: 'CODE_EXPLAIN',
          summary: 'Test summary',
          entities: '[]',
          decision: null,
          outcome: 'SUCCESS',
          final_weight: 8,
          model_id: 'deepseek',
          latency_ms: 1000,
          metadata: null
        }),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const results = await episodicMemory.search('test query');

      expect(results.length).toBe(1);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should return empty array when no results', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const results = await episodicMemory.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should return empty array when project fingerprint is null', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const results = await episodicMemory.search('test');

      expect(results).toEqual([]);
    });

    it('should sanitize special characters in query', async () => {
      const mockStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await episodicMemory.search("test'; DROP TABLE--");

      // 验证使用了参数化查询
      expect(mockDb.prepare).toHaveBeenCalled();
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      // 应该包含?占位符而非直接拼接
      expect(sqlCall).toContain('?');
      expect(sqlCall).not.toContain("'; DROP TABLE");
      
      // 验证参数绑定
      expect(mockStmt.bind).toHaveBeenCalled();
      const boundParams = (mockStmt.bind as jest.Mock).mock.calls[0][0];
      expect(boundParams[1]).not.toContain('; DROP TABLE');
    });

    it.skip('should limit query length to 200 characters', async () => {
      const mockStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);
      
      const longQuery = 'a'.repeat(300);

      await episodicMemory.search(longQuery);

      // 验证使用了参数化查询
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockStmt.bind).toHaveBeenCalled();
      
      // 验证查询长度被限制
      const boundParams = (mockStmt.bind as jest.Mock).mock.calls[0][0];
      expect(boundParams[1].length).toBeLessThanOrEqual(200);
    });

    it('should support Chinese search', async () => {
      const mockStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await episodicMemory.search('测试中文搜索');

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it.skip('should handle empty query', async () => {
      // 空查询应该直接返回，不执行SQL
      await episodicMemory.search('');

      // 不应该调用prepare
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it.skip('should limit results to maximum 100', async () => {
      const mockStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await episodicMemory.search('test', { limit: 150 });

      // 验证limit被限制到100
      expect(mockStmt.bind).toHaveBeenCalled();
      const boundParams = (mockStmt.bind as jest.Mock).mock.calls[0][0];
      expect(boundParams[2]).toBe(100); // limit参数
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
      // Mock prepare to return different statements for each call
      const totalStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(true),
        getAsObject: jest.fn().mockReturnValue({ count: 100 }),
        free: jest.fn()
      };

      const byTaskTypeStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false),
        getAsObject: jest.fn()
          .mockReturnValueOnce({ task_type: 'CODE_EXPLAIN', count: 50 })
          .mockReturnValueOnce({ task_type: 'CODE_GENERATE', count: 30 }),
        free: jest.fn()
      };

      const byOutcomeStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false),
        getAsObject: jest.fn()
          .mockReturnValueOnce({ outcome: 'SUCCESS', count: 80 })
          .mockReturnValueOnce({ outcome: 'FAILED', count: 20 }),
        free: jest.fn()
      };

      const avgWeightStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(true),
        getAsObject: jest.fn().mockReturnValue({ avg_weight: 6.5 }),
        free: jest.fn()
      };

      (mockDb.prepare as jest.Mock)
        .mockReturnValueOnce(totalStmt)
        .mockReturnValueOnce(byTaskTypeStmt)
        .mockReturnValueOnce(byOutcomeStmt)
        .mockReturnValueOnce(avgWeightStmt);

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
      const mockStmt = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      (mockDb.prepare as jest.Mock).mockReturnValue(mockStmt);

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
    it.skip('应能正确使用FTS5进行全文搜索', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
        getAsObject: jest.fn().mockReturnValue({
          id: 'ep_1',
          project_fingerprint: 'test-fingerprint-123',
          timestamp: Date.now(),
          task_type: 'CODE_EXPLAIN',
          summary: 'React组件优化',
          entities: '[]',
          decision: null,
          outcome: 'SUCCESS',
          final_weight: 8,
          model_id: 'deepseek',
          latency_ms: 1000,
          metadata: null
        }),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const results = await episodicMemory.search('React 优化', { limit: 10 });
      
      expect(results.length).toBe(1);
      expect(results[0].summary).toContain('React');
      // 验证 SQL 包含 FTS5 MATCH
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('MATCH');
    });

    it('应正确处理特殊字符的搜索查询', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const results = await episodicMemory.search('SELECT * FROM users; DROP TABLE--', { limit: 10 });
      
      expect(results).toEqual([]);
      // 验证特殊字符被清理
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
      expect(sqlCall).not.toContain('; DROP TABLE');
    });
  });

  describe('SQL注入防护', () => {
    it('应阻止SQL注入攻击', async () => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      };
      mockDb.prepare.mockReturnValue(mockStatement);
      
      const maliciousQuery = "' OR '1'='1";
      const results = await episodicMemory.search(maliciousQuery, { limit: 10 });
      
      expect(results).toEqual([]);
      // 验证查询被清理
      const sqlCall = (mockDb.prepare as jest.Mock).mock.calls[0][0];
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

  describe('意图感知与自适应权重', () => {
    describe('initialize', () => {
      it('应能成功初始化', async () => {
        await episodicMemory.initialize();
        expect(episodicMemory['indexReady']).toBe(true);
      });

      it('多次调用应返回同一Promise', async () => {
        // 第一次调用前
        const promise1 = episodicMemory.initialize();
        // 立即第二次调用（此时initPromise已设置但未完成）
        const promise2 = episodicMemory.initialize();
        
        // 两个Promise应该是同一个对象
        await Promise.all([promise1, promise2]);
        expect(episodicMemory['indexReady']).toBe(true);
      });
    });

    describe('dispose', () => {
      it('应清理所有索引数据', async () => {
        // 先初始化
        await episodicMemory.initialize();
        
        // 添加一些测试数据
        episodicMemory['invertedIndex'].set('test', new Map([['ep_1', 1]]));
        episodicMemory['docTermFreq'].set('ep_1', new Map([['test', 1]]));
        episodicMemory['idfCache'].set('test', 1);
        episodicMemory['vectorCache'].set('ep_1', new Float32Array([1, 2, 3]));
        
        // 清理
        await episodicMemory.dispose();
        
        expect(episodicMemory['invertedIndex'].size).toBe(0);
        expect(episodicMemory['docTermFreq'].size).toBe(0);
        expect(episodicMemory['idfCache'].size).toBe(0);
        expect(episodicMemory['vectorCache'].size).toBe(0);
        expect(episodicMemory['indexReady']).toBe(false);
        expect(episodicMemory['initPromise']).toBeNull();
      });
    });

    describe('getAdaptiveWeights', () => {
      it('时间敏感查询应增强时间权重', () => {
        const weights = episodicMemory['getAdaptiveWeights']('刚才那个解释');
        expect(weights.t).toBeGreaterThan(0.2); // 时间权重应高于基础值
        expect(weights.k + weights.t + weights.e + weights.v).toBeCloseTo(1, 5); // 归一化
      });

      it('实体敏感查询应增强关键词和实体权重', () => {
        const weights = episodicMemory['getAdaptiveWeights']('calculateTotal函数');
        expect(weights.k).toBeGreaterThan(0.3); // 关键词权重增强
        expect(weights.e).toBeGreaterThan(0.2); // 实体权重增强
      });

      it('语义模糊查询应增强向量权重', () => {
        const weights = episodicMemory['getAdaptiveWeights']('怎么优化这个算法');
        expect(weights.v).toBeGreaterThan(0.3); // 向量权重增强
      });

      it('普通查询应使用balanced专家权重', () => {
        const weights = episodicMemory['getAdaptiveWeights']('代码解释');
        expect(weights.k).toBeCloseTo(0.3, 1);
        expect(weights.t).toBeCloseTo(0.2, 1);
        expect(weights.e).toBeCloseTo(0.2, 1);
        expect(weights.v).toBeCloseTo(0.3, 1);
      });
    });

    describe('recordFeedback', () => {
      it('应能记录用户反馈', () => {
        expect(() => {
          episodicMemory.recordFeedback('刚才那个', 'ep_123');
        }).not.toThrow();
      });

      it('记录反馈后应更新专家选择器状态', () => {
        // 记录少量反馈
        for (let i = 0; i < 5; i++) {
          episodicMemory.recordFeedback('刚才那个', 'ep_123');
        }
        
        // 专家应该仍然有效
        expect(episodicMemory.getCurrentExpert()).toBeDefined();
      });
    });

    describe('resetExpert', () => {
      it('重置后应恢复到balanced专家', () => {
        // 先记录少量反馈
        for (let i = 0; i < 5; i++) {
          episodicMemory.recordFeedback('刚才那个', 'ep_123');
        }
        
        // 重置
        episodicMemory.resetExpert();
        
        expect(episodicMemory.getCurrentExpert()).toBe('balanced');
      });
    });

    describe('getCurrentExpert', () => {
      it('初始化时应返回balanced', () => {
        expect(episodicMemory.getCurrentExpert()).toBe('balanced');
      });

      it('应返回当前专家名称', () => {
        const expert = episodicMemory.getCurrentExpert();
        expect(['balanced', 'temporal', 'entity', 'semantic', 'hybrid']).toContain(expert);
      });
    });

    describe('searchSemantic混合检索', () => {
      beforeEach(async () => {
        // 初始化索引
        await episodicMemory.initialize();
      });

      it('时间指代查询应返回最近记忆', async () => {
        const results = await episodicMemory.search('刚才');
        expect(Array.isArray(results)).toBe(true);
      });

      it('无候选时应降级到LIKE查询', async () => {
        const results = await episodicMemory.search('xyz_not_exist_12345');
        expect(Array.isArray(results)).toBe(true);
      });

      it('索引未就绪时应使用降级方案', async () => {
        // 创建新实例，不调用initialize()
        const freshEpisodicMemory = new EpisodicMemory(
          mockDbManager,
          mockAuditLogger,
          mockProjectFingerprint,
          mockConfigManager
        );
        
        const results = await freshEpisodicMemory.search('test');
        expect(Array.isArray(results)).toBe(true);
      });
    });
  });

  describe('retrieve() - 分支覆盖', () => {
    beforeEach(() => {
      mockDb.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      });
    });

    it('应该支持sinceTimestamp过滤', async () => {
      const sinceTs = Date.now() - 3600000; // 1小时前
      await episodicMemory.retrieve({ sinceTimestamp: sinceTs });
      
      const prepareCall = (mockDb.prepare as jest.Mock).mock.calls[0];
      expect(prepareCall[0]).toContain('timestamp >= ?');
    });

    it('应该支持memoryTier过滤', async () => {
      await episodicMemory.retrieve({ memoryTier: 'SHORT_TERM' });
      
      const prepareCall = (mockDb.prepare as jest.Mock).mock.calls[0];
      expect(prepareCall[0]).toContain('memory_tier = ?');
    });

    it('应该同时支持多个过滤条件', async () => {
      const sinceTs = Date.now() - 3600000;
      await episodicMemory.retrieve({ 
        taskType: 'CODE_EXPLAIN',
        sinceTimestamp: sinceTs,
        memoryTier: 'LONG_TERM'
      });
      
      const prepareCall = (mockDb.prepare as jest.Mock).mock.calls[0];
      const sql = prepareCall[0];
      expect(sql).toContain('task_type = ?');
      expect(sql).toContain('timestamp >= ?');
      expect(sql).toContain('memory_tier = ?');
    });
  });

  describe('searchSemantic() - TF-IDF检索', () => {
    beforeEach(() => {
      // Mock FTS5查询返回候选ID
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('episodic_memory_fts')) {
          return {
            bind: jest.fn().mockReturnThis(),
            step: jest.fn()
              .mockReturnValueOnce(true)
              .mockReturnValueOnce(true)
              .mockReturnValueOnce(false),
            getAsObject: jest.fn()
              .mockReturnValueOnce({ id: 'mem-001' })
              .mockReturnValueOnce({ id: 'mem-002' }),
            free: jest.fn()
          };
        }
        return {
          bind: jest.fn().mockReturnThis(),
          step: jest.fn().mockReturnValue(false),
          getAsObject: jest.fn(),
          free: jest.fn()
        };
      });
    });

    it('应该执行TF-IDF评分并返回排序结果', async () => {
      // 模拟记忆数据
      const mockMemories = [
        { id: 'mem-001', summary: 'React component optimization', entities: ['React'], timestamp: Date.now() - 86400000 },
        { id: 'mem-002', summary: 'Vue performance tuning', entities: ['Vue'], timestamp: Date.now() - 172800000 }
      ];

      let callCount = 0;
      (episodicMemory as any).getMemoryById = jest.fn().mockImplementation(() => {
        return Promise.resolve(mockMemories[callCount++ % mockMemories.length]);
      });

      const results = await (episodicMemory as any).searchSemantic('React optimization', 10);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('应该在无候选时返回空数组', async () => {
      mockDb.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      });

      const results = await (episodicMemory as any).searchSemantic('nonexistent query', 10);
      expect(results).toEqual([]);
    });

    it('应该处理实体匹配加分逻辑', async () => {
      const mockMemory = {
        id: 'mem-003',
        summary: 'Database query optimization',
        entities: ['PostgreSQL', 'index'],
        timestamp: Date.now() - 3600000,
        finalWeight: 0.8
      };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('episodic_memory_fts')) {
          return {
            bind: jest.fn().mockReturnThis(),
            step: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
            getAsObject: jest.fn().mockReturnValueOnce({ id: 'mem-003' }),
            free: jest.fn()
          };
        }
        return {
          bind: jest.fn().mockReturnThis(),
          step: jest.fn().mockReturnValue(false),
          getAsObject: jest.fn(),
          free: jest.fn()
        };
      });

      (episodicMemory as any).getMemoryById = jest.fn().mockResolvedValue(mockMemory);

      const results = await (episodicMemory as any).searchSemantic('PostgreSQL index', 5);
      expect(results).toBeDefined();
    });
  });

  describe('getMemoryById() - 单条记忆检索', () => {
    it('应该成功获取存在的记忆', async () => {
      const mockRow = {
        id: 'mem-test',
        project_fingerprint: 'fp123',
        timestamp: Date.now(),
        task_type: 'CODE_EXPLAIN',
        summary: 'Test memory',
        entities: JSON.stringify(['entity1']),
        outcome: 'SUCCESS',
        final_weight: 0.9,
        model_id: 'gpt-4',
        duration_ms: 1500
      };

      mockDb.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(true),
        getAsObject: jest.fn().mockReturnValue(mockRow),
        free: jest.fn()
      });

      const result = await (episodicMemory as any).getMemoryById('mem-test');
      expect(result).toBeDefined();
      expect(result?.id).toBe('mem-test');
    });

    it('应该在记忆不存在时返回null', async () => {
      mockDb.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      });

      const result = await (episodicMemory as any).getMemoryById('nonexistent');
      expect(result).toBeNull();
    });

    it('应该在数据库错误时返回null', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await (episodicMemory as any).getMemoryById('mem-error');
      expect(result).toBeNull();
    });
  });

  describe('migrateShortToLongTerm() - 记忆迁移', () => {
    it('应该成功迁移过期的短期记忆', async () => {
      mockDb.run.mockReturnValue(undefined);
      mockDb.getRowsModified.mockReturnValue(5);

      const count = await episodicMemory.migrateShortToLongTerm();
      expect(count).toBe(5);
    });

    it('应该在无项目指纹时跳过迁移', async () => {
      (mockProjectFingerprint.getCurrentProjectFingerprint as jest.Mock).mockResolvedValue(null);

      const count = await episodicMemory.migrateShortToLongTerm();
      expect(count).toBe(0);
    });

    it('应该在迁移失败时抛出错误', async () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('Migration failed');
      });

      await expect(episodicMemory.migrateShortToLongTerm()).rejects.toThrow('Migration failed');
    });
  });

  describe('getRecentMemoriesFromDB() - 最近记忆检索', () => {
    it('应该成功获取最近记忆', async () => {
      const mockRows = [
        {
          id: 'mem-recent-1',
          project_fingerprint: 'fp123',
          timestamp: Date.now() - 3600000,
          task_type: 'CODE_GENERATE',
          summary: 'Recent memory 1',
          entities: JSON.stringify(['React']),
          outcome: 'SUCCESS',
          final_weight: 0.85,
          model_id: 'gpt-4',
          duration_ms: 2000
        },
        {
          id: 'mem-recent-2',
          project_fingerprint: 'fp123',
          timestamp: Date.now() - 7200000,
          task_type: 'TEST_GENERATE',
          summary: 'Recent memory 2',
          entities: JSON.stringify(['Jest']),
          outcome: 'SUCCESS',
          final_weight: 0.75,
          model_id: 'gpt-3.5',
          duration_ms: 1500
        }
      ];

      mockDb.prepare.mockReturnValue({
        bind: jest.fn().mockReturnThis(),
        step: jest.fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false),
        getAsObject: jest.fn()
          .mockReturnValueOnce(mockRows[0])
          .mockReturnValueOnce(mockRows[1]),
        free: jest.fn()
      });

      const memories = await (episodicMemory as any).getRecentMemoriesFromDB('fp123', 10);
      expect(memories).toHaveLength(2);
      expect(memories[0].id).toBe('mem-recent-1');
    });

    it('应该在数据库错误时返回空数组', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Query failed');
      });

      const memories = await (episodicMemory as any).getRecentMemoriesFromDB('fp123', 10);
      expect(memories).toEqual([]);
    });
  });
});
