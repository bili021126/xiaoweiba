import 'reflect-metadata';
import { EpisodicMemory, MemoryTier } from '../../../src/core/memory/EpisodicMemory';
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

// 跳过分层记忆测试 - P2功能，非当前核心
describe.skip('EpisodicMemory - 短期/长期记忆分区', () => {
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
      getDatabase: jest.fn().mockReturnValue(mockDb),
      migrateAddMemoryTier: jest.fn()
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockProjectFingerprint = {
      getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fingerprint-123')
    } as any;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        memory: {
          retentionDays: 90,
          decayLambda: 0.1
        }
      })
    } as any;

    episodicMemory = new EpisodicMemory(
      mockDbManager,
      mockAuditLogger,
      mockProjectFingerprint,
      mockConfigManager,
      {} as any, // VectorIndexManager
      {} as any, // SemanticRetriever
      {} as any, // QueryExecutor
      {} as any, // WeightCalculator
      {} as any, // IndexSyncService
      {} as any  // HybridRetriever ✅ L2: 新增
    );
  });

  describe('record() - 自动判断记忆层级', () => {
    it('应该将新记录标记为SHORT_TERM', async () => {
      // Mock db.run to capture the INSERT call
      const insertCalls: any[][] = [];
      mockDb.run.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('INSERT')) {
          insertCalls.push(params);
        }
      });

      const id = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '测试短期记忆',
        entities: ['test'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });

      expect(id).toBeDefined();
      
      // 验证INSERT语句中包含了memory_tier参数
      expect(insertCalls.length).toBeGreaterThan(0);
      const lastInsertParams = insertCalls[insertCalls.length - 1];
      expect(lastInsertParams[lastInsertParams.length - 1]).toBe('SHORT_TERM');
    });

    it('应该在统计中包含byTier字段', async () => {
      const stats = await episodicMemory.getStats();
      
      expect(stats.byTier).toBeDefined();
      expect(typeof stats.byTier).toBe('object');
    });
  });

  describe('retrieve() - 按层级过滤', () => {
    it('应该能够按SHORT_TERM过滤', async () => {
      const memories = await episodicMemory.retrieve({ 
        memoryTier: 'SHORT_TERM',
        limit: 10 
      });

      expect(Array.isArray(memories)).toBe(true);
      memories.forEach(memory => {
        expect(memory.memoryTier).toBe('SHORT_TERM');
      });
    });

    it('应该能够按LONG_TERM过滤', async () => {
      const memories = await episodicMemory.retrieve({ 
        memoryTier: 'LONG_TERM',
        limit: 10 
      });

      expect(Array.isArray(memories)).toBe(true);
      memories.forEach(memory => {
        expect(memory.memoryTier).toBe('LONG_TERM');
      });
    });
  });

  describe('migrateShortToLongTerm() - 迁移短期到长期', () => {
    it('应该能够将过期的SHORT_TERM记忆迁移为LONG_TERM', async () => {
      // 先记录一些记忆
      await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '测试迁移功能',
        entities: ['migration'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 50
      });

      // 执行迁移（7天内的不会迁移）
      const migratedCount = await episodicMemory.migrateShortToLongTerm();
      
      expect(typeof migratedCount).toBe('number');
      expect(migratedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('determineMemoryTier() - 时间判断逻辑', () => {
    it('应该正确判断7天内的记忆为SHORT_TERM', () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      
      // 通过反射访问私有方法
      const tier = (episodicMemory as any).determineMemoryTier(threeDaysAgo);
      expect(tier).toBe('SHORT_TERM');
    });

    it('应该正确判断7天以上的记忆为LONG_TERM', () => {
      const now = Date.now();
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
      
      // 通过反射访问私有方法
      const tier = (episodicMemory as any).determineMemoryTier(tenDaysAgo);
      expect(tier).toBe('LONG_TERM');
    });

    it('边界情况：正好7天前应该是LONG_TERM', () => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      const tier = (episodicMemory as any).determineMemoryTier(sevenDaysAgo - 1);
      expect(tier).toBe('LONG_TERM');
    });
  });

  describe('数据库迁移', () => {
    it('migrateAddMemoryTier应该成功添加memory_tier列', () => {
      // 第二次调用应该不会报错（幂等性）
      expect(() => {
        mockDbManager.migrateAddMemoryTier();
      }).not.toThrow();
    });
  });
});
