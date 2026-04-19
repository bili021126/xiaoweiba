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
import { Intent, IntentName } from '../../core/domain/Intent';
import { MemoryContext } from '../../core/domain/MemoryContext';
import { TaskCompletedEvent, FeedbackGivenEvent } from '../../core/events/DomainEvent';
import { EpisodicMemory } from '../../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../core/memory/PreferenceMemory';
import { CommitStyleLearner } from '../../core/memory/CommitStyleLearner';
import { IEventBus } from '../../core/ports/IEventBus';

@injectable()
export class MemoryAdapter implements IMemoryPort {
  private unsubscribe?: () => void;
  
  // ✅ 会话历史存储（按sessionId分组）
  private sessionHistories: Map<string, Array<{ role: string; content: string }>> = new Map();
  
  // ✅ Agent性能数据存储（用于Wilson评分）
  private agentPerformances: Map<string, { totalAttempts: number; successCount: number; totalDurationMs: number }> = new Map();

  constructor(
    @inject(EpisodicMemory) private episodicMemory: EpisodicMemory,
    @inject(PreferenceMemory) private preferenceMemory: PreferenceMemory,
    @inject(CommitStyleLearner) private commitStyleLearner: CommitStyleLearner,
    @inject('IEventBus') private eventBus: IEventBus  // ✅ 注入EventBus以订阅事件
  ) {
    this.subscribeToEvents();
  }

  /**
   * 订阅领域事件（实现自动记忆记录）
   */
  private subscribeToEvents(): void {
    // 订阅任务完成事件，自动记录到记忆系统
    this.unsubscribe = this.eventBus.subscribe(
      TaskCompletedEvent.type,
      async (event: any) => {
        // ✅ 修复：从payload中提取数据（DomainEvent结构）
        const payload = event?.payload || event;
        
        // ✅ 防御性检查：确保payload有必要的属性
        if (!payload || !payload.intent || !payload.agentId) {
          console.warn('[MemoryAdapter] Invalid TaskCompletedEvent payload, skipping');
          return;
        }
        
        // ✅ 构造TaskCompletedEvent兼容对象
        const taskEvent = {
          intent: payload.intent,
          agentId: payload.agentId,
          result: payload.result,
          durationMs: payload.durationMs
        };
        
        await this.recordTaskCompletion(taskEvent as any);
        
        // 同时记录Agent执行性能数据
        const { agentId, intent, result, durationMs } = taskEvent;
        if (intent && intent.name) {
          await this.recordAgentExecution(
            agentId,
            intent.name,
            result?.success ?? false,
            durationMs
          );
        }
      }
    );
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
          context.episodicMemories = await this.retrieveForExplainCode(intent);
          break;
        
        case 'generate_commit':
          context.episodicMemories = await this.retrieveForCommit(intent);
          // 学习提交风格偏好
          const commitPref = await this.commitStyleLearner.learnFromHistory(
            intent.codeContext?.filePath
          );
          context.userPreferences = {
            commitStylePreference: commitPref
          };
          break;
        
        case 'chat':
          context.episodicMemories = await this.retrieveForChat(intent);
          // ✅ 填充会话历史
          const sessionId = (intent.metadata as any)?.sessionId;
          if (sessionId) {
            context.sessionHistory = this.sessionHistories.get(sessionId) || [];
          }
          break;
        
        default:
          // 通用检索策略
          const query = intent.userInput || intent.name;
          const memories = await this.episodicMemory.search(query, { limit: 5 });
          context.episodicMemories = memories.map((m: any) => this.toMemoryItem(m));
      }

      // 2. ✅ 获取通用偏好推荐
      const taskType = this.mapIntentToTaskType(intent.name);
      const prefRecs = await this.preferenceMemory.getRecommendations(taskType as any);
      context.preferenceRecommendations = prefRecs.map((r: any) => ({
        domain: r.domain || taskType,
        pattern: r.pattern || {},
        confidence: r.confidence || 0.5
      }));

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
      const { intent, agentId, result, durationMs } = event;

      // ✅ 如果是chat意图，保存对话历史到sessionHistories
      if (intent.name === 'chat' && result.success) {
        const sessionId = (intent.metadata as any)?.sessionId;
        if (sessionId) {
          const history = this.sessionHistories.get(sessionId) || [];
          
          // 添加用户消息
          if (intent.userInput) {
            history.push({ role: 'user', content: intent.userInput });
          }
          
          // 添加助手回复（从result中提取）
          if (result.data?.content) {
            history.push({ role: 'assistant', content: result.data.content });
          }
          
          // 限制历史记录长度（最多20条）
          if (history.length > 20) {
            history.splice(0, history.length - 20);
          }
          
          this.sessionHistories.set(sessionId, history);
        }
      }

      // 生成摘要
      const summary = this.generateSummary(intent, result);

      // 提取实体
      const entities = this.extractEntities(intent);

      // 记录到情景记忆
      await this.episodicMemory.record({
        taskType: this.mapIntentToTaskType(intent.name) as any,
        summary,
        entities,
        outcome: result.success ? 'SUCCESS' : 'FAILED',
        modelId: result.modelId || 'unknown',
        durationMs: durationMs || 0,
        metadata: {
          agentId,
          intentName: intent.name,
          timestamp: event.timestamp
        }
      });

      console.log('[MemoryAdapter] Task completion recorded:', summary);
    } catch (error) {
      console.error('[MemoryAdapter] recordTaskCompletion failed:', error);
      throw error;
    }
  }

  /**
   * 记录用户反馈事件
   */
  async recordFeedback(event: FeedbackGivenEvent): Promise<void> {
    try {
      // ✅ 使用新的反馈事件结构
      const { query, clickedMemoryId, dwellTimeMs } = event;
      
      console.log('[MemoryAdapter] Feedback recorded:', {
        query,
        clickedMemoryId,
        dwellTimeMs
      });
      
      // TODO: 将反馈记录到偏好记忆或专家选择器，用于优化未来的记忆检索权重
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
    try {
      // ✅ 构建性能数据key（agentId + intentName）
      const key = `${agentId}::${intentName}`;
      
      // 获取或初始化性能数据
      let perf = this.agentPerformances.get(key);
      if (!perf) {
        perf = { totalAttempts: 0, successCount: 0, totalDurationMs: 0 };
      }
      
      // 更新统计数据
      perf.totalAttempts += 1;
      if (success) {
        perf.successCount += 1;
      }
      perf.totalDurationMs += durationMs;
      
      this.agentPerformances.set(key, perf);
    } catch (error) {
      console.error('[MemoryAdapter] recordAgentExecution failed:', error);
      // 静默失败，不影响主流程
    }
  }

  /**
   * 主动推荐：根据当前文件推荐相关历史记忆
   */
  async recommendForFile(filePath: string): Promise<Recommendation[]> {
    try {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      
      if (!fileName) {
        return [];
      }

      const memories = await this.episodicMemory.search(fileName, { limit: 5 });

      return memories.map((m: any) => ({
        title: m.summary,
        timestamp: m.timestamp,
        memoryId: m.id
      }));
    } catch (error) {
      console.error('[MemoryAdapter] recommendForFile failed:', error);
      return [];
    }
  }

  /**
   * 获取 Agent 性能历史（用于调度决策）
   */
  async getAgentPerformance(agentId: string, intentName: string): Promise<AgentPerformance> {
    try {
      // ✅ 优先使用内存中的性能数据（由recordAgentExecution更新）
      const key = `${agentId}::${intentName}`;
      const perf = this.agentPerformances.get(key);
      
      if (perf && perf.totalAttempts > 0) {
        return {
          totalAttempts: perf.totalAttempts,
          successCount: perf.successCount,
          avgDurationMs: perf.totalDurationMs / perf.totalAttempts
        };
      }
      
      // 降级：从情景记忆中查询（兼容旧数据）
      const taskType = this.mapIntentToTaskType(intentName as IntentName);
      const memories = await this.episodicMemory.retrieve({
        taskType: taskType as any,
        limit: 50
      });

      // 过滤出该 Agent 的记录
      const relevant = memories.filter((m: any) => m.metadata?.agentId === agentId);
      
      const successCount = relevant.filter((m: any) => m.outcome === 'SUCCESS').length;
      const totalDuration = relevant.reduce((sum, m) => sum + (m.durationMs || 0), 0);

      return {
        totalAttempts: relevant.length,
        successCount,
        avgDurationMs: relevant.length > 0 ? totalDuration / relevant.length : 0
      };
    } catch (error) {
      console.error('[MemoryAdapter] getAgentPerformance failed:', error);
      return {
        totalAttempts: 0,
        successCount: 0,
        avgDurationMs: 0
      };
    }
  }

  /**
   * 将意图名称映射为任务类型
   */
  private mapIntentToTaskType(intentName: IntentName): string {
    const map: Record<IntentName, string> = {
      explain_code: 'CODE_EXPLAIN',
      generate_code: 'CODE_GENERATE',
      generate_commit: 'COMMIT_GENERATE',
      check_naming: 'NAMING_CHECK',
      optimize_sql: 'SQL_OPTIMIZE',
      chat: 'CHAT_COMMAND',
      configure_api_key: 'CONFIGURATION',
      export_memory: 'EXPORT_MEMORY',
      import_memory: 'IMPORT_MEMORY',
      inline_completion: 'INLINE_COMPLETION' // ✅ 新增
    };
    return map[intentName];
  }

  /**
   * 根据意图生成有意义的摘要
   */
  private generateSummary(intent: Intent, result: any): string {
    // 根据意图生成有意义的摘要
    if (intent.name === 'explain_code' && intent.codeContext) {
      return `解释了 ${intent.codeContext.filePath} 中的代码`;
    }
    
    if (intent.name === 'generate_commit') {
      const commitMsg = result.data?.commitMessage || result.commitMessage;
      return `生成了提交信息: ${commitMsg?.substring(0, 50) || ''}`;
    }
    
    if (intent.name === 'generate_code' && intent.codeContext) {
      return `在 ${intent.codeContext.filePath} 中生成代码`;
    }
    
    if (intent.name === 'check_naming' && intent.codeContext) {
      return `检查了 ${intent.codeContext.filePath} 的命名规范`;
    }
    
    if (intent.name === 'optimize_sql') {
      return '优化了SQL查询';
    }

    return `执行了 ${intent.name}`;
  }

  /**
   * 从意图中提取实体
   */
  private extractEntities(intent: Intent): string[] {
    const entities: string[] = [];

    // 提取文件路径
    if (intent.codeContext?.filePath) {
      entities.push(intent.codeContext.filePath);
    }

    // 提取语言
    if (intent.codeContext?.language) {
      entities.push(intent.codeContext.language);
    }

    // 提取用户输入中的关键词（简单实现）
    if (intent.userInput) {
      const keywords = intent.userInput
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
      entities.push(...keywords);
    }

    return entities;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      console.log('[MemoryAdapter] Unsubscribed from events');
    }
  }

  // ========== 私有方法：深化检索策略 ==========

  /**
   * 代码解释场景检索
   */
  private async retrieveForExplainCode(intent: Intent): Promise<any[]> {
    if (!intent.codeContext) return [];

    const filePath = intent.codeContext.filePath;
    const fileName = filePath.split(/[/\\]/).pop() || '';
    
    try {
      // 1. 检索该文件的历史解释
      const fileMemories = await this.episodicMemory.search(fileName, {
        taskType: 'CODE_EXPLAIN',
        limit: 3
      });

      // 2. 检索相似代码的解释（基于选中的代码片段）
      let similarMemories: any[] = [];
      if (intent.codeContext.selectedCode) {
        // ✅ 实现语义搜索：使用EpisodicMemory.search()自动调用searchSemantic
        similarMemories = await this.episodicMemory.search(
          intent.codeContext.selectedCode.substring(0, 200),
          { limit: 2 }
        );
      }

      // 3. 合并去重
      const allMemories = [...fileMemories, ...similarMemories];
      const unique = this.deduplicateById(allMemories);
      
      return unique.slice(0, 5).map((m: any) => this.toMemoryItem(m));
    } catch (error) {
      console.error('[MemoryAdapter] retrieveForExplainCode failed:', error);
      return [];
    }
  }

  /**
   * 生成提交信息场景检索
   */
  private async retrieveForCommit(intent: Intent): Promise<any[]> {
    try {
      // 检索历史提交记忆
      const memories = await this.episodicMemory.retrieve({
        taskType: 'COMMIT_GENERATE',
        limit: 5
      });

      return memories.map((m: any) => this.toMemoryItem(m));
    } catch (error) {
      console.error('[MemoryAdapter] retrieveForCommit failed:', error);
      return [];
    }
  }

  /**
   * 聊天场景检索
   */
  private async retrieveForChat(intent: Intent): Promise<any[]> {
    try {
      // 检索最近的对话和操作
      const recent = await this.episodicMemory.retrieve({ limit: 5 });
      return recent.map((m: any) => this.toMemoryItem(m));
    } catch (error) {
      console.error('[MemoryAdapter] retrieveForChat failed:', error);
      return [];
    }
  }

  /**
   * 推断用户偏好的Agent
   */
  private async inferPreferredAgent(intentName: string): Promise<string | undefined> {
    try {
      // 从情景记忆中查询该意图类型的历史记录
      const taskType = this.mapIntentToTaskType(intentName as any);
      const memories = await this.episodicMemory.retrieve({
        taskType: taskType as any,
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
}
