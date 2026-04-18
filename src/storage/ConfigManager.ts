import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import yaml from 'js-yaml';
import { injectable, inject } from 'tsyringe';
import { ErrorCode, createError } from '../utils/ErrorCodes';

export interface ModelProviderConfig {
  id: string;
  apiUrl: string;
  modelName?: string; // 具体模型名称（如 deepseek-chat, gpt-4 等）
  apiKey?: string;
  maxTokens: number;
  temperature: number;
}

export interface SecurityConfig {
  trustLevel: 'strict' | 'moderate' | 'lenient';
  autoApproveRead: boolean;
  requireDiffForWrite: boolean;
  gitPushEnabled: boolean;
}

export interface MemoryConfig {
  retentionDays: number;
  decayLambda: number;
  coldStartTrust: number;
}

export interface SkillConfig {
  userDir: string;
  autoDir: string;
  maxWorkflowDepth: number;
  trialPeriod: number;
}

export interface AuditConfig {
  level: 'error' | 'info' | 'debug';
  maxFileSizeMB: number;
  maxFiles: number;
}

export interface BestPracticeConfig {
  sources: string[];
  builtinOnly: boolean;
}

export interface ChatConfig {
  maxHistoryMessages: number;
  autoGenerateTitle: boolean;
  defaultSystemPrompt: string;
  enableCrossSession: boolean;
  // 新增：对话交互配置
  defaultInteractionMode?: 'QUICK' | 'DEEP' | 'COACH' | 'AUTO';
  enableClarification?: boolean;
  maxClarificationRounds?: number;
  preferConcise?: boolean;
}

export interface InlineCompletionConfig {
  enabled: boolean;
  triggerDelayMs: number;
  maxTokens: number;
  enableCache: boolean;
  cacheTTLSeconds: number;
}

export interface CommandCompatConfig {
  showDeprecationWarning: boolean;
  deprecationMessage: string;
}

export interface XiaoWeibaConfig {
  mode: 'private' | 'general';
  model: {
    default: string;
    providers: ModelProviderConfig[];
  };
  security: SecurityConfig;
  memory: MemoryConfig;
  skill: SkillConfig;
  audit: AuditConfig;
  bestPractice: BestPracticeConfig;
  autoCheck?: {
    onSave: boolean; // 保存时自动检查
  };
  autoSuggest?: {
    onSelection: boolean; // 选中代码时提示
    onScmOpen: boolean; // 打开SCM时提示
  };
  chat?: ChatConfig;
  inlineCompletion?: InlineCompletionConfig;
  commandCompat?: CommandCompatConfig;
}

const DEFAULT_CONFIG: XiaoWeibaConfig = {
  mode: 'private',
  model: {
    default: 'deepseek',
    providers: [
      {
        id: 'deepseek',
        apiUrl: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat', // DeepSeek API 需要的具体模型名称
        maxTokens: 4096,
        temperature: 0.6
      },
      {
        id: 'ollama',
        apiUrl: 'http://localhost:11434/v1',
        modelName: 'llama2', // Ollama 默认模型
        maxTokens: 2048,
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
    decayLambda: 0.1, // λ=0.1，半衰期约7天
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
  },
  autoCheck: {
    onSave: false // 默认关闭，用户可手动开启
  },
  autoSuggest: {
    onSelection: true, // 默认开启
    onScmOpen: true
  },
  chat: {
    maxHistoryMessages: 20,
    autoGenerateTitle: true,
    defaultSystemPrompt: '你是一个AI编程助手，擅长解释代码、生成代码和解答技术问题。',
    enableCrossSession: true
  },
  inlineCompletion: {
    enabled: true,
    triggerDelayMs: 300,
    maxTokens: 50,
    enableCache: true,
    cacheTTLSeconds: 5
  },
  commandCompat: {
    showDeprecationWarning: true,
    deprecationMessage: '该命令已弃用，请使用侧边栏 AI 助手（快捷键 Ctrl+Shift+L）获得更好体验。'
  }
};

@injectable()
export class ConfigManager {
  private configPath: string;
  private backupPath: string;
  private currentConfig: XiaoWeibaConfig | null = null;
  private configHistory: string[] = [];
  private watcher?: fs.FSWatcher;

  constructor(@inject('SecretStorage') private secretStorage: vscode.SecretStorage) {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, '.xiaoweiba', 'config.yaml');
    this.backupPath = path.join(homeDir, '.xiaoweiba', 'config.yaml.bak');
    
    // 初始化时设置默认配置，避免 getConfig() 在 loadConfig() 之前调用时失败
    this.currentConfig = { ...DEFAULT_CONFIG };
  }

  /**
   * 获取 API Key（优先从 SecretStorage，其次环境变量，最后配置文件）
   */
  async getApiKey(providerId: string): Promise<string | undefined> {
    // 1. 优先从 SecretStorage 获取
    const secretKey = await this.secretStorage.get(`${providerId}_api_key`);
    if (secretKey) return secretKey;
    
    // 2. 其次从环境变量获取
    const envVarName = `${providerId.toUpperCase()}_API_KEY`;
    const envKey = process.env[envVarName];
    if (envKey && envKey.trim().length > 0) {
      console.log(`[ConfigManager] Using API key from environment variable: ${envVarName}`);
      return envKey.trim();
    }
    
    // 3. 降级到配置文件
    const config = this.getConfig();
    const provider = config.model.providers.find(p => p.id === providerId);
    return provider?.apiKey;
  }

  /**
   * 设置 API Key（存储到 SecretStorage）
   */
  async setApiKey(providerId: string, apiKey: string): Promise<void> {
    await this.secretStorage.store(`${providerId}_api_key`, apiKey);
    
    // 验证API Key并显示成功消息
    vscode.window.showInformationMessage(
      `✅ ${providerId} API Key 已保存`,
      '测试连接'
    ).then(selection => {
      if (selection === '测试连接') {
        this.testApiConnection(providerId, apiKey);
      }
    });
  }

  /**
   * 测试API连接
   */
  private async testApiConnection(providerId: string, apiKey: string): Promise<void> {
    const config = this.getConfig();
    const provider = config.model.providers.find(p => p.id === providerId);
    
    if (!provider) {
      vscode.window.showErrorMessage(`❌ 未找到提供商: ${providerId}`);
      return;
    }

    const progress = vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在测试 ${providerId} 连接...`,
        cancellable: false
      },
      async () => {
        try {
          // ✅ D4修复：真实调用LLM API测试连接
          const { LLMTool } = await import('../tools/LLMTool');
          const { AuditLogger } = await import('../core/security/AuditLogger');
          
          const auditLogger = new AuditLogger(this);
          const llmTool = new LLMTool(this, auditLogger);
          
          // 发送一个简单的测试请求
          const result = await llmTool.call({
            model: providerId,  // ✅ 使用model字段指定provider
            messages: [
              { role: 'user', content: 'Hello' }
            ],
            maxTokens: 5
          });
          
          if (result.success) {
            vscode.window.showInformationMessage(
              `✅ ${providerId} 连接成功！\n模型: ${provider.modelName || '默认'}`
            );
          } else {
            throw new Error(result.error || '未知错误');
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `❌ ${providerId} 连接失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  /**
   * 加载配置，支持热加载
   */
  async loadConfig(): Promise<XiaoWeibaConfig> {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.createDefaultConfig();
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = yaml.load(content) as Partial<XiaoWeibaConfig>;

      // 合并默认配置
      const config = this.mergeWithDefaults(parsed);

      // 验证配置
      this.validateConfig(config);

      // 解析环境变量占位符
      this.resolveEnvVariables(config);

      this.currentConfig = config;
      this.setupWatcher();

      return config;
    } catch (error) {
      // 配置加载失败，尝试回滚
      await this.rollbackConfig();
      throw createError(
        ErrorCode.CONFIG_LOAD_FAILED,
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
        '配置文件加载失败，已尝试恢复备份。如果问题持续，请检查 ~/.xiaoweiba/config.yaml 文件',
        { configPath: this.configPath }
      );
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): XiaoWeibaConfig {
    if (!this.currentConfig) {
      throw createError(
        ErrorCode.CONFIG_LOAD_FAILED,
        'Config not loaded',
        '配置尚未加载，请先调用 loadConfig()'
      );
    }
    return this.currentConfig;
  }

  /**
   * 保存配置并创建备份
   */
  async saveConfig(config: XiaoWeibaConfig): Promise<void> {
    try {
      // 备份当前配置
      if (fs.existsSync(this.configPath)) {
        fs.copyFileSync(this.configPath, this.backupPath);
        this.addToHistory(this.configPath);
      }

      // 写入新配置
      const content = yaml.dump(config, { indent: 2 });
      fs.writeFileSync(this.configPath, content, 'utf-8');

      // 更新内存中的配置
      this.currentConfig = config;
    } catch (error) {
      // 保存失败，回滚
      await this.rollbackConfig();
      throw createError(
        ErrorCode.CONFIG_LOAD_FAILED,
        `Failed to save config: ${error instanceof Error ? error.message : String(error)}`,
        '配置文件保存失败，已恢复之前的配置',
        { configPath: this.configPath }
      );
    }
  }

  /**
   * 回滚到备份配置
   */
  async rollbackConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.backupPath)) {
        fs.copyFileSync(this.backupPath, this.configPath);
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.currentConfig = yaml.load(content) as XiaoWeibaConfig;
      } else {
        // 没有备份，创建默认配置
        this.createDefaultConfig();
      }
    } catch (error) {
      throw createError(
        ErrorCode.CONFIG_ROLLBACK_FAILED,
        `Failed to rollback config: ${error instanceof Error ? error.message : String(error)}`,
        '配置回滚失败，请手动检查配置文件'
      );
    }
  }

  /**
   * 获取配置历史（最近3份）
   */
  getConfigHistory(): string[] {
    return this.configHistory.slice(-3);
  }

  /**
   * 停止监听配置变化
   */
  dispose(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }

  /**
   * 创建默认配置文件
   */
  private createDefaultConfig(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const content = yaml.dump(DEFAULT_CONFIG, { indent: 2 });
    fs.writeFileSync(this.configPath, content, 'utf-8');
  }

  /**
   * 合并用户配置与默认配置
   */
  private mergeWithDefaults(userConfig: Partial<XiaoWeibaConfig>): XiaoWeibaConfig {
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      model: {
        ...DEFAULT_CONFIG.model,
        ...userConfig.model,
        providers: userConfig.model?.providers || DEFAULT_CONFIG.model.providers
      },
      security: {
        ...DEFAULT_CONFIG.security,
        ...userConfig.security
      },
      memory: {
        ...DEFAULT_CONFIG.memory,
        ...userConfig.memory
      },
      skill: {
        ...DEFAULT_CONFIG.skill,
        ...userConfig.skill
      },
      audit: {
        ...DEFAULT_CONFIG.audit,
        ...userConfig.audit
      },
      bestPractice: {
        ...DEFAULT_CONFIG.bestPractice,
        ...userConfig.bestPractice
      }
    };
  }

  /**
   * 验证配置有效性
   */
  private validateConfig(config: XiaoWeibaConfig): void {
    // 验证模式
    if (!['private', 'general'].includes(config.mode)) {
      throw createError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        `Invalid mode: ${config.mode}`,
        '配置验证失败：mode 必须是 "private" 或 "general"'
      );
    }

    // 验证信任级别
    if (!['strict', 'moderate', 'lenient'].includes(config.security.trustLevel)) {
      throw createError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        `Invalid trust level: ${config.security.trustLevel}`,
        '配置验证失败：trustLevel 必须是 "strict"、"moderate" 或 "lenient"'
      );
    }

    // 验证记忆保留天数
    if (config.memory.retentionDays < 1 || config.memory.retentionDays > 365) {
      throw createError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        `Invalid retention days: ${config.memory.retentionDays}`,
        '配置验证失败：retentionDays 必须在 1-365 之间'
      );
    }

    // 验证衰减系数
    if (config.memory.decayLambda <= 0 || config.memory.decayLambda > 1) {
      throw createError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        `Invalid decay lambda: ${config.memory.decayLambda}`,
        '配置验证失败：decayLambda 必须在 0-1 之间'
      );
    }

    // 验证工作流深度
    if (config.skill.maxWorkflowDepth < 1 || config.skill.maxWorkflowDepth > 10) {
      throw createError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        `Invalid workflow depth: ${config.skill.maxWorkflowDepth}`,
        '配置验证失败：maxWorkflowDepth 必须在 1-10 之间'
      );
    }
  }

  /**
   * 解析环境变量占位符 ${env:VAR_NAME}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveEnvVariables(config: any): void {
    const resolveValue = (value: any): any => {
      if (typeof value === 'string') {
        const match = value.match(/^\$\{env:(\w+)\}$/);
        if (match) {
          const envVar = process.env[match[1]];
          return envVar || value;
        }
        return value;
      }
      if (Array.isArray(value)) {
        return value.map(resolveValue);
      }
      if (typeof value === 'object' && value !== null) {
        const resolved: Record<string, any> = {};
        for (const [key, val] of Object.entries(value)) {
          resolved[key] = resolveValue(val);
        }
        return resolved;
      }
      return value;
    };

    const resolved = resolveValue(config);
    Object.assign(config, resolved);
  }

  /**
   * 设置文件监听器实现热加载
   */
  private setupWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    try {
      this.watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          // 延迟加载避免多次触发
          setTimeout(() => {
            this.loadConfig().catch((err) => {
              console.error('Config hot reload failed:', err);
            });
          }, 500);
        }
      });
    } catch (error) {
      // 文件系统不支持 watch，静默失败
      console.warn('Config file watching not supported:', error);
    }
  }

  /**
   * 添加配置到历史记录
   */
  private addToHistory(configPath: string): void {
    const timestamp = Date.now();
    const historyEntry = `${configPath}.${timestamp}.bak`;
    try {
      fs.copyFileSync(configPath, historyEntry);
      this.configHistory.push(historyEntry);

      // 只保留最近3份
      while (this.configHistory.length > 3) {
        const oldBackup = this.configHistory.shift();
        if (oldBackup && fs.existsSync(oldBackup)) {
          fs.unlinkSync(oldBackup);
        }
      }
    } catch (error) {
      console.warn('Failed to add config to history:', error);
    }
  }
}
