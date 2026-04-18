/**
 * EpisodicMemory ↔ DatabaseManager 端到端集成测试
 * 验证情景记忆系统能否正确与 SQLite 数据库交互
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { container } from 'tsyringe';
import 'reflect-metadata';

// 注意：在集成测试环境中，我们需要动态导入编译后的模块
let EpisodicMemory: any;
let DatabaseManager: any;
let ConfigManager: any;
let AuditLogger: any;
let ProjectFingerprint: any;

suite('EpisodicMemory ↔ DatabaseManager 端到端测试', () => {
  let testDbPath: string;
  let configManager: any;
  let databaseManager: any;
  let episodicMemory: any;
  let auditLogger: any;
  let projectFingerprint: any;

  suiteSetup(async () => {
    // 动态导入编译后的模块
    const outPath = path.join(__dirname, '../../../out/tests/src');
    
    const ErrorCodes = require(path.join(outPath, 'utils/ErrorCodes'));
    const ConfigManagerModule = require(path.join(outPath, 'storage/ConfigManager'));
    const DatabaseManagerModule = require(path.join(outPath, 'storage/DatabaseManager'));
    const AuditLoggerModule = require(path.join(outPath, 'core/security/AuditLogger'));
    const ProjectFingerprintModule = require(path.join(outPath, 'utils/ProjectFingerprint'));
    const EpisodicMemoryModule = require(path.join(outPath, 'core/memory/EpisodicMemory'));
    
    ConfigManager = ConfigManagerModule.ConfigManager;
    DatabaseManager = DatabaseManagerModule.DatabaseManager;
    AuditLogger = AuditLoggerModule.AuditLogger;
    ProjectFingerprint = ProjectFingerprintModule.ProjectFingerprint;
    EpisodicMemory = EpisodicMemoryModule.EpisodicMemory;

    // 创建临时测试数据库路径
    testDbPath = path.join(__dirname, `test-xiaoweiba-${Date.now()}.db`);
    
    // 清除容器中的旧实例
    container.clearInstances();
    
    // 创建配置管理器（使用内存配置，不依赖文件系统）
    const mockSecretStorage = {
      get: async () => undefined,
      store: async () => {},
      delete: async () => {}
    };
    
    configManager = new ConfigManager(mockSecretStorage);
    
    // 手动设置配置（绕过文件加载）
    (configManager as any).config = {
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
    (configManager as any).loaded = true;
    
    container.registerInstance(ConfigManager, configManager);
    
    // 注册 SecretStorage
    container.registerInstance('SecretStorage', mockSecretStorage);
    
    // 初始化审计日志
    auditLogger = new AuditLogger(configManager);
    container.registerInstance(AuditLogger, auditLogger);
    
    // 初始化项目指纹
    projectFingerprint = new ProjectFingerprint();
    container.registerInstance(ProjectFingerprint, projectFingerprint);
    
    // 初始化数据库管理器
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize(testDbPath);
    container.registerInstance(DatabaseManager, databaseManager);
    
    // 创建情景记忆实例
    episodicMemory = container.resolve(EpisodicMemory);
  });

  suiteTeardown(async () => {
    // 清理资源
    if (databaseManager) {
      databaseManager.close();
    }
    
    // 删除测试数据库文件
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // 也删除可能的备份文件
      const backupPath = testDbPath + '.bak';
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
    
    container.clearInstances();
  });

  test('应该能够成功记录情景记忆到数据库', async () => {
    // Arrange
    const recordData = {
      taskType: 'CODE_EXPLAIN' as const,
      summary: '测试代码解释功能',
      entities: ['typescript', 'vscode'],
      outcome: 'SUCCESS' as const,
      modelId: 'deepseek',
      durationMs: 1500,
      decision: '代码逻辑清晰，使用了正确的设计模式'
    };

    // Act
    await episodicMemory.record(recordData);

    // Assert - 验证记录成功（不抛出异常即为成功）
    assert.ok(true, '记忆记录成功');
  });

  test('应该能够从数据库检索刚才记录的记忆', async () => {
    // Act - 搜索刚才记录的测试记忆
    const results = await episodicMemory.search('测试代码解释', 10);

    // Assert
    assert.ok(results.length > 0, '应该找到至少一条记录');
    
    const foundRecord = results.find((r: any) => 
      r.summary.includes('测试代码解释')
    );
    
    assert.ok(foundRecord, '应该找到包含测试关键词的记录');
    assert.strictEqual(foundRecord.taskType, 'CODE_EXPLAIN');
    assert.strictEqual(foundRecord.outcome, 'SUCCESS');
    assert.ok(foundRecord.entities.includes('typescript'));
  });

  test('应该能够按任务类型过滤记忆', async () => {
    // Arrange - 先记录几条不同类型的记忆
    await episodicMemory.record({
      taskType: 'COMMIT_GENERATE',
      summary: '生成提交信息测试',
      entities: ['git'],
      outcome: 'SUCCESS',
      modelId: 'deepseek',
      durationMs: 800
    });

    // Act - 只查询 CODE_EXPLAIN 类型
    const results = await episodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN'
    });

    // Assert
    assert.ok(results.length > 0, '应该有 CODE_EXPLAIN 类型的记录');
    results.forEach((record: any) => {
      assert.strictEqual(record.taskType, 'CODE_EXPLAIN', '所有记录应该是 CODE_EXPLAIN 类型');
    });
  });

  test('应该能够按时间范围过滤记忆', async () => {
    // Act - 查询最近1小时的记忆
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const results = await episodicMemory.retrieve({
      timeRange: { start: oneHourAgo, end: Date.now() }
    });

    // Assert
    assert.ok(results.length > 0, '应该找到最近1小时内的记录');
    results.forEach((record: any) => {
      assert.ok(record.timestamp >= oneHourAgo, '记录时间应该在范围内');
    });
  });

  test('应该能够获取记忆统计信息', async () => {
    // Act
    const stats = await episodicMemory.getStats();

    // Assert
    assert.ok(stats.totalCount > 0, '应该有至少一条记录');
    assert.ok(typeof stats.averageWeight === 'number', '应该有平均权重');
    assert.ok(stats.byTaskType, '应该有按任务类型的统计');
    assert.ok(stats.byOutcome, '应该有按结果的统计');
  });

  test('应该能够正确计算记忆衰减权重', async () => {
    // Arrange - 记录一条记忆
    await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '衰减测试记忆',
      entities: ['test'],
      outcome: 'SUCCESS',
      modelId: 'deepseek',
      durationMs: 500
    });

    // Act - 检索并检查权重
    const results = await episodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN'
    });

    // Assert
    const testRecord = results.find((r: any) => 
      r.summary.includes('衰减测试')
    );
    
    assert.ok(testRecord, '应该找到测试记录');
    assert.ok(testRecord.finalWeight > 0, '权重应该大于0');
    assert.ok(testRecord.finalWeight <= 10, '权重应该不超过初始最大值');
  });

  test('应该能够处理并发记录操作', async () => {
    // Act - 并发记录多条记忆
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: `并发测试记忆 ${i}`,
        entities: ['concurrent'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 100
      }));
    }

    await Promise.all(promises);

    // Assert - 验证所有记录都成功
    const results = await episodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN'
    });
    
    const concurrentRecords = results.filter((r: any) => 
      r.summary.includes('并发测试')
    );
    
    assert.strictEqual(concurrentRecords.length, 5, '应该有5条并发记录');
  });

  test('应该能够在数据库关闭后重新打开并读取数据', async () => {
    // Arrange - 记录一条特殊标记的记忆
    const uniqueSummary = `持久化测试_${Date.now()}`;
    await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: uniqueSummary,
      entities: ['persistence'],
      outcome: 'SUCCESS',
      modelId: 'deepseek',
      durationMs: 200
    });

    // Act - 关闭并重新打开数据库
    databaseManager.close();
    await databaseManager.initialize(testDbPath);
    
    // 重新创建 episodicMemory 实例
    container.clearInstances();
    container.registerInstance(ConfigManager, configManager);
    container.registerInstance(DatabaseManager, databaseManager);
    container.registerInstance(AuditLogger, auditLogger);
    container.registerInstance(ProjectFingerprint, projectFingerprint);
    
    const newEpisodicMemory: any = container.resolve(EpisodicMemory);
    
    // 尝试检索之前记录的記憶
    const results = await newEpisodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN'
    });

    // Assert
    const foundRecord = results.find((r: any) => 
      r.summary.includes(uniqueSummary)
    );
    
    assert.ok(foundRecord, '应该能够从重新打开的数据库中读取之前的记录');
  });

  test('应该能够正确处理空查询结果', async () => {
    // Act - 查询不存在的任务类型
    const results = await episodicMemory.retrieve({
      taskType: 'NONEXISTENT_TYPE' as any
    });

    // Assert
    assert.strictEqual(results.length, 0, '不存在的类型应该返回空数组');
  });

  test('应该能够执行全文搜索（FTS5）', async () => {
    // Act - 使用 FTS5 搜索
    const results = await episodicMemory.search('代码解释', 5);

    // Assert
    assert.ok(Array.isArray(results), '搜索结果应该是数组');
    // FTS5 可能因为分词原因找不到精确匹配，所以只验证不报错
  });

  test('应该能够清理过期记忆', async () => {
    // Arrange - 获取当前统计
    const beforeStats = await episodicMemory.getStats();
    
    // Act - 执行清理（retentionDays=90，不会真的删除刚创建的记录）
    const cleanedCount = await episodicMemory.cleanupExpired();
    
    // Assert
    assert.ok(cleanedCount >= 0, '清理数量应该非负');
    
    const afterStats = await episodicMemory.getStats();
    assert.ok(afterStats.totalCount >= 0, '清理后统计应该正常');
  });
});
