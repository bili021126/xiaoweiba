/**
 * Agent 调度全流程 E2E 测试
 * 
 * 测试场景：
 * 1. IntentDispatcher → AgentRunner → Agent 执行完整链路
 * 2. 事件发布与订阅验证
 * 3. 记忆记录与检索验证
 */

import 'reflect-metadata';
import * as path from 'path';
import { container } from 'tsyringe';

let IntentDispatcher: any;
let AgentRunner: any;
let AgentRegistryImpl: any;
let EventBus: any;
let DatabaseManager: any;
let ConfigManager: any;
let AuditLogger: any;
let TaskTokenManager: any;
let EpisodicMemory: any;

describe('Agent 调度全流程 E2E 测试', () => {
  let intentDispatcher: any;
  let agentRunner: any;
  let agentRegistry: any;
  let eventBus: any;
  let databaseManager: any;
  let episodicMemory: any;

  beforeAll(async () => {
    const outPath = path.join(__dirname, '../../../out/tests/src');

    const ConfigManagerModule = require(path.join(outPath, 'storage/ConfigManager'));
    const DatabaseManagerModule = require(path.join(outPath, 'storage/DatabaseManager'));
    const AuditLoggerModule = require(path.join(outPath, 'core/security/AuditLogger'));
    const ProjectFingerprintModule = require(path.join(outPath, 'utils/ProjectFingerprint'));
    const EpisodicMemoryModule = require(path.join(outPath, 'core/memory/EpisodicMemory'));
    const TaskTokenModule = require(path.join(outPath, 'core/security/TaskToken'));
    const AgentRegistryModule = require(path.join(outPath, 'infrastructure/agent/AgentRegistryImpl'));
    const EventBusModule = require(path.join(outPath, 'core/eventbus/EventBus'));
    const IntentDispatcherModule = require(path.join(outPath, 'core/application/IntentDispatcher'));
    const AgentRunnerModule = require(path.join(outPath, 'infrastructure/agent/AgentRunner'));

    ConfigManager = ConfigManagerModule.ConfigManager;
    DatabaseManager = DatabaseManagerModule.DatabaseManager;
    AuditLogger = AuditLoggerModule.AuditLogger;
    EpisodicMemory = EpisodicMemoryModule.EpisodicMemory;
    TaskTokenManager = TaskTokenModule.TaskTokenManager;
    AgentRegistryImpl = AgentRegistryModule.AgentRegistryImpl;
    EventBus = EventBusModule.EventBus;
    IntentDispatcher = IntentDispatcherModule.IntentDispatcher;
    AgentRunner = AgentRunnerModule.AgentRunner;

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
            maxTokens: 4096
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
      getCurrentProjectFingerprint: async () => 'test-fp'
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

    // 初始化 EventBus
    eventBus = new EventBus();
    container.registerInstance('IEventBus', eventBus);

    // 初始化 AgentRegistry
    agentRegistry = new AgentRegistryImpl();
    container.registerInstance('IAgentRegistry', agentRegistry);

    // 注册 Mock Agent
    const mockAgent = {
      id: 'test_agent',
      name: 'Test Agent',
      supportedIntents: ['test_intent'],
      getCapabilities: () => [],
      execute: async () => ({ success: true, data: { result: 'test' } }),
      isAvailable: async () => true
    };
    agentRegistry.register(mockAgent);

    // 初始化 TaskTokenManager
    const taskTokenManager = new TaskTokenManager(auditLogger);
    container.registerInstance('TaskTokenManager', taskTokenManager);

    // Mock MemoryPort
    const mockMemoryPort = {
      retrieveContext: async () => ({ episodicMemories: [], preferenceRecommendations: [] }),
      recordTaskCompletion: async () => {},
      recordAgentExecution: async () => {},
      createSession: async () => {},
      loadSessionHistory: async () => [],
      deleteSession: async () => {},
      saveMessage: async () => {},
      listSessions: async () => [],
      retrieveAll: async () => [],
      recordMemory: async () => {},
      getAgentPerformance: async () => ({ totalAttempts: 10, successCount: 8, avgDurationMs: 1000 }),
      recordFeedback: async () => {},
      recommendForFile: async () => []
    };
    container.registerInstance('IMemoryPort', mockMemoryPort);

    // 初始化 IntentDispatcher
    intentDispatcher = new IntentDispatcher(
      mockMemoryPort,
      agentRegistry,
      eventBus,
      taskTokenManager
    );

    // 初始化 AgentRunner
    agentRunner = new AgentRunner(eventBus, agentRegistry, auditLogger, mockMemoryPort);
  });

  afterAll(async () => {
    if (databaseManager) {
      databaseManager.close();
    }
    container.clearInstances();
  });

  // ==================== 测试用例1: 完整调度流程 ====================
  describe('完整调度流程', () => {
    it('应该完成从意图接收到 Agent 执行的完整流程', async () => {
      const intent = {
        name: 'test_intent',
        userInput: '测试意图',
        metadata: { timestamp: Date.now(), taskToken: 'test-token' }
      };

      const publishedEvents: any[] = [];
      const originalPublish = eventBus.publish.bind(eventBus);
      eventBus.publish = (...args: any[]) => {
        publishedEvents.push(args[0]);
        return originalPublish(...args);
      };

      await intentDispatcher.dispatch(intent);

      // 验证发布了 IntentReceivedEvent
      const receivedEvent = publishedEvents.find((e: any) => e.type === 'intent.received');
      expect(receivedEvent).toBeDefined();

      // 验证发布了 AgentSelectedEvent
      const selectedEvent = publishedEvents.find((e: any) => e.type === 'agent.selected');
      expect(selectedEvent).toBeDefined();
      expect(selectedEvent.payload.agentId).toBe('test_agent');

      // 验证发布了 IntentDispatchedEvent
      const dispatchedEvent = publishedEvents.find((e: any) => e.type === 'intent.dispatched');
      expect(dispatchedEvent).toBeDefined();
    });
  });

  // ==================== 测试用例2: 事件订阅验证 ====================
  describe('事件订阅验证', () => {
    it('应该能够订阅并接收事件', (done) => {
      const intent = {
        name: 'test_intent',
        userInput: '测试',
        metadata: { timestamp: Date.now(), taskToken: 'test-token' }
      };

      let eventReceived = false;

      const unsubscribe = eventBus.subscribe('intent.received', (event: any) => {
        eventReceived = true;
        expect(event.payload.intent.name).toBe('test_intent');
        unsubscribe();
        done();
      });

      intentDispatcher.dispatch(intent).catch(() => {
        // 忽略错误
      });
    });
  });

  // ==================== 测试用例3: 记忆记录验证 ====================
  describe('记忆记录验证', () => {
    it('应该能够记录和检索情景记忆', async () => {
      const memoryId = await episodicMemory.record({
        taskType: 'TEST_TASK',
        summary: 'E2E 测试记忆',
        entities: ['test', 'e2e'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 500
      });

      expect(memoryId).toBeDefined();
      expect(memoryId).toMatch(/^ep_\d+_[a-z0-9]+$/);

      // 检索刚记录的记忆
      const memories = await episodicMemory.retrieve({
        taskType: 'TEST_TASK',
        limit: 1
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].summary).toContain('E2E 测试');
    });
  });

  // ==================== 测试用例4: Agent 注册与发现 ====================
  describe('Agent 注册与发现', () => {
    it('应该能够注册和查找 Agent', () => {
      const newAgent = {
        id: 'new_test_agent',
        name: 'New Test Agent',
        supportedIntents: ['new_intent'],
        getCapabilities: () => [],
        execute: async () => ({ success: true }),
        isAvailable: async () => true
      };

      agentRegistry.register(newAgent);

      const agents = agentRegistry.findAgentsForIntent('new_intent');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].id).toBe('new_test_agent');
    });

    it('应该能够获取所有已注册的 Agent', () => {
      const allAgents = agentRegistry.getAll();
      expect(allAgents.length).toBeGreaterThan(0);
    });
  });

  // ==================== 测试用例5: TaskToken 验证 ====================
  describe('TaskToken 验证', () => {
    it('应该能够生成和验证 TaskToken', async () => {
      const token = await (container.resolve('TaskTokenManager') as any).generate({
        operation: 'test_operation',
        parameters: { test: 'data' },
        expiresIn: 600
      });

      expect(token).toBeDefined();
      expect(token.operation).toBe('test_operation');

      const isValid = await (container.resolve('TaskTokenManager') as any).validate(token.token);
      expect(isValid).toBe(true);
    });
  });

  // ==================== 测试用例6: 错误处理 ====================
  describe('错误处理', () => {
    it('应该处理不存在的意图', async () => {
      const intent = {
        name: 'non_existent_intent',
        userInput: '测试',
        metadata: { timestamp: Date.now() }
      };

      await expect(intentDispatcher.dispatch(intent)).rejects.toThrow();
    });

    it('应该处理 Agent 执行失败', async () => {
      const failingAgent = {
        id: 'failing_agent',
        name: 'Failing Agent',
        supportedIntents: ['failing_intent'],
        getCapabilities: () => [],
        execute: async () => ({ success: false, error: 'Execution failed' }),
        isAvailable: async () => true
      };

      agentRegistry.register(failingAgent);

      const intent = {
        name: 'failing_intent',
        userInput: '测试',
        metadata: { timestamp: Date.now(), taskToken: 'test-token' }
      };

      // 调度器不应抛出错误，而是发布事件
      await expect(intentDispatcher.dispatch(intent)).resolves.not.toThrow();
    });
  });
});
