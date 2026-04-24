// 确保reflect-metadata在最前面加载
try {
  require("reflect-metadata");
} catch (err) {
  console.error('[Extension] Failed to load reflect-metadata:', err);
  // 尝试从扩展目录加载
  const path = require('path');
  const extensionPath = __dirname;
  const reflectPath = path.join(extensionPath, '..', 'node_modules', 'reflect-metadata');
  try {
    require(reflectPath);
  } catch (err2) {
    console.error('[Extension] Also failed to load from:', reflectPath, err2);
  }
}

// 加载环境变量（开发环境）
try {
  const path = require('path');
  const fs = require('fs');
  
  // 优先加载 .env 文件
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  } else if (fs.existsSync(envExamplePath)) {
    // 如果 .env 不存在，尝试加载 .env.example 作为默认值
    require('dotenv').config({ path: envExamplePath });
  }
} catch (err) {
  console.warn('[Extension] Failed to load .env file:', err);
}

// 生产环境不使用.env文件，改用VS Code SecretStorage API
// 开发环境的API密钥应通过VS Code设置或环境变量注入
import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { ConfigManager } from './storage/ConfigManager';
import { DatabaseManager } from './storage/DatabaseManager';
import { AuditLogger } from './core/security/AuditLogger';
import { getUserFriendlyMessage } from './utils/ErrorCodes';
import { LENGTH_LIMITS } from './constants';

// Phase 2: 导入新架构组件
import { IntentDispatcher } from './core/application/IntentDispatcher';
import { ContextEnricher } from './core/application/ContextEnricher';
import { SessionCompressor } from './core/application/SessionCompressor';
import { SessionContextManager } from './core/application/SessionContextManager'; // ✅ L1: 新增
import { MemorySummaryGenerator } from './core/application/MemorySummaryGenerator'; // ✅ 瘦身：抽离摘要生成
import { IntentTypeMapper } from './core/application/IntentTypeMapper'; // ✅ 瘦身：抽离类型映射
import { SpecializedRetriever } from './core/application/SpecializedRetriever'; // ✅ 瘦身：抽离专门检索
import { MemoryEventSubscriber } from './core/application/MemoryEventSubscriber'; // ✅ 瘦身：抽离事件订阅
import { FeedbackRecorder } from './core/application/FeedbackRecorder'; // ✅ 瘦身：抽离反馈记录
import { LocalMemoryStorage } from './infrastructure/adapters/LocalMemoryStorage'; // ✅ 新增：存储适配器
import { SessionManager } from './core/application/SessionManager'; // ✅ 瘦身：抽离会话管理
import { MemoryRecommender } from './core/application/MemoryRecommender'; // ✅ 瘦身：抽离推荐逻辑
import { MemoryExporter } from './core/application/MemoryExporter'; // ✅ 瘦身：抽离导出/导入
import { MessageFlowManager } from './core/application/MessageFlowManager';  // ✅ 新增
import { AgentRunner } from './infrastructure/agent/AgentRunner';
import { AgentRegistryImpl } from './infrastructure/agent/AgentRegistryImpl';  // ✅ 更新路径
import { MemoryAdapter } from './infrastructure/adapters/MemoryAdapter';
import { LLMAdapter } from './infrastructure/adapters/LLMAdapter';
import { EventBusAdapter } from './infrastructure/adapters/EventBusAdapter';  // ✅ 新增
import { EventBus } from './core/eventbus/EventBus';
import { IntentFactory } from './core/factory/IntentFactory';  // ✅ 新增：Intent工厂

// Phase 2: 导入所有Agents
import { ExplainCodeAgent } from './agents/ExplainCodeAgent';
import { GenerateCommitAgent } from './agents/GenerateCommitAgent';
import { CodeGenerationAgent } from './agents/CodeGenerationAgent';
import { CheckNamingAgent } from './agents/CheckNamingAgent';
import { OptimizeSQLAgent } from './agents/OptimizeSQLAgent';
import { ConfigureApiKeyAgent } from './agents/ConfigureApiKeyAgent';
import { ExportMemoryAgent } from './agents/ExportMemoryAgent';
import { ImportMemoryAgent } from './agents/ImportMemoryAgent';
import { ChatAgent } from './agents/ChatAgent';  // ✅ 新增
import { InlineCompletionAgent } from './agents/InlineCompletionAgent';  // ✅ 新增：行内补全Agent
import { PromptComposer } from './core/application/PromptComposer'; // ✅ L1: 提示词编排器
import { EmbeddingService } from './core/application/EmbeddingService'; // ✅ L2: 嵌入服务
import { VectorEngine } from './core/application/VectorEngine'; // ✅ L2: 向量引擎
import { VectorIndexManager } from './core/application/VectorIndexManager'; // ✅ L2: 向量索引管理器
import { SemanticRetriever } from './core/application/SemanticRetriever'; // ✅ L2: 语义检索器
import { QueryExecutor } from './core/application/QueryExecutor'; // ✅ L2.5: 查询执行器
import { WeightCalculator } from './core/application/WeightCalculator'; // ✅ L2.5: 权重计算器
import { IndexSyncService } from './core/application/IndexSyncService'; // ✅ L2.5: 索引同步服务
import { HybridRetriever } from './core/application/HybridRetriever'; // ✅ L2: 混合检索器
import { SessionManagementAgent } from './agents/SessionManagementAgent';  // ✅ 新增：会话管理Agent
import { CommitStyleLearner } from './core/memory/CommitStyleLearner';  // ✅ 保留：MemoryAdapter需要
import { TaskTokenManager } from './core/security/TaskTokenManager'; // ✅ 修复 #28：引入 TaskTokenManager
import { EpisodicMemory } from './core/memory/EpisodicMemory';
import { PreferenceMemory } from './core/memory/PreferenceMemory';
import { MemorySystem } from './core/memory/MemorySystem';
import { ProjectFingerprint } from './utils/ProjectFingerprint';  // ✅ P1-03: 反馈记录需要
import { LLMTool } from './tools/LLMTool';
import { ChatViewProvider } from './chat/ChatViewProvider';
import { AICompletionProvider } from './completion/AICompletionProvider';

let configManager: ConfigManager;
let databaseManager: DatabaseManager;
let auditLogger: AuditLogger;
let episodicMemory: EpisodicMemory;
let preferenceMemory: PreferenceMemory;
let memorySystem: MemorySystem;
let legacyEventBus: EventBus;  // ✅ 重命名以区分
let llmTool: LLMTool;
let chatViewProvider: ChatViewProvider;
let aiCompletionProvider: AICompletionProvider;

// Phase 2: 新架构组件
let intentDispatcher: IntentDispatcher | undefined;
let messageFlowManager: MessageFlowManager | undefined;  // ✅ 新增
let agentRunner: AgentRunner | undefined;
let memoryAdapter: MemoryAdapter | undefined;
let llmAdapter: LLMAdapter | undefined;

/**
 * 插件激活入口
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now();

  try {
    // Step 1: 初始化依赖注入容器
    await initializeContainer(context);

    // Step 2: 加载配置
    configManager = container.resolve(ConfigManager);
    await configManager.loadConfig();

    // Step 3: 初始化数据库
    databaseManager = container.resolve(DatabaseManager);
    await databaseManager.initialize();
    
    // 执行数据库迁移（短期/长期记忆分区）
    try {
      databaseManager.migrateAddMemoryTier();
    } catch (error) {
      console.warn('[Extension] Memory tier migration failed:', error);
    }
    
    // ✅ 关键：将已初始化的DatabaseManager注册为单例，覆盖容器中的实例
    // 注意：不能调用clearInstances()，会清除SecretStorage等关键依赖
    // 直接registerInstance会覆盖之前的注册
    container.registerInstance(DatabaseManager, databaseManager);

    // Step 4: 初始化核心服务
    episodicMemory = container.resolve(EpisodicMemory);
    preferenceMemory = container.resolve(PreferenceMemory);
    legacyEventBus = container.resolve(EventBus);  // ✅ 使用legacyEventBus
    memorySystem = container.resolve(MemorySystem);
    llmTool = container.resolve(LLMTool);
    
    // ✅ L2: 注册 L2 核心组件
    const embeddingService = container.resolve(EmbeddingService);
    const vectorIndexManager = container.resolve(VectorIndexManager);
    const semanticRetriever = container.resolve(SemanticRetriever);
    
    // ✅ L2.5: 注册深度拆分组件
    const queryExecutor = container.resolve(QueryExecutor);
    const weightCalculator = container.resolve(WeightCalculator);
    
    // ✅ P1-03: 创建ProjectFingerprint实例
    const projectFingerprint = new ProjectFingerprint();
    
    // ✅ 创建MemoryAdapter并注册为IMemoryPort
    const eventBusAdapter = new EventBusAdapter(legacyEventBus);
    
    // ✅ 修复：提前初始化 auditLogger，供 MemoryAdapter 使用
    auditLogger = container.resolve(AuditLogger);
    
    const sessionCompressor = container.resolve(SessionCompressor);
    const sessionContextManager = container.resolve(SessionContextManager); // ✅ L1: 新增
    // ✅ 核心架构升级：注册 IMemoryStorage 端口
    const localStorage = new LocalMemoryStorage(episodicMemory, preferenceMemory);
    container.register('IMemoryStorage', { useValue: localStorage });

    // 实例化记忆适配器（现在只依赖 IMemoryStorage 端口）
    const sessionManager = container.resolve(SessionManager); // ✅ 瘦身：新增
    const specializedRetriever = container.resolve(SpecializedRetriever); // ✅ 瘦身：新增
    const summaryGenerator = container.resolve(MemorySummaryGenerator); // ✅ 瘦身：新增
    const typeMapper = container.resolve(IntentTypeMapper); // ✅ 瘦身：新增
    const eventSubscriber = container.resolve(MemoryEventSubscriber); // ✅ 瘦身：新增
    const feedbackRecorder = container.resolve(FeedbackRecorder); // ✅ 瘦身：新增
    const memoryRecommender = container.resolve(MemoryRecommender); // ✅ 瘦身：新增
    const memoryExporter = container.resolve(MemoryExporter); // ✅ 瘦身：新增
    
    memoryAdapter = new MemoryAdapter(
      localStorage, // ✅ 核心变化：注入存储端口
      sessionManager,
      specializedRetriever,
      sessionContextManager,
      summaryGenerator,
      typeMapper,
      eventSubscriber,
      feedbackRecorder,
      memoryRecommender,
      memoryExporter,
      eventBusAdapter, // ✅ 修复：添加 EventBus
      auditLogger // ✅ 修复：添加 AuditLogger
    );
    container.register('IMemoryPort', { useValue: memoryAdapter });
    
    // ✅ 注册 CommitStyleLearner
    const commitStyleLearner = container.resolve(CommitStyleLearner);
    container.registerInstance(CommitStyleLearner, commitStyleLearner);
    console.log('[Extension] CommitStyleLearner registered');

    // ✅ 注册 TaskTokenManager
    const taskTokenManager = new TaskTokenManager();
    container.registerInstance(TaskTokenManager, taskTokenManager);
    console.log('[Extension] TaskTokenManager registered');

    // 初始化记忆系统
    await memorySystem.initialize();

    // Phase 2: 初始化新架构组件
    // Phase 2: 初始化意图驱动架构
    llmAdapter = container.resolve(LLMAdapter);
    // ✅ 使用已注册的IAgentRegistry实例，不要重新创建
    const agentRegistry = container.resolve('IAgentRegistry') as any;
    agentRunner = container.resolve(AgentRunner);
    intentDispatcher = container.resolve(IntentDispatcher);
    
    // 注册所有Agents到AgentRegistry
    const agents = [
      container.resolve(ExplainCodeAgent),
      container.resolve(GenerateCommitAgent),
      container.resolve(CodeGenerationAgent),
      container.resolve(CheckNamingAgent),
      container.resolve(OptimizeSQLAgent),
      container.resolve(ConfigureApiKeyAgent),
      container.resolve(ExportMemoryAgent),
      container.resolve(ImportMemoryAgent)
    ];
    
    agents.forEach(agent => {
      agentRegistry.register(agent);
    });
    
    // ✅ L1: 注册 PromptComposer
    const promptComposer = container.resolve(PromptComposer);
    
    // ✅ 修复 #34：统一使用 container.resolve，消除手动 new
    const chatAgent = container.resolve(ChatAgent); // ✅ 通过容器解析，依赖自动注入
    await chatAgent.initialize();
    agentRegistry.register(chatAgent);
    
    const inlineAgent = container.resolve(InlineCompletionAgent);
    agentRegistry.register(inlineAgent);
    
    // ✅ 注册SessionManagementAgent
    const sessionAgent = container.resolve(SessionManagementAgent);
    await sessionAgent.initialize();
    agentRegistry.register(sessionAgent);

    // ✅ 重构后：ChatViewProvider通过依赖注入创建
    chatViewProvider = container.resolve(ChatViewProvider);

    // ✅ 重构后：AICompletionProvider通过IntentDispatcher调度
    aiCompletionProvider = new AICompletionProvider(intentDispatcher, configManager);

    // 注册命令
    registerCommands(context);

    // 注册聊天视图提供者
    const chatViewRegistration = vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    );
    context.subscriptions.push(chatViewRegistration);

    // 注册行内补全提供器
    const completionRegistration = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**/*' },
      aiCompletionProvider
    );
    context.subscriptions.push(completionRegistration);

    // 记录激活时间
    const activationTime = Date.now() - startTime;
    await auditLogger.log('extension_activate', 'success', activationTime);

    console.log(`小尾巴 (XiaoWeiba) 已激活，耗时: ${activationTime}ms`);
  } catch (error) {
    const activationTime = Date.now() - startTime;
    
    // 记录审计日志
    if (auditLogger) {
      await auditLogger.logError('extension_activate', error as Error, activationTime);
    }
    
    const errorMessage = getUserFriendlyMessage(error);
    vscode.window.showErrorMessage(`小尾巴激活失败: ${errorMessage}`);
    console.error('Extension activation failed:', error);
  }
}

/**
 * 插件停用
 */
export async function deactivate(): Promise<void> {
  try {
    if (databaseManager) {
      databaseManager.close();
    }
    if (configManager) {
      configManager.dispose();
    }
    if (episodicMemory) {
      await episodicMemory.dispose();
    }
    if (memorySystem) {
      await memorySystem.dispose();
    }
    if (legacyEventBus) {  // ✅ 使用legacyEventBus
      legacyEventBus.dispose();
    }
    if (chatViewProvider) {
      chatViewProvider.dispose(); // ✅ 取消事件订阅，防止内存泄漏
    }
    if (preferenceMemory) {
      // PreferenceMemory暂无dispose，预留
    }
    if (auditLogger) {
      await auditLogger.log('extension_deactivate', 'success', 0);
    }
    
    // Phase 2: 清理新架构组件
    if (messageFlowManager) {
      messageFlowManager.dispose();
    }
    if (agentRunner) {
      agentRunner.dispose();
    }
    // IntentDispatcher和adapters暂无dispose，预留
  } catch (error) {
    console.error('Extension deactivation failed:', error);
  }
}

/**
 * 获取 EpisodicMemory 单例（供命令处理器使用）
 */
export function getEpisodicMemory(): EpisodicMemory {
  if (!episodicMemory) {
    throw new Error('EpisodicMemory not initialized. Plugin may not be activated yet.');
  }
  return episodicMemory;
}

/**
 * 获取 LLMTool 单例（供命令处理器使用）
 */
export function getLLMTool(): LLMTool {
  if (!llmTool) {
    throw new Error('LLMTool not initialized. Plugin may not be activated yet.');
  }
  return llmTool;
}

/**
 * 初始化依赖注入容器（组合根）
 */
async function initializeContainer(context: vscode.ExtensionContext): Promise<void> {
  // ✅ 注册SecretStorage（ConfigManager依赖）
  container.registerInstance('SecretStorage', context.secrets);
  
  // ✅ 注册ExtensionContext（DatabaseManager等模块依赖）
  container.registerInstance('extensionContext', context);
  
  // 1. ✅ 初始化基础设施
  const legacyEventBus = new EventBus();
  container.registerInstance(EventBus, legacyEventBus);
  
  // 创建适配器并注册为IEventBus
  const eventBusAdapter = new EventBusAdapter(legacyEventBus);
  container.register('IEventBus', { useValue: eventBusAdapter });

  // ⚠️ 注意：不在这里解析EpisodicMemory等依赖DatabaseManager的服务
  // 它们将在Step 4中DatabaseManager注册之后再解析

  // ✅ 成本优化：注册两个LLM Adapter（Pro用于复杂推理，Flash用于高频轻任务）
  const llmTool = container.resolve(LLMTool);
  
  // Pro Adapter（默认，用于ChatAgent、ExplainCodeAgent、GenerateCommitAgent等复杂任务）
  container.register('LLMAdapterConfig', { useValue: { defaultModelId: 'deepseek-pro' } });
  const llmAdapterPro = container.resolve(LLMAdapter);
  container.register('ILLMPort', { useValue: llmAdapterPro }); // 默认端口
  container.register('ILLMPortPro', { useValue: llmAdapterPro }); // 显式Pro端口
  console.log('[Extension] LLMAdapter Pro registered (deepseek-v4-pro)');
  
  // Flash Adapter（用于InlineCompletionAgent、OptimizeSQLAgent、CheckNamingAgent等高频任务）
  container.register('LLMAdapterConfig', { useValue: { defaultModelId: 'deepseek-flash' } });
  const llmAdapterFlash = container.resolve(LLMAdapter);
  container.register('ILLMPortFlash', { useValue: llmAdapterFlash });
  console.log('[Extension] LLMAdapter Flash registered (deepseek-v4-flash)');
  
  // 2. ✅ 创建 Agent 注册表
  const agentRegistry = new AgentRegistryImpl();
  container.register('IAgentRegistry', { useValue: agentRegistry });
  
  // ⚠️ Agent注册、IntentDispatcher、MessageFlowManager已移至activate()函数的Step 5之后

  // ✅ L1: 注册ContextEnricher和SessionCompressor
  container.registerSingleton(ContextEnricher);
  container.registerSingleton(SessionCompressor);
  container.registerSingleton(VectorEngine); // ✅ L2: 注册向量引擎
  container.registerSingleton(EmbeddingService); // ✅ L2: 注册嵌入服务
  container.registerSingleton(QueryExecutor); // ✅ L2.5: 注册查询执行器
  container.registerSingleton(WeightCalculator); // ✅ L2.5: 注册权重计算器
  container.registerSingleton(IndexSyncService); // ✅ L2.5: 注册索引同步服务
  container.registerSingleton(HybridRetriever); // ✅ L2: 注册混合检索器
  console.log('[Extension] L2 Semantic Retrieval components registered');

  // 5. ✅ 初始化 AgentRunner（自动订阅事件）
  const agentRunner = new AgentRunner(eventBusAdapter, agentRegistry, auditLogger, memoryAdapter!);
  container.registerInstance(AgentRunner, agentRunner);
  console.log('[Extension] AgentRunner initialized (auto-subscribed to events)');
  
  console.log('[Extension] Step 3 complete');
  console.log('[Extension] Dependency injection container initialized successfully');
}

/**
 * 注册命令（Phase 2: 迁移到IntentDispatcher）
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // ✅ 从容器解析IntentDispatcher
  const intentDispatcher = container.resolve(IntentDispatcher);
  
  console.log('[Extension] Registering commands with IntentDispatcher...');

  // ========== P0 Commands（核心功能）==========
  
  // 1. 代码解释命令
  const explainCodeCmd = vscode.commands.registerCommand(
    'xiaoweiba.explainCode',
    async () => {
      try {
        const intent = IntentFactory.buildExplainCodeIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`代码解释失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 2. 生成提交信息命令
  const generateCommitCmd = vscode.commands.registerCommand(
    'xiaoweiba.generateCommit',
    async () => {
      try {
        const intent = IntentFactory.buildGenerateCommitIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`生成提交信息失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 3. 聊天命令（打开AI助手）
  const openChatCmd = vscode.commands.registerCommand(
    'xiaoweiba.openChat',
    async () => {
      await vscode.commands.executeCommand('workbench.view.extension.xiaoweiba');
      await vscode.commands.executeCommand('xiaoweiba.chatView.focus');
    }
  );

  // ========== P1 Commands（重要功能）==========
  
  // 4. 命名检查命令
  const checkNamingCmd = vscode.commands.registerCommand(
    'xiaoweiba.checkNaming',
    async () => {
      try {
        const intent = IntentFactory.buildCheckNamingIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`命名检查失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 5. 代码生成命令
  const codeGenerationCmd = vscode.commands.registerCommand(
    'xiaoweiba.generateCode',
    async () => {
      try {
        const intent = IntentFactory.buildGenerateCodeIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`代码生成失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 6. SQL优化命令
  const optimizeSQLCmd = vscode.commands.registerCommand(
    'xiaoweiba.optimizeSQL',
    async () => {
      try {
        const intent = IntentFactory.buildOptimizeSQLIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`SQL优化失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // ========== P2 Commands（辅助功能）==========
  
  // 7. 配置API Key命令
  const configureApiKeyCmd = vscode.commands.registerCommand(
    'xiaoweiba.configureApiKey',
    async () => {
      try {
        const intent = IntentFactory.buildConfigureApiKeyIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`配置API Key失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 8. 导出记忆命令
  const exportMemoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.exportMemory',
    async () => {
      try {
        const intent = IntentFactory.buildExportMemoryIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`导出记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 9. 导入记忆命令
  const importMemoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.importMemory',
    async () => {
      try {
        const intent = IntentFactory.buildImportMemoryIntent();
        await intentDispatcher.dispatch(intent);
      } catch (error) {
        vscode.window.showErrorMessage(`导入记忆失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // ========== 保留的旧Commands（非Agent相关）==========
  
  // 查看提交历史命令（纯Git操作，不需要Agent）
  const showCommitHistoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.showCommitHistory',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('⚠️ 请先打开一个文件');
        return;
      }

      const filePath = editor.document.fileName;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('⚠️ 无法获取工作区');
        return;
      }

      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        const { stdout } = await execPromise(
          `git log --oneline --max-count=20 -- "${filePath}"`,
          { cwd: workspaceFolder.uri.fsPath }
        );

        if (!stdout.trim()) {
          vscode.window.showInformationMessage('📝 该文件暂无提交历史');
          return;
        }

        // 显示提交历史
        const panel = vscode.window.createWebviewPanel(
          'commitHistory',
          '提交历史',
          vscode.ViewColumn.Beside,
          {}
        );

        const commits = stdout.split('\n').filter((line: string) => line.trim());
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: var(--vscode-font-family); padding: 20px; }
              .commit { margin-bottom: 10px; padding: 10px; border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground); }
              .hash { color: var(--vscode-gitDecoration-modifiedResourceForeground); font-weight: bold; }
              .message { margin-top: 5px; }
            </style>
          </head>
          <body>
            <h2>📋 提交历史: ${filePath.split('/').pop()}</h2>
            ${commits.map((commit: string) => {
              const [hash, ...msgParts] = commit.split(' ');
              const message = msgParts.join(' ');
              return `<div class="commit"><div class="hash">${hash}</div><div class="message">${message}</div></div>`;
            }).join('')}
          </body>
          </html>
        `;

        panel.webview.html = html;
      } catch (error) {
        vscode.window.showErrorMessage(`获取提交历史失败: ${error}`);
      }
    }
  );

  // 修复记忆数据库命令（底层维护操作）
  const repairMemoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.repair-memory',
    async () => {
      try {
        const success = databaseManager.repair();
        if (success) {
          vscode.window.showInformationMessage('记忆数据库修复成功');
          await auditLogger.log('repair_memory', 'success', 0);
        } else {
          vscode.window.showErrorMessage('记忆数据库修复失败');
          await auditLogger.log('repair_memory', 'failure', 0);
        }
      } catch (error) {
        const errorMessage = getUserFriendlyMessage(error);
        vscode.window.showErrorMessage(`记忆数据库修复失败: ${errorMessage}`);
        await auditLogger.logError('repair_memory', error as Error, 0);
      }
    }
  );

  // 撤销写权限命令（安全控制）
  const revokeWritePermissionCmd = vscode.commands.registerCommand(
    'xiaoweiba.revokeWritePermission',
    async () => {
      memorySystem.revokeCurrentToken();
      vscode.window.showInformationMessage('✅ 写权限已撤销');
    }
  );

  // ========== 智能唤醒机制 ==========
  
  // 1. 保存文件时自动检查命名规范
  const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(async (document) => {
    const config = configManager.getConfig();
    if (!config.autoCheck?.onSave) return; // 配置开关
    
    // 仅检查代码文件
    const codeLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c'];
    if (!codeLanguages.includes(document.languageId)) return;
    
    console.log('[Auto-Check] File saved, checking naming conventions...');
    // TODO: 实现后台静默检查，仅在发现问题时提示
  });

  // 2. Git提交前自动生成提交信息（拦截）
  const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor) return;
    
    const config = configManager.getConfig();
    if (!config.autoSuggest?.onScmOpen) return;
    
    // 检测是否打开SCM面板
    if (editor.document.uri.scheme === 'scm' || editor.document.uri.path.includes('scm')) {
      console.log('[Auto-Suggest] SCM panel visible, suggesting commit message generation');
      // 显示通知提示
      vscode.window.showInformationMessage(
        '💡 检测到Git变更，需要生成提交信息吗？',
        '生成', '取消'
      ).then(selection => {
        if (selection === '生成') {
          vscode.commands.executeCommand('xiaoweiba.generateCommit');
        }
      });
    }
  });

  // 3. 选中代码后显示CodeLens提示
  const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(async (e) => {
    if (e.selections.length === 0 || e.selections[0].isEmpty) return;
    
    const config = configManager.getConfig();
    if (!config.autoSuggest?.onSelection) return; // 配置开关
    
    // 延迟500ms显示提示，避免频繁触发
    setTimeout(() => {
      const selection = e.selections[0];
      const selectedText = e.textEditor.document.getText(selection);
      
      // 检查选中文本长度
      if (selectedText.trim().length > 0 && selectedText.length < LENGTH_LIMITS.MAX_CODE_LENGTH) {
        // 显示悬浮提示
        vscode.commands.executeCommand('editor.action.showHover');
      }
    }, 500);
  });

  // 4. 文件打开时主动推荐相关记忆（记忆驱动核心）
  const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(async (document) => {
    // 仅对代码文件进行推荐
    const codeLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c'];
    if (!codeLanguages.includes(document.languageId)) return;
    
    console.log(`[Memory-Driven] File opened: ${document.fileName}`);
    await memorySystem.proactiveRecommend(document.fileName);
  });

  // 添加到订阅
  context.subscriptions.push(
    explainCodeCmd,
    showCommitHistoryCmd,
    generateCommitCmd,    // ✅ 修复2：启用
    checkNamingCmd,       // ✅ 修复2：启用
    codeGenerationCmd,    // ✅ 修复2：启用
    optimizeSQLCmd,
    configureApiKeyCmd,
    exportMemoryCmd,
    importMemoryCmd,
    repairMemoryCmd,
    openChatCmd,
    revokeWritePermissionCmd,  // ✅ 修复7：撤销写权限
    // 智能唤醒监听器
    onDidSaveTextDocument,
    onDidChangeActiveTextEditor,
    onDidChangeTextEditorSelection,
    // 记忆驱动：文件打开主动推荐
    onDidOpenTextDocument
  );
}
