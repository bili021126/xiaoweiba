/**
 * 意图调度器 - 核心调度逻辑
 * 
 * 职责：
 * 1. 接收用户意图
 * 2. 通过端口检索记忆上下文
 * 3. 查找能处理此意图的Agent
 * 4. 基于记忆和性能历史选择最佳Agent
 * 5. 发布Agent选定事件
 */

import { injectable, inject } from 'tsyringe';
import { IMemoryPort } from '../ports/IMemoryPort';
import { IAgentRegistry } from '../ports/IAgentRegistry';
import { IEventBus } from '../ports/IEventBus';
import { AgentResult } from '../agent/IAgent';
import { 
  IntentReceivedEvent,
  AgentSelectedEvent,
  IntentDispatchedEvent,
  IntentDispatchFailedEvent
} from '../events/DomainEvent';
import { Intent } from '../domain/Intent';
import { MemoryContext } from '../domain/MemoryContext';
import { IAgent } from '../agent/IAgent';
import { TaskTokenManager } from '../security/TaskTokenManager'; // ✅ 修复 #28：引入 TaskTokenManager

@injectable()
export class IntentDispatcher {
  // ✅ 修复 #28：定义需要写权限的意图列表
  private readonly WRITE_INTENTS = new Set([
    'generate_commit',     // Git 提交（执行 git commit）
    'export_memory',       // 导出记忆（写文件）
    'import_memory'        // 导入记忆（写数据库）
    // 注意：generate_code 和 check_naming 仅提供建议，不直接执行写操作
  ]);

  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IAgentRegistry') private agentRegistry: IAgentRegistry,
    @inject('IEventBus') private eventBus: IEventBus,  // ✅ 统一使用字符串token
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager // ✅ 修复 #28：注入 TaskTokenManager
  ) {}

  /**
   * 核心调度方法
   */
  async dispatch(intent: Intent): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. 发布意图接收事件
      this.eventBus.publish(new IntentReceivedEvent(intent));

      // ✅ 修复 #28：为写操作意图生成 TaskToken
      if (this.WRITE_INTENTS.has(intent.name)) {
        const actionId = `action_${intent.name}_${Date.now()}`;
        const token = this.taskTokenManager.generateToken(actionId, 'write');
        
        // 将 Token 注入到 intent.metadata
        intent.metadata.taskToken = token.tokenId;
        
        console.log(`[IntentDispatcher] Generated write token for ${intent.name}: ${token.tokenId}`);
      }

      // 2. 通过端口检索记忆上下文（绝不直接调用EpisodicMemory）
      const memoryContext = await this.memoryPort.retrieveContext(intent);

      // 3. 查找能处理此意图的Agent
      const candidates = this.agentRegistry.findAgentsForIntent(intent);
      
      if (candidates.length === 0) {
        // ✅ 降级策略1：尝试使用默认ChatAgent
        const defaultAgent = this.agentRegistry.getAll().find(a => a.id === 'chat-agent');
        if (defaultAgent) {
          
          // 发布Agent选定事件
          this.eventBus.publish(new AgentSelectedEvent(
            intent,
            defaultAgent.id,
            memoryContext
          ));
          
          const duration = Date.now() - startTime;
          this.eventBus.publish(new IntentDispatchedEvent(
            intent,
            defaultAgent.id,
            duration
          ));
          return;
        }
        
        // ✅ 降级策略2：无可用Agent，抛出错误
        throw new Error(`No agent found for intent: ${intent.name} and no fallback available`);
      }

      // 4. 基于记忆和性能历史选择最佳Agent
      const selectedAgent = await this.selectBestAgent(intent, candidates, memoryContext);

      // 5. 发布Agent选定事件（由基础设施层的AgentRunner订阅并执行）
      this.eventBus.publish(new AgentSelectedEvent(
        intent,
        selectedAgent.id,
        memoryContext
      ));

      // 6. 记录调度耗时
      const duration = Date.now() - startTime;
      this.eventBus.publish(new IntentDispatchedEvent(
        intent,
        selectedAgent.id,
        duration
      ));
    } catch (error) {
      this.eventBus.publish(new IntentDispatchFailedEvent(
        intent,
        error as Error
      ));
      throw error;
    }
  }

  /**
   * 同步调度方法（用于低延迟场景，如行内补全）
   * 
   * 跳过事件发布，直接查找Agent并执行，返回结果
   * 适用于对延迟极度敏感的场景（<500ms）
   * @returns Agent执行结果
   */
  async dispatchSync(intent: Intent): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 1. 查找能处理此意图的Agent
      const candidates = this.agentRegistry.findAgentsForIntent(intent);
      
      if (candidates.length === 0) {
        throw new Error(`No agent found for intent: ${intent.name}`);
      }

      // 2. 对于补全等低延迟场景，直接使用第一个Agent，不需要复杂的评分
      const agent = candidates[0];

      // 3. 检索记忆上下文（可选，补全场景可能不需要）
      const memoryContext = await this.memoryPort.retrieveContext(intent);

      // 4. 直接执行Agent
      const result = await agent.execute({ intent, memoryContext });

      // 5. 记录耗时
      const duration = Date.now() - startTime;

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 智能选择Agent（基于性能评分）
   */
  private async selectBestAgent(
    intent: Intent,
    candidates: IAgent[],
    memoryContext: MemoryContext
  ): Promise<IAgent> {
    // 如果只有一个候选，直接返回
    if (candidates.length === 1) {
      return candidates[0];
    }

    // 并行获取各Agent的历史性能
    const performances = await Promise.all(
      candidates.map(async (agent) => ({
        agent,
        perf: await this.memoryPort.getAgentPerformance(agent.id, intent.name)
      }))
    );

    // ✅ 使用深化评分算法：成功率(Wilson下限) + 速度 + 用户偏好
    const scored = performances.map(({ agent, perf }) => {
      // 1. 成功率计算（使用Wilson下限处理小样本）
      const successRate = this.calculateSuccessRate(perf);
      
      // 2. 速度评分（目标响应时间3秒）
      const speedScore = this.calculateSpeedScore(perf.avgDurationMs);
      
      // 3. 用户偏好加分
      const preferenceBonus = this.calculatePreferenceBonus(
        memoryContext,
        agent.id
      );

      // 4. 综合评分：成功率(0.6) + 速度(0.3) + 偏好(0.1)
      const score = successRate * 0.6 + speedScore * 0.3 + preferenceBonus;
      
      return { agent, score };
    });

    // ✅ 防御性编程：确保数组非空
    if (scored.length === 0) {
      return candidates[0];
    }

    // 返回得分最高的Agent
    const bestAgent = scored.sort((a, b) => b.score - a.score)[0].agent;
    return bestAgent;
  }

  /**
   * 计算成功率（使用Wilson下限处理小样本）
   * 
   * @param perf Agent性能数据
   * @returns 成功率（0-1）
   */
  private calculateSuccessRate(perf: { totalAttempts: number; successCount: number }): number {
    if (perf.totalAttempts === 0) {
      return 0.5; // 无历史数据，默认中等
    }
    
    // 使用 Wilson 下限处理小样本（避免 1/1 = 100% 的假象）
    const z = 1.96; // 95% 置信度
    const p = perf.successCount / perf.totalAttempts;
    const n = perf.totalAttempts;
    
    const wilsonLower = (p + z*z/(2*n) - z * Math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n);
    return Math.max(0, Math.min(1, wilsonLower));
  }

  /**
   * 计算速度评分
   * 
   * @param avgDurationMs 平均耗时（毫秒）
   * @returns 速度评分（0-1）
   */
  private calculateSpeedScore(avgDurationMs: number): number {
    if (avgDurationMs === 0) return 0.5;
    
    // 目标响应时间：解释代码 3s，生成代码 5s
    const targetMs = 3000;
    return Math.min(1, targetMs / avgDurationMs);
  }

  /**
   * 计算用户偏好加分
   * 
   * @param memoryContext 记忆上下文
   * @param agentId Agent ID
   * @returns 偏好加分（0或0.1）
   */
  private calculatePreferenceBonus(memoryContext: MemoryContext, agentId: string): number {
    return memoryContext.userPreferences?.preferredAgent === agentId ? 0.1 : 0;
  }
}
