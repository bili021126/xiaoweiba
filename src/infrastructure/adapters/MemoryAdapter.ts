/**
 * 记忆适配器 - 将 EpisodicMemory/PreferenceMemory 适配到 IMemoryPort
 * 
 * 职责：
 * 1. 实现 IMemoryPort 接口
 * 2. 委托给具体的记忆模块（EpisodicMemory、PreferenceMemory）
 * 3. 处理意图到任务类型的映射
 * 4. 生成摘要和提取实体
 */

import { injectable, inject } from 'tsyringe';
import { IMemoryPort, Recommendation, AgentPerformance } from '../../core/ports/IMemoryPort';
import { Intent } from '../../core/domain/Intent';
import { MemoryContext } from '../../core/domain/MemoryContext';
import { TaskCompletedEvent, FeedbackGivenEvent, SystemErrorEvent } from '../../core/events/DomainEvent'; // ✅ 修复：导入 SystemErrorEvent
import { IEventBus } from '../../core/ports/IEventBus'; // ✅ 修复：导入 IEventBus
import { IMemoryStorage } from '../../core/ports/IMemoryStorage'; // ✅ 新增：只依赖存储端口
import { AuditLogger } from '../../core/security/AuditLogger'; // ✅ 修复：导入 AuditLogger
import { SessionManager } from '../../core/application/SessionManager';
import { SpecializedRetriever } from '../../core/application/SpecializedRetriever';
import { SessionContextManager } from '../../core/application/SessionContextManager';
import { MemorySummaryGenerator } from '../../core/application/MemorySummaryGenerator';
import { IntentTypeMapper } from '../../core/application/IntentTypeMapper';
import { MemoryEventSubscriber, TaskCompletionPayload } from '../../core/application/MemoryEventSubscriber';
import { FeedbackRecorder } from '../../core/application/FeedbackRecorder';
import { MemoryRecommender } from '../../core/application/MemoryRecommender';
import { MemoryExporter } from '../../core/application/MemoryExporter';

@injectable()
export class MemoryAdapter implements IMemoryPort {
  constructor(
    @inject('IMemoryStorage') private storage: IMemoryStorage, // ✅ 核心变化：只依赖存储端口
    @inject(SessionManager) private sessionManager: SessionManager,
    @inject(SpecializedRetriever) private specializedRetriever: SpecializedRetriever,
    @inject(SessionContextManager) private sessionContextManager: SessionContextManager,
    @inject(MemorySummaryGenerator) private summaryGenerator: MemorySummaryGenerator,
    @inject(IntentTypeMapper) private typeMapper: IntentTypeMapper,
    @inject(MemoryEventSubscriber) private eventSubscriber: MemoryEventSubscriber,
    @inject(FeedbackRecorder) private feedbackRecorder: FeedbackRecorder,
    @inject(MemoryRecommender) private memoryRecommender: MemoryRecommender,
    @inject(MemoryExporter) private memoryExporter: MemoryExporter,
    @inject('IEventBus') private eventBus: IEventBus, // ✅ 修复：注入 EventBus
    @inject(AuditLogger) private auditLogger: AuditLogger // ✅ 修复：注入 AuditLogger
  ) {
    this.subscribeToEvents();
  }

  /**
   * 订阅领域事件（实现自动记忆记录）
   */
  private subscribeToEvents(): void {
    // ✅ 瘦身：委托给 MemoryEventSubscriber
    this.eventSubscriber.subscribeToTaskCompletion(async (payload: TaskCompletionPayload) => {
      const { intent, agentId, result, durationMs, modelId } = payload;
        
      // 记录任务完成
      await this.recordTaskCompletion(payload as any);
        
      // 记录 Agent 执行性能
      if (intent && intent.name) {
        await this.recordAgentExecution(
          agentId,
          intent.name,
          result?.success ?? false,
          durationMs
        );
      }
    });
  }

  /**
   * 根据意图检索相关记忆上下文（深化版）
   */
  async retrieveContext(intent: Intent): Promise<MemoryContext> {
    const startTime = Date.now();
    const context: MemoryContext = {
      episodicMemories: [],
      preferenceRecommendations: [],
      userPreferences: {},
      sessionHistory: [] // ✅ 默认空数组，防止undefined
    };

    try {
      // 1. ✅ 根据意图类型选择检索策略
      switch (intent.name) {
        case 'inline_completion':
          // ✅ 行内补全跳过记忆检索（低延迟优化）
          context.episodicMemories = [];
          context.preferenceRecommendations = [];
          break;
        
        case 'explain_code':
          context.episodicMemories = await this.specializedRetriever.retrieveForExplainCode(intent); // ✅ 瘦身：委托
          break;
        
        case 'generate_commit':
          context.episodicMemories = await this.specializedRetriever.retrieveForCommit(intent); // ✅ 瘦身：委托
          break;
        
        case 'chat':
          context.episodicMemories = await this.specializedRetriever.retrieveForChat(intent); // ✅ 瘦身：委托
          // ✅ L1: 委托给 SessionContextManager 构建会话上下文
          const sessionId = (intent.metadata as any)?.sessionId;
          const coreIntent = intent.metadata?.coreIntent;
          const existingDecisions = context.keyDecisions;
          
          if (sessionId) {
            const sessionContext = await this.sessionContextManager.buildChatContext(
              sessionId,
              coreIntent,
              existingDecisions
            );
            
            // 合并返回的上下文
            if (sessionContext.sessionHistory) {
              context.sessionHistory = sessionContext.sessionHistory;
            }
            if (sessionContext.keyDecisions) {
              context.keyDecisions = sessionContext.keyDecisions;
            }
            if (sessionContext.sessionSummary) {
              context.sessionSummary = sessionContext.sessionSummary;
            }
          }
          break;
        
        default:
          // 通用检索策略 - 委托给存储端口
          const query = intent.userInput || intent.name;
          context.episodicMemories = await this.storage.searchEpisodic(query, { limit: 5 });
      }

      // 2. ✅ 获取通用偏好推荐 - 委托给存储端口
      const taskType = this.typeMapper.mapIntentToTaskType(intent.name);
      context.preferenceRecommendations = await this.storage.getRecommendations(taskType);

      // 3. ✅ 推断用户偏好的Agent
      if (!context.userPreferences) {
        context.userPreferences = {};
      }
      context.userPreferences.preferredAgent = await this.inferPreferredAgent(intent.name);

      const duration = Date.now() - startTime;
      context.originalQuery = intent.userInput || intent.name;
      context.retrievalDuration = duration;

      return context;
    } catch (error) {
      console.error('[MemoryAdapter] retrieveContext failed:', error);
      // 返回空上下文，不阻断流程
      return {
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {},
        sessionHistory: [], // ✅ 异常时也返回空数组
        originalQuery: intent.userInput || intent.name,
        retrievalDuration: Date.now() - startTime
      };
    }
  }

  /**
   * 记录任务完成事件到记忆系统
   */
  async recordTaskCompletion(event: TaskCompletedEvent): Promise<void> {
    try {
      // ✅ 直接使用事件属性（新的事件结构）
      const { intent, agentId, result, durationMs, modelId, memoryMetadata } = event;

      // ✅ P1-02: 如果有memoryMetadata，优先使用它；否则跳过记录
      if (memoryMetadata) {
        console.log('[MemoryAdapter] Recording with memoryMetadata:', memoryMetadata.taskType);
        
        // 使用提供的元数据记录 - 委托给存储端口
        await this.storage.recordEpisodic({
          taskType: memoryMetadata.taskType,
          summary: memoryMetadata.summary,
          entities: memoryMetadata.entities || [],
          outcome: memoryMetadata.outcome || (result.success ? 'SUCCESS' : 'FAILED'),
          modelId: modelId || result.modelId || 'unknown',
          durationMs: durationMs || 0,
          metadata: {
            agentId,
            intentName: intent.name,
            timestamp: event.timestamp
          }
        });
        return;
      }

      // ✅ 如果没有memoryMetadata，检查是否需要自动记录
      // （仅对特定意图类型自动记录，避免记录无意义的闲聊）
      const shouldAutoRecord = this.shouldAutoRecord(intent);
      if (!shouldAutoRecord) {
        console.log('[MemoryAdapter] Skipping record for intent:', intent.name, '(no memoryMetadata and not auto-recordable)');
        return;
      }
      
      // 生成摘要
      const summary = this.summaryGenerator.generateSummary(intent, result); // ✅ 瘦身：委托

      // 提取实体
      const entities = this.summaryGenerator.extractEntities(intent); // ✅ 瘦身：委托

      // 记录到情景记忆 - 委托给存储端口
      await this.storage.recordEpisodic({
        taskType: this.typeMapper.mapIntentToTaskType(intent.name),
        summary,
        entities,
        outcome: result.success ? 'SUCCESS' : 'FAILED',
        modelId: modelId || result.modelId || 'unknown',
        durationMs: durationMs || 0,
        metadata: {
          agentId,
          intentName: intent.name,
          timestamp: event.timestamp
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[MemoryAdapter] recordTaskCompletion failed:', errorMessage);
      
      // ✅ 修复：发布 SystemErrorEvent，通知用户记忆记录失败
      this.eventBus.publish(new SystemErrorEvent(
        'MemoryAdapter',
        'recordTaskCompletion',
        errorMessage
      ));
      
      // ✅ 修复：记录审计日志（用于调试和监控）
      await this.auditLogger.log('memory_record', 'failure', 0, {
        parameters: {
          error: errorMessage,
          agentId: event.agentId,
          intentName: event.intent.name
        }
      });
      
      // 不再重新抛出异常，避免影响主流程
      // throw error;
    }
  }

  /**
   * 判断是否应该自动记录（没有memoryMetadata时）
   */
  private shouldAutoRecord(intent: Intent): boolean {
    // 以下意图类型会自动记录（即使没有memoryMetadata）
    const autoRecordIntents = [
      'explain_code',
      'generate_code',
      'generate_commit',
      'check_naming',
      'optimize_sql',
      'new_session',
      'switch_session',
      'delete_session'
    ];
    
    return autoRecordIntents.includes(intent.name);
  }

  /**
   * 记录用户反馈事件
   */
  async recordFeedback(event: FeedbackGivenEvent): Promise<void> {
    try {
      // ✅ 瘦身：委托给 FeedbackRecorder
      const { query, clickedMemoryId, dwellTimeMs } = event;
      await this.feedbackRecorder.recordClickFeedback(query, clickedMemoryId, dwellTimeMs);
    } catch (error) {
      console.error('[MemoryAdapter] recordFeedback failed:', error);
      throw error;
    }
  }

  /**
   * 记录 Agent 执行结果（更新性能数据）
   */
  /**
   * 记录Agent执行性能数据（用于IntentDispatcher的Wilson评分）
   */
  async recordAgentExecution(
    agentId: string,
    intentName: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    // ✅ 核心变化：委托给存储端口
    await this.storage.recordAgentExecution(agentId, intentName, success, durationMs);
  }

  /**
   * 主动推荐：根据当前文件推荐相关历史记忆
   */
  async recommendForFile(filePath: string): Promise<Recommendation[]> {
    // ✅ 瘦身：委托给 MemoryRecommender
    return await this.memoryRecommender.recommendForFile(filePath);
  }

  /**
   * 获取 Agent 性能历史（用于调度决策）
   */
  async getAgentPerformance(agentId: string, intentName: string): Promise<AgentPerformance> {
    // ✅ 核心变化：委托给存储端口
    return await this.storage.getAgentPerformance(agentId, intentName);
  }

  /**
   * 将意图名称映射为任务类型
   */
  /**
   * 清理资源
   */
  dispose(): void {
    // ✅ 瘦身：委托给 MemoryEventSubscriber
    this.eventSubscriber.unsubscribeFromEvents();
  }

  /**
   * 推断用户偏好的Agent
   */
  private async inferPreferredAgent(intentName: string): Promise<string | undefined> {
    try {
      // 从情景记忆中查询该意图类型的历史记录 - 委托给存储端口
      const taskType = this.typeMapper.mapIntentToTaskType(intentName as any);
      const memories = await this.storage.retrieveEpisodic({
        taskType,
        limit: 20
      });

      // 统计各Agent的使用频率
      const agentCounts: Record<string, number> = {};
      memories.forEach((m: any) => {
        const agentId = m.metadata?.agentId;
        if (agentId) {
          agentCounts[agentId] = (agentCounts[agentId] || 0) + 1;
        }
      });

      // 返回使用最频繁的Agent
      const entries = Object.entries(agentCounts);
      if (entries.length === 0) return undefined;

      entries.sort((a, b) => b[1] - a[1]);
      return entries[0][0];
    } catch (error) {
      console.error('[MemoryAdapter] inferPreferredAgent failed:', error);
      return undefined;
    }
  }

  /**
   * 将EpisodicMemoryRecord转换为EpisodicMemoryItem
   */
  private toMemoryItem(record: any): any {
    return {
      id: record.id,
      summary: record.summary,
      taskType: record.taskType,
      timestamp: record.timestamp,
      entities: record.entities || []
    };
  }

  /**
   * 根据ID去重
   */
  private deduplicateById(records: any[]): any[] {
    const seen = new Set<string>();
    return records.filter((r: any) => {
      if (seen.has(r.id)) {
        return false;
      }
      seen.add(r.id);
      return true;
    });
  }

  // ========== ✅ P1-02: 会话管理方法实现 ==========

  /**
   * 创建新会话
   */
  async createSession(sessionId: string, metadata?: Record<string, any>): Promise<void> {
    // ✅ 瘦身：委托给 SessionManager
    await this.sessionManager.createSession(sessionId, metadata);
  }

  /**
   * 加载会话历史
   */
  async loadSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string; timestamp: number }>> {
    // ✅ 瘦身：委托给 SessionManager
    return await this.sessionManager.loadSessionHistory(sessionId);
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    // ✅ 瘦身：委托给 SessionManager
    await this.sessionManager.deleteSession(sessionId);
  }

  /**
   * 列出所有会话（按最后活跃时间倒序）
   */
  async listSessions(): Promise<Array<{ id: string; title: string; lastActiveAt: number; messageCount: number }>> {
    // ✅ 瘦身：委托给 SessionManager
    return await this.sessionManager.listSessions();
  }

  /**
   * 保存消息到会话
   */
  async saveMessage(sessionId: string, role: string, content: string): Promise<void> {
    // ✅ 瘦身：委托给 SessionManager
    await this.sessionManager.saveMessage(sessionId, role, content);
  }

  /**
   * ✅ 新增：检索所有情景记忆
   */
  async retrieveAll(options?: { limit?: number }): Promise<any[]> {
    // ✅ 瘦身：委托给 MemoryExporter
    return await this.memoryExporter.retrieveAll(options);
  }

  /**
   * ✅ 新增：直接记录一条记忆
   */
  async recordMemory(record: {
    taskType: string;
    summary: string;
    entities: string[];
    outcome: string;
    modelId?: string;
    durationMs?: number;
    metadata?: Record<string, any>;
  }): Promise<string> {
    // ✅ 瘦身：委托给 MemoryExporter
    return await this.memoryExporter.recordMemory(record);
  }
}
