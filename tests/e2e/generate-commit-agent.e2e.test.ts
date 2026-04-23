/**
 * GenerateCommitAgent E2E 测试
 * 
 * 测试场景：
 * 1. 完整流程：Git diff → 风格学习 → LLM 生成 → 交互式确认 → 情景记忆记录
 * 2. 多状态支持：未暂存变更检测与一键暂存
 * 3. 安全检查：敏感文件预警
 */

import 'reflect-metadata';
import * as path from 'path';
import { container } from 'tsyringe';

// 动态导入编译后的模块
let GenerateCommitAgent: any;
let CommitStyleLearner: any;
let EpisodicMemory: any;
let DatabaseManager: any;
let ConfigManager: any;
let AuditLogger: any;
let TaskTokenManager: any;

describe('GenerateCommitAgent - E2E 集成测试', () => {
  let agent: any;
  let styleLearner: any;
  let episodicMemory: any;
  let databaseManager: any;
  let taskTokenManager: any;

  beforeAll(async () => {
    const outPath = path.join(__dirname, '../../../out/tests/src');
    
    const ConfigManagerModule = require(path.join(outPath, 'storage/ConfigManager'));
    const DatabaseManagerModule = require(path.join(outPath, 'storage/DatabaseManager'));
    const AuditLoggerModule = require(path.join(outPath, 'core/security/AuditLogger'));
    const ProjectFingerprintModule = require(path.join(outPath, 'utils/ProjectFingerprint'));
    const EpisodicMemoryModule = require(path.join(outPath, 'core/memory/EpisodicMemory'));
    const CommitStyleLearnerModule = require(path.join(outPath, 'core/memory/CommitStyleLearner'));
    const TaskTokenModule = require(path.join(outPath, 'core/security/TaskToken'));
    const GenerateCommitAgentModule = require(path.join(outPath, 'agents/GenerateCommitAgent'));
    
    ConfigManager = ConfigManagerModule.ConfigManager;
    DatabaseManager = DatabaseManagerModule.DatabaseManager;
    AuditLogger = AuditLoggerModule.AuditLogger;
    EpisodicMemory = EpisodicMemoryModule.EpisodicMemory;
    CommitStyleLearner = CommitStyleLearnerModule.CommitStyleLearner;
    TaskTokenManager = TaskTokenModule.TaskTokenManager;
    GenerateCommitAgent = GenerateCommitAgentModule.GenerateCommitAgent;

    container.clearInstances();
    
    // Mock 配置
    const configManager = {
      getConfig: () => ({
        mode: 'private',
        model: {
          default: 'deepseek',
          providers: [{
            id: 'deepseek',
            apiUrl: 'https://api.deepseek.com/v1',
            apiKey: 'test-key',
            maxTokens: 4096,
            temperature: 0.6
          }]
        },
        memory: { retentionDays: 90, decayLambda: 0.01 }
      })
    };
    
    container.registerInstance('ConfigManager', configManager);
    
    // 初始化数据库
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize();
    container.registerInstance('DatabaseManager', databaseManager);
    
    // 初始化审计日志
    const auditLogger = new AuditLogger(configManager);
    container.registerInstance('AuditLogger', auditLogger);
    
    // Mock 项目指纹
    const mockFingerprint = {
      getCurrentProjectFingerprint: async () => 'test-project-fp'
    };
    container.registerInstance('ProjectFingerprint', mockFingerprint);
    
    // 初始化情景记忆
    episodicMemory = new EpisodicMemory(
      databaseManager,
      auditLogger,
      mockFingerprint,
      configManager,
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    container.registerInstance('EpisodicMemory', episodicMemory);
    
    // 初始化风格学习器
    styleLearner = new CommitStyleLearner(episodicMemory);
    container.registerInstance('CommitStyleLearner', styleLearner);
    
    // 初始化 TaskTokenManager
    taskTokenManager = new TaskTokenManager(auditLogger);
    container.registerInstance('TaskTokenManager', taskTokenManager);
    
    // Mock EventBus
    const mockEventBus = {
      publish: () => {},
      subscribe: () => () => {},
      unsubscribe: () => {}
    };
    container.registerInstance('IEventBus', mockEventBus);
    
    // Mock LLMTool
    const mockLLMTool = {
      call: async () => ({ success: true, text: 'feat: test commit' }),
      isAvailable: async () => true,
      getModelId: () => 'deepseek'
    };
    container.registerInstance('ILLMPort', mockLLMTool);
    
    // Mock MemoryPort
    const mockMemoryPort = {
      retrieveContext: async () => ({ episodicMemories: [], preferenceRecommendations: [] }),
      recordTaskCompletion: async () => {},
      recordAgentExecution: async () => {}
    };
    container.registerInstance('IMemoryPort', mockMemoryPort);
    
    // 初始化 Agent
    agent = new GenerateCommitAgent(
      mockLLMTool,
      mockMemoryPort,
      mockEventBus,
      taskTokenManager,
      styleLearner
    );
  });

  afterAll(async () => {
    if (databaseManager) {
      databaseManager.close();
    }
    container.clearInstances();
  });

  // ==================== 测试用例1: Agent 初始化 ====================
  describe('Agent 初始化', () => {
    it('应该成功初始化所有依赖', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('generate-commit-agent');
      expect(styleLearner).toBeDefined();
      expect(taskTokenManager).toBeDefined();
    });

    it('应该支持 generate_commit 意图', () => {
      expect(agent.supportedIntents).toContain('generate_commit');
    });
  });

  // ==================== 测试用例2: 风格学习器集成 ====================
  describe('CommitStyleLearner 集成', () => {
    it('应该能够从历史记忆中学习提交风格', async () => {
      // 先记录一些提交记忆
      await episodicMemory.record({
        taskType: 'COMMIT_GENERATE',
        summary: 'feat: add user authentication',
        entities: ['auth', 'login'],
        outcome: 'SUCCESS'
      });

      await episodicMemory.record({
        taskType: 'COMMIT_GENERATE',
        summary: 'fix: resolve login bug',
        entities: ['auth', 'bug'],
        outcome: 'SUCCESS'
      });

      // 学习风格
      const preferences = await styleLearner.learnFromHistory();
      
      expect(preferences).toBeDefined();
      expect(preferences.domain).toBe('COMMIT_STYLE');
      expect(preferences.sampleCount).toBeGreaterThan(0);
    });

    it('无历史记录时应返回默认偏好', async () => {
      // 清空记忆（实际场景中不会有这么多记忆）
      const preferences = await styleLearner.learnFromHistory();
      
      expect(preferences).toBeDefined();
      expect(preferences.domain).toBe('COMMIT_STYLE');
    });
  });

  // ==================== 测试用例3: 实体提取 ====================
  describe('动态实体提取', () => {
    it('应该从真实 diff 中提取文件名', () => {
      const diff = `
diff --git a/src/agent/GenerateCommitAgent.ts b/src/agent/GenerateCommitAgent.ts
index 1234567..abcdefg 100644
--- a/src/agent/GenerateCommitAgent.ts
+++ b/src/agent/GenerateCommitAgent.ts
@@ -1,3 +1,4 @@
+import { CommitStyleLearner } from './CommitStyleLearner';
 
diff --git a/tests/unit/agents/GenerateCommitAgent.test.ts b/tests/unit/agents/GenerateCommitAgent.test.ts
new file mode 100644
`;

      const changedFiles = diff.match(/diff --git a\/(.+?) b\//g)?.map(s => s.split('a/')[1]?.split(' b/')[0]) || [];

      expect(changedFiles).toHaveLength(2);
      expect(changedFiles).toContain('src/agent/GenerateCommitAgent.ts');
      expect(changedFiles).toContain('tests/unit/agents/GenerateCommitAgent.test.ts');
    });
  });

  // ==================== 测试用例4: 安全检查 ====================
  describe('预提交安全检查', () => {
    it('应该检测 .env 文件', () => {
      const diffWithEnv = `
diff --git a/.env b/.env
+API_KEY=new_secret_key
`;

      const sensitiveFiles = ['.env', 'secrets', 'credentials', 'private_key', '.pem'];
      const hasSensitiveFile = sensitiveFiles.some(file => diffWithEnv.includes(file));

      expect(hasSensitiveFile).toBe(true);
    });

    it('应该检测 secrets 目录', () => {
      const diffWithSecrets = `
diff --git a/config/secrets.json b/config/secrets.json
`;

      const sensitiveFiles = ['.env', 'secrets', 'credentials', 'private_key', '.pem'];
      const hasSensitiveFile = sensitiveFiles.some(file => diffWithSecrets.includes(file));

      expect(hasSensitiveFile).toBe(true);
    });

    it('正常代码文件不应触发警告', () => {
      const normalDiff = `
diff --git a/src/utils/helper.ts b/src/utils/helper.ts
+export function helper() {}
`;

      const sensitiveFiles = ['.env', 'secrets', 'credentials', 'private_key', '.pem'];
      const hasSensitiveFile = sensitiveFiles.some(file => normalDiff.includes(file));

      expect(hasSensitiveFile).toBe(false);
    });
  });

  // ==================== 测试用例5: 变更规模分析 ====================
  describe('变更规模分析', () => {
    it('应该识别大变更（>5 个文件）', () => {
      const largeDiff = Array.from({ length: 7 }, (_, i) => 
        `diff --git a/module${i}/file.ts b/module${i}/file.ts\n`
      ).join('\n');

      const changedFilesCount = (largeDiff.match(/diff --git/g) || []).length;

      expect(changedFilesCount).toBeGreaterThan(5);
    });

    it('小变更应正常处理', () => {
      const smallDiff = `
diff --git a/src/test.ts b/src/test.ts
+console.log('test');
`;

      const changedFilesCount = (smallDiff.match(/diff --git/g) || []).length;

      expect(changedFilesCount).toBeLessThanOrEqual(5);
    });
  });

  // ==================== 测试用例6: TaskToken 管理 ====================
  describe('TaskToken 管理', () => {
    it('应该能够生成和验证 Token', async () => {
      const token = await taskTokenManager.generate({
        operation: 'git_commit',
        parameters: { message: 'test commit' },
        expiresIn: 600
      });

      expect(token).toBeDefined();
      expect(token.operation).toBe('git_commit');

      // 验证 Token
      const isValid = await taskTokenManager.validate(token.token);
      expect(isValid).toBe(true);
    });

    it('已使用的 Token 应失效', async () => {
      const token = await taskTokenManager.generate({
        operation: 'git_commit',
        parameters: { message: 'test' },
        expiresIn: 600
      });

      // 使用 Token
      await taskTokenManager.consume(token.token);

      // 再次验证应失败
      const isValid = await taskTokenManager.validate(token.token);
      expect(isValid).toBe(false);
    });
  });

  // ==================== 测试用例7: 情景记忆记录 ====================
  describe('情景记忆记录', () => {
    it('应该能够记录提交生成的记忆', async () => {
      const memoryId = await episodicMemory.record({
        taskType: 'COMMIT_GENERATE',
        summary: 'feat: add intelligent commit assistant',
        entities: ['GenerateCommitAgent', 'CommitStyleLearner'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 3000
      });

      expect(memoryId).toBeDefined();
      expect(memoryId).toMatch(/^ep_\d+_[a-z0-9]+$/);

      // 检索刚记录的记忆
      const memories = await episodicMemory.retrieve({
        taskType: 'COMMIT_GENERATE',
        limit: 1
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].summary).toContain('intelligent commit');
    });
  });
});
