import { IAgent, AgentRegistration } from './IAgent';

/**
 * Agent管理器
 * 
 * 负责Agent的注册、路由和生命周期管理
 * 当前为预留架构，未来可扩展多Agent协作
 */
export class AgentManager {
  private agents: Map<string, AgentRegistration> = new Map();
  private activeAgentId: string | null = null;

  /**
   * 注册Agent
   * @param registration Agent注册信息
   */
  register(registration: AgentRegistration): void {
    const agent = registration.agent;

    if (this.agents.has(agent.id)) {
      throw new Error(`Agent已存在: ${agent.id}`);
    }

    this.agents.set(agent.id, registration);

    // 如果设置为自动激活且当前无活跃Agent，则激活
    if (registration.autoActivate && !this.activeAgentId) {
      this.activeAgentId = agent.id;
    }
  }

  /**
   * 注销Agent
   * @param agentId Agent ID
   */
  async unregister(agentId: string): Promise<void> {
    const registration = this.agents.get(agentId);
    if (!registration) {
      throw new Error(`Agent不存在: ${agentId}`);
    }
    //写一个求和函数，计算1到100的和



    // 如果注销的是当前活跃Agent，切换到下一个
    if (this.activeAgentId === agentId) {
      this.activeAgentId = null;
      const nextAgent = this.getNextAvailableAgent();
      if (nextAgent) {
        this.activeAgentId = nextAgent.agent.id;
      }
    }

    await registration.agent.destroy();
    this.agents.delete(agentId);
  }

  /**
   * 获取Agent
   * @param agentId Agent ID
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * 获取当前活跃Agent
   */
  getActiveAgent(): IAgent | null {
    if (!this.activeAgentId) {
      return null;
    }
    return this.agents.get(this.activeAgentId)?.agent || null;
  }

  /**
   * 切换活跃Agent
   * @param agentId Agent ID
   */
  switchAgent(agentId: string): void {
    if (!this.agents.has(agentId)) {
      throw new Error(`Agent不存在: ${agentId}`);
    }

    this.activeAgentId = agentId;
  }

  /**
   * 根据能力查找Agent
   * @param capabilityType 能力类型
   * @returns 匹配的Agent列表（按优先级排序）
   */
  findByCapability(capabilityType: string): IAgent[] {
    const matches: Array<{ agent: IAgent; priority: number }> = [];

    for (const registration of this.agents.values()) {
      const hasCapability = registration.agent.capabilities.some(
        cap => cap.type === capabilityType
      );

      if (hasCapability && registration.agent.isAvailable()) {
        matches.push({
          agent: registration.agent,
          priority: registration.priority
        });
      }
    }

    // 按优先级排序
    matches.sort((a, b) => a.priority - b.priority);
    return matches.map(m => m.agent);
  }

  /**
   * 执行任务（自动路由到合适的Agent）
   * @param taskType 任务类型
   * @param input 任务输入
   * @param context 执行上下文
   */
  async executeTask(taskType: string, input: any, context?: Record<string, any>): Promise<any> {
    // 查找能处理该任务的Agent
    const agents = this.findByCapability(taskType);

    if (agents.length === 0) {
      throw new Error(`没有可用的Agent处理任务类型: ${taskType}`);
    }

    // 使用第一个（优先级最高）的Agent
    const selectedAgent = agents[0];
    return await selectedAgent.execute(input, context);
  }

  /**
   * 初始化所有Agent
   */
  async initializeAll(): Promise<void> {
    for (const registration of this.agents.values()) {
      try {
        await registration.agent.initialize();
      } catch (error) {
        console.error(`[AgentManager] Agent初始化失败: ${registration.agent.id}`, error);
      }
    }
  }

  /**
   * 销毁所有Agent
   */
  async destroyAll(): Promise<void> {
    for (const registration of this.agents.values()) {
      try {
        await registration.agent.destroy();
      } catch (error) {
        console.error(`[AgentManager] Agent销毁失败: ${registration.agent.id}`, error);
      }
    }
    this.agents.clear();
    this.activeAgentId = null;
  }

  /**
   * 获取所有注册的Agent
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values()).map(reg => reg.agent);
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; active: string | null; byType: Record<string, number> } {
    const byType: Record<string, number> = {};

    for (const registration of this.agents.values()) {
      for (const capability of registration.agent.capabilities) {
        byType[capability.type] = (byType[capability.type] || 0) + 1;
      }
    }

    return {
      total: this.agents.size,
      active: this.activeAgentId,
      byType
    };
  }

  /**
   * 获取下一个可用的Agent
   */
  private getNextAvailableAgent(): AgentRegistration | null {
    const agents = Array.from(this.agents.entries())
      .filter(([_, reg]) => reg.agent.isAvailable())
      .sort((a, b) => a[1].priority - b[1].priority);

    return agents.length > 0 ? agents[0][1] : null;
  }
}
