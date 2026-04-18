/**
 * 记忆系统 - 小尾巴的大脑
 * 
 * 职责：
 * 1. 作为服务注册中心（registerAction/executeAction）
 * 2. 自动注入记忆上下文到功能模块
 * 3. 协调所有记忆相关操作
 * 4. 通过事件总线发布记忆变化
 */

import { injectable, inject } from 'tsyringe';
import { EventBus, CoreEventType } from '../eventbus/EventBus';
import { EpisodicMemory } from './EpisodicMemory';
import { PreferenceMemory } from './PreferenceMemory';
import { AuditLogger } from '../security/AuditLogger';

/**
 * 动作处理器类型
 * @param input 输入参数
 * @param memoryContext 记忆上下文（由记忆系统自动注入）
 * @returns 执行结果
 */
export type ActionHandler = (input: any, memoryContext: MemoryContext) => Promise<any>;

/**
 * 记忆上下文结构（自动注入到功能模块）
 */
export interface MemoryContext {
  /** 相关的情景记忆 */
  episodicMemories?: Array<{
    id: string;
    summary: string;
    taskType: string;
    timestamp: number;
  }>;
  
  /** 相关的偏好记忆 */
  preferenceRecommendations?: Array<{
    domain: string;
    pattern: Record<string, any>;
    confidence: number;
  }>;
  
  /** 检索查询原文 */
  originalQuery?: string;
  
  /** 检索耗时（ms） */
  retrievalDuration?: number;
}

/**
 * 注册的动作元数据
 */
interface RegisteredAction {
  handler: ActionHandler;
  description?: string;
  registeredAt: number;
}

/**
 * 记忆系统类
 * 
 * 核心设计原则：
 * - 所有功能模块必须通过 executeAction 调用，不能直接访问记忆API
 * - 记忆系统控制何时检索、何时记录、何时推荐
 * - 通过事件总线通知其他模块记忆变化
 */
@injectable()
export class MemorySystem {
  private actions: Map<string, RegisteredAction> = new Map();
  private initialized: boolean = false;

  constructor(
    @inject(EventBus) private eventBus: EventBus,
    @inject(EpisodicMemory) private episodicMemory: EpisodicMemory,
    @inject(PreferenceMemory) private preferenceMemory: PreferenceMemory,
    @inject(AuditLogger) private auditLogger: AuditLogger
  ) {}

  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[MemorySystem] Initializing...');
    
    // 初始化情景记忆索引
    await this.episodicMemory.initialize();
    
    // 订阅模块动作完成事件（用于自动记录）
    this.eventBus.subscribe(CoreEventType.TASK_COMPLETED, async (event) => {
      await this.onActionCompleted(event);
    });
    
    this.initialized = true;
    console.log('[MemorySystem] Initialized successfully');
  }

  /**
   * 注册动作（服务注册中心模式）
   * 
   * @param actionId 动作唯一标识（如 'explainCode', 'generateCommit'）
   * @param handler 动作处理器
   * @param description 可选的描述信息
   * 
   * 使用示例：
   * ```typescript
   * memorySystem.registerAction('explainCode', async (input, context) => {
   *   // input: { selectedCode, language }
   *   // context: { episodicMemories, preferenceRecommendations }
   *   const explanation = await llmTool.explain(input.selectedCode, context);
   *   return { explanation };
   * });
   * ```
   */
  registerAction(actionId: string, handler: ActionHandler, description?: string): void {
    this.actions.set(actionId, {
      handler,
      description,
      registeredAt: Date.now()
    });
    
    console.log(`[MemorySystem] Registered action: ${actionId}${description ? ` - ${description}` : ''}`);
  }

  /**
   * 执行动作（记忆驱动的核心入口）
   * 
   * 流程：
   * 1. 检索相关记忆（基于input自动判断）
   * 2. 组装记忆上下文
   * 3. 调用注册的handler，注入上下文
   * 4. 发布 ACTION_COMPLETED 事件（触发自动记录）
   * 
   * @param actionId 动作ID
   * @param input 输入参数
   * @returns 执行结果
   */
  async executeAction(actionId: string, input: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 1. 获取注册的handler
      const action = this.actions.get(actionId);
      if (!action) {
        throw new Error(`Action "${actionId}" not registered. Available actions: ${Array.from(this.actions.keys()).join(', ')}`);
      }
      
      // 2. 检索相关记忆（自动注入上下文）
      const memoryContext = await this.retrieveRelevant(actionId, input);
      
      // 3. 调用handler，注入记忆上下文
      console.log(`[MemorySystem] Executing action: ${actionId} with ${memoryContext.episodicMemories?.length || 0} memories`);
      const result = await action.handler(input, memoryContext);
      
      // 4. 计算耗时
      const duration = Date.now() - startTime;
      
      // 5. 发布动作完成事件（触发自动记录到记忆）
      this.eventBus.publish(CoreEventType.TASK_COMPLETED, {
        actionId,
        result,
        durationMs: duration
      }, { source: 'MemorySystem' });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_execute_action', error as Error, duration);
      throw error;
    }
  }

  /**
   * 检索相关记忆（根据动作类型和输入自动判断）
   * 
   * @param actionId 动作ID
   * @param input 输入参数
   * @returns 记忆上下文
   */
  private async retrieveRelevant(actionId: string, input: any): Promise<MemoryContext> {
    const startTime = Date.now();
    const context: MemoryContext = {};
    
    console.log(`[MemorySystem] retrieveRelevant called for action: ${actionId}`);
    
    try {
      // 根据不同动作类型，采用不同的检索策略
      
      if (actionId === 'explainCode' || actionId === 'generateCode') {
        // 代码相关：检索该文件的最近历史 + 用户偏好
        console.log('[MemorySystem] Retrieving code-related memories...');
        context.episodicMemories = await this.retrieveCodeRelatedMemories(input);
        context.preferenceRecommendations = await this.retrieveCodePreferences(input);
        console.log(`[MemorySystem] Retrieved ${context.episodicMemories?.length || 0} episodic memories`);
        
      } else if (actionId === 'generateCommit') {
        // Git提交：检索最近的代码修改记忆
        context.episodicMemories = await this.episodicMemory.retrieve({
          taskType: 'CODE_EXPLAIN', // 或其他相关类型
          limit: 3
        });
        
      } else if (actionId === 'optimizeSQL') {
        // SQL优化：检索SQL相关的历史优化记录
        context.episodicMemories = await this.episodicMemory.search('SQL optimization', { limit: 5 });
        context.preferenceRecommendations = await this.preferenceMemory.queryPreferences({
          domain: 'SQL_STRATEGY',
          minConfidence: 0.6
        });
      }
      
      // 记录检索耗时
      context.retrievalDuration = Date.now() - startTime;
      console.log(`[MemorySystem] Retrieval completed in ${context.retrievalDuration}ms`);
      
      // 发布检索完成事件
      if (context.episodicMemories && context.episodicMemories.length > 0) {
        this.eventBus.publish(CoreEventType.MEMORY_RECOMMEND, {
          filePath: '',
          recommendations: context.episodicMemories
        }, { source: 'MemorySystem' });
      }
      
    } catch (error) {
      console.error('[MemorySystem] Memory retrieval failed:', error);
      // 不抛出错误，允许降级执行（无记忆上下文）
      context.retrievalDuration = Date.now() - startTime;
    }
    
    return context;
  }

  /**
   * 检索代码相关的情景记忆
   */
  private async retrieveCodeRelatedMemories(input: any): Promise<Array<{ id: string; summary: string; taskType: string; timestamp: number }>> {
    try {
      // 如果有文件路径，优先检索该文件的记忆
      if (input.filePath) {
        const fileName = input.filePath.split('/').pop()?.split('\\').pop() || '';
        const memories = await this.episodicMemory.search(fileName, { limit: 3 });
        
        return memories.map(m => ({
          id: m.id,
          summary: m.summary,
          taskType: m.taskType,
          timestamp: m.timestamp
        }));
      }
      
      // 否则返回最近的通用记忆
      const recentMemories = await this.episodicMemory.retrieve({ limit: 3 });
      return recentMemories.map(m => ({
        id: m.id,
        summary: m.summary,
        taskType: m.taskType,
        timestamp: m.timestamp
      }));
    } catch (error) {
      console.error('[MemorySystem] Failed to retrieve code memories:', error);
      return [];
    }
  }

  /**
   * 检索代码相关的偏好记忆
   */
  private async retrieveCodePreferences(input: any): Promise<Array<{ domain: string; pattern: Record<string, any>; confidence: number }>> {
    try {
      // 检索命名风格、代码模式等偏好
      const prefs = await this.preferenceMemory.queryPreferences({
        domain: 'NAMING', // 或 CODE_PATTERN
        minConfidence: 0.6,
        limit: 3
      });
      
      return prefs.map(p => ({
        domain: p.domain,
        pattern: p.pattern,
        confidence: p.confidence
      }));
    } catch (error) {
      console.error('[MemorySystem] Failed to retrieve preferences:', error);
      return [];
    }
  }

  /**
   * 处理动作完成事件（自动记录到记忆）
   */
  private async onActionCompleted(event: any): Promise<void> {
    const { actionId, result, durationMs } = event.payload;
    
    console.log(`[MemorySystem] onActionCompleted triggered for: ${actionId}`, { result, durationMs });
    
    try {
      // 根据不同动作类型，记录不同类型的情景记忆
      if (actionId === 'explainCode') {
        console.log('[MemorySystem] Recording CODE_EXPLAIN memory...');
        const memoryId = await this.episodicMemory.record({
          taskType: 'CODE_EXPLAIN',
          summary: `Explained code`,
          entities: [],
          outcome: result?.success ? 'SUCCESS' : 'FAILED',
          modelId: result?.modelId || 'deepseek',  // 确保非 undefined
          durationMs
        });
        
        console.log(`[MemorySystem] Memory recorded with ID: ${memoryId}`);
        
        // 发布情景记忆新增事件
        this.eventBus.publish(CoreEventType.MEMORY_RECORDED, {
          memoryId,
          taskType: 'CODE_EXPLAIN'
        }, { source: 'MemorySystem' });
      }
      
      // TODO: 其他动作类型的记录逻辑
      
    } catch (error) {
      console.error('[MemorySystem] Failed to record action completion:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 从代码中提取实体（函数名、类名等）
   */
  private extractEntities(code: string): string[] {
    const entities: string[] = [];
    
    // 提取函数名
    const functionMatches = code.match(/function\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach(m => {
        const name = m.match(/\w+/)?.[1];
        if (name) entities.push(name);
      });
    }
    
    // 提取类名
    const classMatches = code.match(/class\s+(\w+)/g);
    if (classMatches) {
      classMatches.forEach(m => {
        const name = m.match(/\w+/)?.[1];
        if (name) entities.push(name);
      });
    }
    
    return [...new Set(entities)]; // 去重
  }

  /**
   * 主动推荐：监听文件打开事件，推送相关记忆
   * 
   * 使用示例：
   * ```typescript
   * vscode.workspace.onDidOpenTextDocument((doc) => {
   *   memorySystem.proactiveRecommend(doc.fileName);
   * });
   * ```
   */
  async proactiveRecommend(filePath: string): Promise<void> {
    try {
      const fileName = filePath.split('/').pop()?.split('\\').pop() || '';
      
      // 检索与该文件相关的历史记忆
      const memories = await this.episodicMemory.search(fileName, { limit: 5 });
      
      if (memories.length > 0) {
        // 发布推荐事件
        this.eventBus.publish(CoreEventType.MEMORY_RECOMMEND, {
          filePath,
          recommendations: memories.map(m => ({
            title: m.summary,
            timestamp: m.timestamp,
            memoryId: m.id,
            taskType: m.taskType
          }))
        }, { source: 'MemorySystem' });
        
        console.log(`[MemorySystem] Recommended ${memories.length} memories for ${fileName}`);
      }
    } catch (error) {
      console.error('[MemorySystem] Proactive recommendation failed:', error);
    }
  }

  /**
   * 获取已注册的动作列表（用于调试）
   */
  getRegisteredActions(): Array<{ id: string; description?: string; registeredAt: number }> {
    return Array.from(this.actions.entries()).map(([id, action]) => ({
      id,
      description: action.description,
      registeredAt: action.registeredAt
    }));
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    await this.episodicMemory.dispose();
    console.log('[MemorySystem] Disposed');
  }
}
