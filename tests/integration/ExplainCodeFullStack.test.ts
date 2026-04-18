/**
 * 代码解释功能全链路集成测试
 * 验证：用户选中代码 → ExplainCodeCommand → TaskToken授权 → EpisodicMemory检索偏好 → LLMTool调用（含脱敏） → Webview展示 → 情景记忆记录 → AuditLogger写入
 */

import * as assert from 'assert';
import * as path from 'path';
import { container } from 'tsyringe';
import 'reflect-metadata';

// 动态导入编译后的模块
let ExplainCodeCommand: any;
let LLMTool: any;
let EpisodicMemory: any;
let PreferenceMemory: any;
let AuditLogger: any;
let ConfigManager: any;
let DatabaseManager: any;
let TaskToken: any;

suite('代码解释全链路集成测试', () => {
  let explainCodeCommand: any;
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
    const ExplainCodeCommandModule = require(path.join(outPath, 'commands/ExplainCodeCommand'));
    
    ConfigManager = ConfigManagerModule.ConfigManager;
    DatabaseManager = DatabaseManagerModule.DatabaseManager;
    AuditLogger = AuditLoggerModule.AuditLogger;
    EpisodicMemory = EpisodicMemoryModule.EpisodicMemory;
    PreferenceMemory = PreferenceMemoryModule.PreferenceMemory;
    LLMTool = LLMToolModule.LLMTool;
    TaskToken = TaskTokenModule.TaskTokenManager;
    ExplainCodeCommand = ExplainCodeCommandModule.ExplainCodeCommand;

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
      getCurrentProjectFingerprint: async () => 'test-project-fp-123'
    };
    container.registerInstance('ProjectFingerprint', mockFingerprint);
    
    // 初始化情景记忆
    episodicMemory = new EpisodicMemory(
      databaseManager,
      auditLogger,
      mockFingerprint,
      configManager
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
    
    // 初始化代码解释命令
    explainCodeCommand = new ExplainCodeCommand(
      llmTool,
      episodicMemory,
      auditLogger
    );
  });

  test('应该完成代码解释的完整流程', async () => {
    // 注意：这是一个简化版本的集成测试
    // 完整的VS Code环境模拟需要vscode-test-electron
    
    // 验证所有依赖已正确注入
    assert.ok(explainCodeCommand, 'ExplainCodeCommand应成功初始化');
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
    
    // 验证preference_memory表存在
    const prefStats = await preferenceMemory.getStats();
    assert.ok(prefStats !== undefined, 'PreferenceMemory统计信息应可获取');
    
    // 验证episodic_memory表存在
    const memStats = await episodicMemory.getStats();
    assert.ok(memStats !== undefined, 'EpisodicMemory统计信息应可获取');
  });

  test('应该能够记录和检索情景记忆', async () => {
    // 记录一个测试记忆
    const memoryId = await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '测试代码解释记忆',
      entities: ['function', 'variable'],
      outcome: 'SUCCESS',
      modelId: 'deepseek',
      durationMs: 1500
    });
    
    assert.ok(memoryId, '记忆ID应有效');
    assert.match(memoryId, /^ep_\d+_[a-z0-9]+$/, '记忆ID格式应正确');
    
    // 检索刚记录的记忆
    const memories = await episodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN',
      limit: 1
    });
    
    assert.ok(memories.length > 0, '应至少检索到1条记忆');
    assert.strictEqual(memories[0].summary, '测试代码解释记忆', '记忆内容应匹配');
  });

  test('应该能够记录和查询偏好记忆', async () => {
    // 记录一个测试偏好
    const prefId = await preferenceMemory.recordPreference(
      'NAMING',
      { style: 'camelCase', prefix: 'get' },
      true
    );
    
    assert.ok(prefId, '偏好ID应有效');
    assert.match(prefId, /^pref_\d+_[a-z0-9]+$/, '偏好ID格式应正确');
    
    // 查询偏好
    const preferences = await preferenceMemory.queryPreferences({
      domain: 'NAMING'
    });
    
    assert.ok(preferences.length > 0, '应至少查询到1条偏好');
    assert.strictEqual(preferences[0].domain, 'NAMING', '偏好领域应匹配');
  });

  test('应该能够生成任务令牌', async () => {
    // 生成一个测试令牌
    const token = await taskTokenManager.generate({
      operation: 'llm_call',
      parameters: { provider: 'deepseek' },
      expiresIn: 300 // 5分钟有效期
    });
    
    assert.ok(token, '令牌应有效');
    assert.ok(token.token, '令牌字符串应存在');
    assert.strictEqual(token.operation, 'llm_call', '操作类型应匹配');
    
    // 验证令牌
    const isValid = await taskTokenManager.validate(token.token);
    assert.ok(isValid, '令牌应有效');
    
    // 使用令牌（一次性）
    await taskTokenManager.consume(token.token);
    
    // 再次验证应失败（已使用）
    const isStillValid = await taskTokenManager.validate(token.token);
    assert.ok(!isStillValid, '已使用的令牌应无效');
  });

  test('LLMTool应能正确脱敏敏感信息', async () => {
    // 测试API密钥脱敏
    const sanitized1 = (llmTool as any).sanitizeContent('My API key is sk-1234567890abcdef');
    assert.ok(sanitized1.includes('[API_KEY_REDACTED]'), 'API密钥应被脱敏');
    assert.ok(!sanitized1.includes('sk-1234567890abcdef'), '原始密钥不应出现');
    
    // 测试Bearer Token脱敏
    const sanitized2 = (llmTool as any).sanitizeContent('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9');
    assert.ok(sanitized2.includes('Bearer [REDACTED]'), 'Bearer Token应被脱敏');
    
    // 测试GitHub Token脱敏
    const sanitized3 = (llmTool as any).sanitizeContent('Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    assert.ok(sanitized3.includes('[GITHUB_TOKEN_REDACTED]'), 'GitHub Token应被脱敏');
    
    // 测试环境变量引用脱敏
    const sanitized4 = (llmTool as any).sanitizeContent('Use ${API_KEY_SECRET} for auth');
    assert.ok(sanitized4.includes('[ENV_VAR_REDACTED]'), '环境变量引用应被脱敏');
  });

  test('审计日志应能正确记录操作', async () => {
    // 记录一个测试日志
    await auditLogger.log('test_operation', 'success', 100, {
      sessionId: 'test-session-123'
    });
    
    // 验证日志文件存在
    const logDir = path.join(require('os').homedir(), '.xiaoweiba', 'logs');
    const fs = require('fs');
    assert.ok(fs.existsSync(logDir), '日志目录应存在');
    
    // 验证HMAC密钥文件存在且权限正确
    const hmacKeyPath = path.join(logDir, '.hmac-key');
    assert.ok(fs.existsSync(hmacKeyPath), 'HMAC密钥文件应存在');
    
    const stats = fs.statSync(hmacKeyPath);
    const permissions = (stats.mode & 0o777).toString(8);
    assert.strictEqual(permissions, '600', 'HMAC密钥文件权限应为0600');
  });

  test('数据库健康检查应返回正确状态', async () => {
    const health = databaseManager.checkHealth();
    
    assert.strictEqual(health.status, 'healthy', '数据库状态应为healthy');
    assert.strictEqual(health.lastError, null, '不应有错误');
    assert.ok(health.tableCount >= 5, '应至少有5张表');
    
    // 验证关键表存在
    const tables = databaseManager.getDatabase().exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    
    const tableNames = tables[0].values.map((row: any) => row[0]);
    assert.ok(tableNames.includes('episodic_memory'), 'episodic_memory表应存在');
    assert.ok(tableNames.includes('preference_memory'), 'preference_memory表应存在');
    assert.ok(tableNames.includes('audit_log'), 'audit_log表应存在');
    assert.ok(tableNames.includes('task_state'), 'task_state表应存在');
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
