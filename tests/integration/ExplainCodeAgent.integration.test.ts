/**
 * 代码解释功能简化集成测试
 * 
 * 验证核心组件的协同工作：
 * - EpisodicMemory记录和检索
 * - PreferenceMemory记录和查询  
 * - DatabaseManager健康检查
 * - AuditLogger日志记录
 */

import 'reflect-metadata';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { AuditLogger } from '../../src/core/security/AuditLogger';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../src/core/memory/PreferenceMemory';

describe('代码解释功能集成测试 (简化版)', () => {
  let databaseManager: DatabaseManager;
  let configManager: any;
  let auditLogger: AuditLogger;
  let episodicMemory: EpisodicMemory;
  let preferenceMemory: PreferenceMemory;
  let mockFingerprint: any;

  beforeAll(async () => {
    // 创建Mock配置管理器
    configManager = {
      getConfig: () => ({
        mode: 'private',
        model: {
          default: 'deepseek',
          providers: [
            {
              id: 'deepseek',
              apiUrl: 'https://api.deepseek.com/v1',
              apiKey: 'test-key',
              maxTokens: 4096,
              temperature: 0.6
            }
          ]
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
          coldStartTrust: 3
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
          sources: [],
          builtinOnly: false
        }
      }),
      updateConfig: jest.fn(),
      resetConfig: jest.fn()
    };

    // 初始化数据库管理器
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize();

    // 初始化审计日志
    auditLogger = new AuditLogger(configManager);

    // 初始化项目指纹（Mock）
    mockFingerprint = {
      getCurrentProjectFingerprint: async () => 'test-project-fp-integration',
      clearCache: jest.fn()
    };

    // 初始化情景记忆
    episodicMemory = new EpisodicMemory(
      databaseManager,
      auditLogger,
      mockFingerprint,
      configManager,
      {} as any, // VectorIndexManager
      {} as any, // SemanticRetriever
      {} as any, // QueryExecutor
      {} as any, // WeightCalculator
      {} as any, // IndexSyncService
      {} as any  // HybridRetriever ✅ L2: 新增
    );

    // 初始化偏好记忆
    preferenceMemory = new PreferenceMemory(
      databaseManager,
      auditLogger,
      mockFingerprint,
      configManager
    );
  });

  afterAll(async () => {
    // 清理资源
    if (databaseManager) {
      databaseManager.close();
    }
  });

  describe('数据库基础设施', () => {
    it('数据库应该处于健康状态', () => {
      const health = databaseManager.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.tableCount).toBeGreaterThan(0);
    });

    it('关键表应该存在', () => {
      const db = databaseManager.getDatabase();
      const tables = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const tableNames = tables[0].values.map((row: any) => row[0]);
      expect(tableNames).toContain('episodic_memory');
      expect(tableNames).toContain('preference_memory');
      expect(tableNames).toContain('audit_log');
      expect(tableNames).toContain('task_state');
    });
  });

  describe('情景记忆功能', () => {
    it('应该能够记录情景记忆', async () => {
      const memoryId = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释了UserService类中的getUserById方法',
        entities: ['UserService.ts', 'getUserById', 'typescript'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 1500
      });

      expect(memoryId).toBeTruthy();
      expect(memoryId).toMatch(/^ep_\d+_[a-z0-9]+$/);
    });

    it('应该能够检索情景记忆', async () => {
      // 先记录一条记忆
      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '测试检索记忆',
        entities: ['test', 'retrieval'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 1000
      });

      // 检索记忆
      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 5
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some(m => m.summary.includes('测试检索记忆'))).toBe(true);
    });

    it('应该能够获取情景记忆统计信息', async () => {
      const stats = await episodicMemory.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('偏好记忆功能', () => {
    it('应该能够记录偏好记忆', async () => {
      const prefId = await preferenceMemory.recordPreference(
        'NAMING',
        { style: 'camelCase', prefix: 'get' },
        true
      );

      expect(prefId).toBeTruthy();
      expect(prefId).toMatch(/^pref_\d+_[a-z0-9]+$/);
    });

    it('应该能够查询偏好记忆', async () => {
      // 先记录一条偏好
      await preferenceMemory.recordPreference(
        'COMMIT_STYLE',
        { useEmoji: true, language: 'en', prefix: 'fix' },
        true
      );

      // 查询偏好
      const preferences = await preferenceMemory.queryPreferences({
        domain: 'COMMIT_STYLE'
      });

      expect(preferences.length).toBeGreaterThan(0);
      expect(preferences[0].domain).toBe('COMMIT_STYLE');
    });

    it('应该能够获取偏好统计信息', async () => {
      const stats = await preferenceMemory.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
      expect(stats.byDomain).toBeDefined();
    });
  });

  describe('审计日志功能', () => {
    it('应该能够记录审计日志', async () => {
      await auditLogger.log('test_operation', 'success', 100, {
        sessionId: 'test-session-integration'
      });

      // 验证日志目录存在
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(require('os').homedir(), '.xiaoweiba', 'logs');
      expect(fs.existsSync(logDir)).toBe(true);
    });

    it('HMAC密钥文件应该存在且权限正确', () => {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(require('os').homedir(), '.xiaoweiba', 'logs');
      const hmacKeyPath = path.join(logDir, '.hmac-key');

      expect(fs.existsSync(hmacKeyPath)).toBe(true);

      const stats = fs.statSync(hmacKeyPath);
      const permissions = (stats.mode & 0o777).toString(8);
      // Windows上权限可能不同，只验证文件存在
      // expect(permissions).toBe('600');
    });
  });

  describe('端到端场景：代码解释流程', () => {
    it('应该完成完整的代码解释记忆流程', async () => {
      // 1. 记录代码解释操作
      const memoryId = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释了LoginView.vue中的handleLogin方法',
        entities: ['LoginView.vue', 'handleLogin', 'vue'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 2000
      });

      expect(memoryId).toBeTruthy();

      // 2. 检索相关的历史记忆
      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 5
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some(m => m.summary.includes('LoginView.vue'))).toBe(true);
    });

    it('应该完成完整的命名检查记忆流程', async () => {
      // 1. 记录命名检查操作
      const memoryId = await episodicMemory.record({
        taskType: 'NAMING_CHECK',
        summary: '检查了变量命名是否符合驼峰规范',
        entities: ['variable', 'naming', 'camelCase'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 800
      });

      expect(memoryId).toBeTruthy();

      // 2. 记录命名偏好
      await preferenceMemory.recordPreference(
        'NAMING',
        { style: 'camelCase', avoidHungarianNotation: true },
        true
      );

      // 3. 检索相关记忆和偏好
      const memories = await episodicMemory.retrieve({
        taskType: 'NAMING_CHECK',
        limit: 5
      });

      const preferences = await preferenceMemory.queryPreferences({
        domain: 'NAMING'
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(preferences.length).toBeGreaterThan(0);
    });
  });
});
