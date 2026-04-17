import "reflect-metadata";

// 生产环境不使用.env文件，改用VS Code SecretStorage API
// 开发环境的API密钥应通过VS Code设置或环境变量注入
import * as vscode from 'vscode';
import { container } from 'tsyringe';
import { ConfigManager } from './storage/ConfigManager';
import { DatabaseManager } from './storage/DatabaseManager';
import { AuditLogger } from './core/security/AuditLogger';
import { getUserFriendlyMessage } from './utils/ErrorCodes';
import { ExplainCodeCommand } from './commands/ExplainCodeCommand';
import { GenerateCommitCommand } from './commands/GenerateCommitCommand';
import { ExportMemoryCommand } from './commands/ExportMemoryCommand';
import { ImportMemoryCommand } from './commands/ImportMemoryCommand';
import { ConfigureApiKeyCommand } from './commands/ConfigureApiKeyCommand';
import { CheckNamingCommand } from './commands/CheckNamingCommand';
import { CodeGenerationCommand } from './commands/CodeGenerationCommand';
import { EpisodicMemory } from './core/memory/EpisodicMemory';
import { PreferenceMemory } from './core/memory/PreferenceMemory';
import { MemorySystem } from './core/memory/MemorySystem';
import { EventBus } from './core/eventbus/EventBus';
import { LLMTool } from './tools/LLMTool';
import { ChatViewProvider } from './chat/ChatViewProvider';
import { AICompletionProvider } from './completion/AICompletionProvider';

let configManager: ConfigManager;
let databaseManager: DatabaseManager;
let auditLogger: AuditLogger;
let episodicMemory: EpisodicMemory;
let preferenceMemory: PreferenceMemory;
let memorySystem: MemorySystem;
let eventBus: EventBus;
let llmTool: LLMTool;
let chatViewProvider: ChatViewProvider;
let aiCompletionProvider: AICompletionProvider;

/**
 * 插件激活入口
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('========== [Extension] activate() called ==========');
  const startTime = Date.now();

  try {
    console.log('[Extension] Step 1: Initializing container...');
    // 初始化依赖注入容器
    await initializeContainer(context);
    console.log('[Extension] Step 1 complete');

    console.log('[Extension] Step 2: Loading config...');
    // 加载配置
    configManager = container.resolve(ConfigManager);
    await configManager.loadConfig();
    console.log('[Extension] Step 2 complete');

    console.log('[Extension] Step 3: Initializing database...');
    // 初始化数据库
    databaseManager = container.resolve(DatabaseManager);
    await databaseManager.initialize();
    console.log('[Extension] Database initialized successfully');
    
    // 执行数据库迁移（短期/长期记忆分区）
    try {
      databaseManager.migrateAddMemoryTier();
      console.log('[Extension] Memory tier migration completed');
    } catch (error) {
      console.warn('[Extension] Memory tier migration failed:', error);
    }
    
    // 关键：将已初始化的DatabaseManager注册为单例，覆盖容器中的实例
    container.registerInstance(DatabaseManager, databaseManager);
    console.log('[Extension] DatabaseManager registered as singleton');
    console.log('[Extension] Step 3 complete');

    console.log('[Extension] Step 4: Initializing core services...');
    // 预解析核心服务（确保单例）
    episodicMemory = container.resolve(EpisodicMemory);
    preferenceMemory = container.resolve(PreferenceMemory);
    eventBus = container.resolve(EventBus);
    memorySystem = container.resolve(MemorySystem);
    llmTool = container.resolve(LLMTool);
    
    // 初始化记忆系统
    await memorySystem.initialize();
    console.log('[Extension] Core services initialized');
    console.log('[Extension] Step 4 complete');

    // 初始化审计日志
    auditLogger = container.resolve(AuditLogger);

    // 初始化聊天视图提供者
    chatViewProvider = new ChatViewProvider(
      context,
      llmTool,
      episodicMemory,
      preferenceMemory,
      configManager,
      auditLogger
    );

    // 初始化AI补全提供器
    aiCompletionProvider = new AICompletionProvider(llmTool, configManager);

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
    if (eventBus) {
      eventBus.dispose();
    }
    if (preferenceMemory) {
      // PreferenceMemory暂无dispose，预留
    }
    if (auditLogger) {
      await auditLogger.log('extension_deactivate', 'success', 0);
    }
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
 * 初始化依赖注入容器
 */
async function initializeContainer(context: vscode.ExtensionContext): Promise<void> {
  // 注册 VS Code 上下文
  container.registerInstance('extensionContext', context);
  
  // 注册 SecretStorage
  container.registerInstance('SecretStorage', context.secrets);
}

/**
 * 注册命令
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // 阶段 1 核心命令（传入已初始化的单例）
  const explainCodeHandler = new ExplainCodeCommand(episodicMemory, llmTool);
  const generateCommitHandler = new GenerateCommitCommand(episodicMemory, llmTool);
  const exportMemoryHandler = new ExportMemoryCommand();
  const importMemoryHandler = new ImportMemoryCommand();
  const configureApiKeyHandler = new ConfigureApiKeyCommand();
  const checkNamingHandler = new CheckNamingCommand(episodicMemory, llmTool);
  const codeGenerationHandler = new CodeGenerationCommand(episodicMemory, llmTool);
  
  const explainCodeCmd = vscode.commands.registerCommand(
    'xiaoweiba.explainCode',
    async () => {
      await explainCodeHandler.execute();
    }
  );

  const generateCommitCmd = vscode.commands.registerCommand(
    'xiaoweiba.generateCommit',
    async () => {
      await generateCommitHandler.execute();
    }
  );

  const exportMemoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.export-memory',
    async () => {
      await exportMemoryHandler.execute();
    }
  );

  const importMemoryCmd = vscode.commands.registerCommand(
    'xiaoweiba.import-memory',
    async () => {
      await importMemoryHandler.execute();
    }
  );

  const checkNamingCmd = vscode.commands.registerCommand(
    'xiaoweiba.checkNaming',
    async () => {
      await checkNamingHandler.execute();
    }
  );

  const codeGenerationCmd = vscode.commands.registerCommand(
    'xiaoweiba.generateCode',
    async () => {
      await codeGenerationHandler.execute();
    }
  );

  const optimizeSQLCmd = vscode.commands.registerCommand(
    'xiaoweiba.optimizeSQL',
    async () => {
      vscode.window.showInformationMessage('SQL 优化功能开发中...');
      await auditLogger.log('optimize_sql', 'success', 0);
    }
  );

  // 阶段 2 命令（占位实现）
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

  const configureApiKeyCmd = vscode.commands.registerCommand(
    'xiaoweiba.configure-api-key',
    async () => {
      await configureApiKeyHandler.execute();
    }
  );

  // 打开AI助手命令
  const openChatCmd = vscode.commands.registerCommand(
    'xiaoweiba.openChat',
    async () => {
      await vscode.commands.executeCommand('workbench.view.extension.xiaoweiba');
      // 聚焦到聊天视图
      await vscode.commands.executeCommand('xiaoweiba.chatView.focus');
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
      
      if (selectedText.trim().length > 0 && selectedText.length < 500) {
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
    generateCommitCmd,
    exportMemoryCmd,
    importMemoryCmd,
    checkNamingCmd,
    codeGenerationCmd,
    optimizeSQLCmd,
    repairMemoryCmd,
    configureApiKeyCmd,
    openChatCmd,
    // 智能唤醒监听器
    onDidSaveTextDocument,
    onDidChangeActiveTextEditor,
    onDidChangeTextEditorSelection,
    // 记忆驱动：文件打开主动推荐
    onDidOpenTextDocument
  );
}
