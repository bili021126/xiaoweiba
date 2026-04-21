/**
 * Agent运行器 - 订阅AgentSelectedEvent并执行Agent
 * 
 * 职责：
 * 1. 订阅AgentSelectedEvent领域事件
 * 2. 从IAgentRegistry获取Agent实例
 * 3. 执行Agent的execute方法
 * 4. 发布TaskCompletedEvent或TaskFailedEvent
 */

import { injectable, inject } from 'tsyringe';
import { IEventBus } from '../../core/ports/IEventBus';
import { IAgentRegistry } from '../../core/ports/IAgentRegistry';
import { 
  AgentSelectedEvent, 
  TaskCompletedEvent, 
  TaskFailedEvent 
} from '../../core/events/DomainEvent';
import { IAgent } from '../../core/agent/IAgent';
import { AuditLogger } from '../../core/security/AuditLogger';

@injectable()
export class AgentRunner {
  private unsubscribe?: () => void;
  private isExecuting = false; // ✅ 并发控制标志
  private pendingTasks: Array<{ event: AgentSelectedEvent; resolve: () => void }> = []; // ✅ 待执行任务队列

  constructor(
    @inject('IEventBus') private eventBus: IEventBus,
    @inject('IAgentRegistry') private agentRegistry: IAgentRegistry,
    @inject(AuditLogger) private auditLogger: AuditLogger
    // ✅ 移除IMemoryPort依赖，让MemoryAdapter通过订阅事件来处理
  ) {
    this.subscribeToEvents();
  }

  /**
   * 订阅领域事件
   */
  private subscribeToEvents(): void {
    // 订阅Agent选定事件
    this.unsubscribe = this.eventBus.subscribe(
      AgentSelectedEvent.type,
      async (event: AgentSelectedEvent) => {
        await this.handleAgentSelected(event);
      }
    );

    console.log('[AgentRunner] Subscribed to AgentSelectedEvent');
  }

  /**
   * 处理Agent选定事件
   */
  private async handleAgentSelected(event: AgentSelectedEvent): Promise<void> {
    // ✅ 并发控制：如果正在执行，加入队列等待
    if (this.isExecuting) {
      console.warn('[AgentRunner] Agent already executing, queuing task...');
      return new Promise((resolve) => {
        this.pendingTasks.push({ event, resolve });
      });
    }

    this.isExecuting = true;
    
    try {
      await this.executeAgent(event);
    } finally {
      this.isExecuting = false;
      // ✅ 执行下一个待处理任务
      const nextTask = this.pendingTasks.shift();
      if (nextTask) {
        console.log('[AgentRunner] Executing queued task...');
        setTimeout(() => {
          this.handleAgentSelected(nextTask.event).then(nextTask.resolve);
        }, 0);
      }
    }
  }

  /**
   * 实际执行Agent逻辑（提取为独立方法）
   */
  private async executeAgent(event: AgentSelectedEvent): Promise<void> {
    const { intent, agentId, memoryContext } = event.payload;
    const startTime = Date.now();

    console.log(`[AgentRunner] Executing agent: ${agentId} for intent: ${intent.name}`);

    try {
      // 1. 从注册表获取Agent实例
      const agent = this.agentRegistry.getAgent(agentId);
      
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // 2. 检查Agent是否可用
      if (agent.isAvailable) {
        const available = await agent.isAvailable();
        if (!available) {
          throw new Error(`Agent ${agentId} is not available`);
        }
      }

      // 3. 执行Agent（带超时控制）
      const result = await this.executeWithTimeout(agent, { intent, memoryContext });

      const durationMs = Date.now() - startTime;

      // ✅ P1-04: 生成 actionId（用于记忆追踪）
      const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 4. ✅ 只发布事件，让 MemoryAdapter 订阅处理（解耦）
      this.eventBus.publish(new TaskCompletedEvent(
        intent,
        agent.id,
        result,
        durationMs,
        result.modelId, // ✅ 传递模型ID
        result.memoryMetadata, // ✅ P1-02: 传递记忆元数据
        actionId // ✅ P1-04: 传递 actionId
      ));

      console.log(`[AgentRunner] Agent ${agentId} completed successfully in ${durationMs}ms`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`[AgentRunner] Agent ${agentId} failed:`, errorMessage);

      // ✅ 记录审计日志（用于调试和监控）- 添加防御性检查
      if (this.auditLogger) {
        await this.auditLogger.log('agent_execution', 'failure', durationMs, {
          parameters: {
            agentId,
            intentName: intent.name,
            error: errorMessage
          }
        });
      } else {
        console.warn('[AgentRunner] AuditLogger not available, skipping audit log');
      }

      // 发布任务失败事件（用于监控和调试）
      this.eventBus.publish(new TaskFailedEvent(
        intent,
        agentId,
        error instanceof Error ? error : new Error(errorMessage),
        durationMs
      ));
    }
  }

  /**
   * 带超时控制的Agent执行
   */
  private async executeWithTimeout(
    agent: IAgent,
    input: { intent: any; memoryContext: any },
    timeoutMs: number = 30000
  ): Promise<any> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Agent ${agent.id} execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        agent.execute(input),
        timeoutPromise
      ]);
    } finally {
      // ✅ 清理定时器，防止内存泄漏
      clearTimeout(timeoutId!);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      console.log('[AgentRunner] Unsubscribed from events');
    }
  }
}
