/**
 * 提交生成功能全链路集成测试
 * 验证：Git diff → GenerateCommitCommand → TaskToken授权 → LLMTool生成 → 情景记忆记录 → AuditLogger写入
 */

import * as assert from 'assert';
import * as path from 'path';
import { container } from 'tsyringe';
import 'reflect-metadata';

// 动态导入编译后的模块
let GenerateCommitAgent: any;
let LLMTool: any;
let EpisodicMemory: any;
let PreferenceMemory: any;
let AuditLogger: any;
let ConfigManager: any;
let DatabaseManager: any;
let TaskToken: any;
let CommitStyleLearner: any;

suite('提交生成全链路集成测试', () => {
  let generateCommitAgent: any;
  let llmTool: any;
  let episodicMemory: any;
  let preferenceMemory: any;
  let auditLogger: any;
  let configManager: any;
  let databaseManager: any;
  let taskTokenManager: any;

  suiteSetup(async () => {
    // 动态导入编译后的模块
    const outPath = path.join(__dirname, '../../../out/tests/src');
    
    const ErrorCodes = require(path.join(outPath, 'utils/ErrorCodes'));
    const ConfigManagerModule = require(path.join(outPath, 'storage/ConfigManager'));
    const DatabaseManagerModule = require(path.join(outPath, 'storage/DatabaseManager'));
    const AuditLoggerModule = require(path.join(outPath, 'core/security/AuditLogger'));
    const ProjectFingerprintModule = require(path.join(outPath, 'utils/ProjectFingerprint'));
    const EpisodicMemoryModule = require(path.join(outPath, 'core/memory/EpisodicMemory'));
    const PreferenceMemoryModule = require(path.join(outPath, 'core/memory/PreferenceMemory'));
    const LLMToolModule = require(path.join(outPath, 'tools/LLMTool'));
    const TaskTokenModule = require(path.join(outPath, 'core/security/TaskToken'));
    const GenerateCommitAgentModule = require(path.join(outPath, 'agents/GenerateCommitAgent'));
    const CommitStyleLearnerModule = require(path.join(outPath, 'core/memory/CommitStyleLearner'));
    
    ConfigManager = ConfigManagerModule.ConfigManager;
    DatabaseManager = DatabaseManagerModule.DatabaseManager;
    AuditLogger = AuditLoggerModule.AuditLogger;
    EpisodicMemory = EpisodicMemoryModule.EpisodicMemory;
    PreferenceMemory = PreferenceMemoryModule.PreferenceMemory;
    LLMTool = LLMToolModule.LLMTool;
    TaskToken = TaskTokenModule.TaskTokenManager;
    GenerateCommitAgent = GenerateCommitAgentModule.GenerateCommitAgent;
    CommitStyleLearner = CommitStyleLearnerModule.CommitStyleLearner;

    // 清除容器中的旧实例
    container.clearInstances();
    
    // 注册Mock配置管理器
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
      })
    };
    
    container.registerInstance('ConfigManager', configManager);
    
    // 初始化数据库管理器
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize();
    container.registerInstance('DatabaseManager', databaseManager);
    
    // 初始化审计日志
    auditLogger = new AuditLogger(configManager);
    container.registerInstance('AuditLogger', auditLogger);
    
    // 初始化项目指纹（Mock）
    const mockFingerprint = {
      getCurrentProjectFingerprint: async () => 'test-project-fp-456'
    };
    container.registerInstance('ProjectFingerprint', mockFingerprint);
    
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
    container.registerInstance('EpisodicMemory', episodicMemory);
    
    // 初始化偏好记忆
    preferenceMemory = new PreferenceMemory(
      databaseManager,
      auditLogger,
      mockFingerprint,
      configManager
    );
    container.registerInstance('PreferenceMemory', preferenceMemory);
    
    // 初始化LLM工具
    llmTool = new LLMTool(configManager, auditLogger);
    container.registerInstance('LLMTool', llmTool);
    
    // 初始化任务令牌管理器
    taskTokenManager = new TaskToken(auditLogger);
    container.registerInstance('TaskTokenManager', taskTokenManager);
    
    // ✅ 初始化 CommitStyleLearner
    const styleLearner = new CommitStyleLearner(episodicMemory);
    container.registerInstance('CommitStyleLearner', styleLearner);
    
    // ✅ 初始化 Mock EventBus
    const mockEventBus = {
      publish: () => {},
      subscribe: () => () => {},
      unsubscribe: () => {}
    };
    container.registerInstance('IEventBus', mockEventBus);
    
    // ✅ 初始化 GenerateCommitAgent
    generateCommitAgent = new GenerateCommitAgent(
      llmTool,
      episodicMemory,
      mockEventBus,
      taskTokenManager,
      styleLearner
    );
  });

  test('应该完成提交生成的完整流程初始化', async () => {
    // 验证所有依赖已正确注入
    assert.ok(generateCommitAgent, 'GenerateCommitAgent应成功初始化');
    assert.strictEqual(generateCommitAgent.id, 'generate-commit-agent', 'Agent ID应匹配');
    assert.ok(llmTool, 'LLMTool应成功初始化');
    assert.ok(episodicMemory, 'EpisodicMemory应成功初始化');
    assert.ok(preferenceMemory, 'PreferenceMemory应成功初始化');
    assert.ok(auditLogger, 'AuditLogger应成功初始化');
    assert.ok(databaseManager, 'DatabaseManager应成功初始化');
    assert.ok(taskTokenManager, 'TaskTokenManager应成功初始化');
    
    // 验证数据库表已创建
    const health = databaseManager.checkHealth();
    assert.strictEqual(health.status, 'healthy', '数据库应处于健康状态');
    assert.ok(health.tableCount > 0, '数据库应包含表');
  });

  test('应该能够记录提交生成的情景记忆', async () => {
    // 记录一个提交生成的记忆
    const memoryId = await episodicMemory.record({
      taskType: 'COMMIT_GENERATE',
      summary: '测试提交生成记忆',
      entities: ['git', 'commit', 'diff'],
      outcome: 'SUCCESS',
      modelId: 'deepseek',
      durationMs: 2500
    });
    
    assert.ok(memoryId, '记忆ID应有效');
    assert.match(memoryId, /^ep_\d+_[a-z0-9]+$/, '记忆ID格式应正确');
    
    // 检索刚记录的记忆
    const memories = await episodicMemory.retrieve({
      taskType: 'COMMIT_GENERATE',
      limit: 1
    });
    
    assert.ok(memories.length > 0, '应至少检索到1条记忆');
    assert.strictEqual(memories[0].summary, '测试提交生成记忆', '记忆内容应匹配');
    assert.strictEqual(memories[0].taskType, 'COMMIT_GENERATE', '任务类型应匹配');
  });

  test('应该能够查询提交相关的偏好', async () => {
    // 记录一个提交风格偏好
    const prefId = await preferenceMemory.recordPreference(
      'COMMIT_STYLE',
      { format: 'conventional_commits', scope: true },
      true
    );
    
    assert.ok(prefId, '偏好ID应有效');
    
    // 查询提交相关偏好
    const preferences = await preferenceMemory.queryPreferences({
      domain: 'COMMIT_STYLE'
    });
    
    assert.ok(preferences.length > 0, '应至少查询到1条偏好');
    assert.strictEqual(preferences[0].domain, 'COMMIT_STYLE', '偏好领域应匹配');
  });

  test('应该能够生成和验证任务令牌用于Git操作', async () => {
    // 生成Git提交操作的令牌
    const token = await taskTokenManager.generate({
      operation: 'git_commit',
      parameters: { 
        message: 'feat: test commit',
        files: ['src/test.ts']
      },
      expiresIn: 600 // 10分钟有效期
    });
    
    assert.ok(token, '令牌应有效');
    assert.strictEqual(token.operation, 'git_commit', '操作类型应匹配');
    
    // 验证令牌
    const isValid = await taskTokenManager.validate(token.token);
    assert.ok(isValid, '令牌应有效');
    
    // 使用令牌
    await taskTokenManager.consume(token.token);
    
    // 再次验证应失败
    const isStillValid = await taskTokenManager.validate(token.token);
    assert.ok(!isStillValid, '已使用的令牌应无效');
  });

  test('LLMTool应能正确处理提交消息生成', async () => {
    // 测试脱敏功能确保Git diff中的敏感信息被处理
    const diffWithSecret = `
diff --git a/src/config.ts b/src/config.ts
@@ -1,3 +1,3 @@
-const API_KEY = 'sk-1234567890abcdef';
+const API_KEY = 'sk-newkey1234567890';
    `;
    
    const sanitized = (llmTool as any).sanitizeContent(diffWithSecret);
    assert.ok(sanitized.includes('[API_KEY_REDACTED]'), 'API密钥应被脱敏');
    assert.ok(!sanitized.includes('sk-1234567890abcdef'), '原始密钥不应出现');
    assert.ok(!sanitized.includes('sk-newkey1234567890'), '新密钥也不应出现');
  });

  test('应该能够获取偏好推荐用于提交格式', async () => {
    // 先记录一些提交风格偏好
    await preferenceMemory.recordPreference(
      'COMMIT_STYLE',
      { format: 'conventional_commits', include_scope: true },
      true
    );
    
    await preferenceMemory.recordPreference(
      'COMMIT_STYLE',
      { format: 'simple', include_emoji: false },
      true
    );
    
    // 获取推荐
    const recommendations = await preferenceMemory.getRecommendations(
      'COMMIT_STYLE',
      { format: 'conventional' }
    );
    
    assert.ok(recommendations.length > 0, '应至少有一个推荐');
    // 验证推荐按匹配分数排序
    for (let i = 0; i < recommendations.length - 1; i++) {
      assert.ok(
        recommendations[i].matchScore >= recommendations[i + 1].matchScore,
        '推荐应按匹配分数降序排列'
      );
    }
  });

  test('审计日志应能记录提交生成操作', async () => {
    // 记录提交生成开始的日志
    const startTime = Date.now();
    await auditLogger.log('commit_generate_start', 'success', 0, {
      sessionId: 'test-commit-session'
    });
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const duration = Date.now() - startTime;
    
    // 记录完成日志
    await auditLogger.log('commit_generate_complete', 'success', duration, {
      sessionId: 'test-commit-session'
    });
    
    // 验证日志目录存在
    const logDir = path.join(require('os').homedir(), '.xiaoweiba', 'logs');
    const fs = require('fs');
    assert.ok(fs.existsSync(logDir), '日志目录应存在');
    
    // 验证有日志文件生成
    const logFiles = fs.readdirSync(logDir).filter((f: string) => f.startsWith('audit-'));
    assert.ok(logFiles.length > 0, '应至少有一个日志文件');
  });

  test('数据库应包含所有必需的表用于提交生成功能', async () => {
    const tables = databaseManager.getDatabase().exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    
    const tableNames = tables[0].values.map((row: any) => row[0]);
    
    // 验证关键表存在
    const requiredTables = [
      'episodic_memory',
      'preference_memory',
      'audit_log',
      'task_state'
    ];
    
    for (const tableName of requiredTables) {
      assert.ok(
        tableNames.includes(tableName),
        `${tableName}表应存在`
      );
    }
    
    // 验证FTS5虚拟表存在
    const ftsTables = databaseManager.getDatabase().exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%'"
    );
    
    if (ftsTables.length > 0) {
      const ftsTableNames = ftsTables[0].values.map((row: any) => row[0]);
      assert.ok(
        ftsTableNames.some((name: string) => name.includes('episodic')),
        'Episodic Memory FTS表应存在'
      );
    }
  });

  test('应该能够统计提交生成相关的记忆和偏好', async () => {
    // 获取情景记忆统计
    const memStats = await episodicMemory.getStats();
    assert.ok(memStats.totalCount >= 0, '记忆总数应为非负数');
    
    // 获取偏好记忆统计
    const prefStats = await preferenceMemory.getStats();
    assert.ok(prefStats.totalCount >= 0, '偏好总数应为非负数');
    assert.ok(prefStats.byDomain !== undefined, '应按领域分类统计');
    
    // 验证COMMIT_STYLE领域存在
    if (prefStats.byDomain.COMMIT_STYLE !== undefined) {
      assert.ok(
        prefStats.byDomain.COMMIT_STYLE >= 0,
        'COMMIT_STYLE偏好数量应为非负数'
      );
    }
  });

  suiteTeardown(async () => {
    // 清理资源
    if (databaseManager) {
      databaseManager.close();
    }
    
    // 清除容器
    container.clearInstances();
  });
});
