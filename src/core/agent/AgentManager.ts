/**
 * Agent管理器 - 管理所有注册的Agent
 * 
 * 职责：
 * 1. 注册/注销Agent
 * 2. 根据能力查找合适的Agent
 * 3. 管理Agent生命周期
 */

import { injectable } from 'tsyringe';
import { IAgent, AgentRegistration, AgentCapability, AgentMetadata } from './IAgent';
import { EventBus, CoreEventType } from '../eventbus/EventBus';

@injectable()
export class AgentManager {
  private agents: Map<string, IAgent> = new Map();
  private registrations: Map<string, AgentRegistration> = new Map();
  private initialized: boolean = false;

  constructor(private eventBus: EventBus) {}

  /**
   * 初始化Agent管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[AgentManager] Initializing...');
    
    // 发布所有已注册Agent的能力
    for (const [id, registration] of this.registrations.entries()) {
      if (registration.enabled !== false) {
        const agent = await this.resolveAgent(registration);
        this.agents.set(id, agent);
        
        // 发布注册事件
        this.eventBus.publish('plugin.agent.register', {
          agentId: id,
          capabilities: agent.getCapabilities()
        }, { source: 'AgentManager' });
      }
    }
    
    this.initialized = true;
    console.log(`[AgentManager] Initialized with ${this.agents.size} agents`);
  }

  /**
   * 注册Agent
   * 
   * @param id Agent唯一标识
   * @param registration 注册信息
   */
  registerAgent(id: string, registration: AgentRegistration): void {
    this.registrations.set(id, registration);
    console.log(`[AgentManager] Registered agent: ${id}`);
  }

  /**
   * 获取Agent实例
   * 
   * @param id Agent ID
   * @returns Agent实例，如果不存在返回undefined
   */
  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * 根据能力查找Agent
   * 
   * @param capabilityName 能力名称（如 'explain', 'generate'）
   * @returns 匹配的Agent列表（按优先级排序）
   */
  findAgentsByCapability(capabilityName: string): IAgent[] {
    const matchingAgents: Array<{ agent: IAgent; priority: number }> = [];
    
    for (const agent of this.agents.values()) {
      const capabilities = agent.getCapabilities();
      const matchingCap = capabilities.find(cap => cap.name === capabilityName);
      
      if (matchingCap) {
        matchingAgents.push({
          agent,
          priority: matchingCap.priority || 0
        });
      }
    }
    
    // 按优先级降序排序
    matchingAgents.sort((a, b) => b.priority - a.priority);
    
    return matchingAgents.map(item => item.agent);
  }

  /**
   * 获取所有已注册的Agent
   * 
   * @returns Agent列表
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取Agent元数据
   * 
   * @param id Agent ID
   * @returns 元数据，如果不存在返回undefined
   */
  getAgentMetadata(id: string): AgentMetadata | undefined {
    const agent = this.agents.get(id);
    return agent?.metadata;
  }

  /**
   * 检查Agent是否可用
   * 
   * @param id Agent ID
   * @returns 是否可用
   */
  async isAgentAvailable(id: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;
    
    try {
      // isAvailable是可选方法，如果不存在则认为可用
      if (agent.isAvailable) {
        const available = await agent.isAvailable();
        return available;
      }
      return true; // 默认认为可用
    } catch (error) {
      console.error(`[AgentManager] Error checking availability for ${id}:`, error);
      return false;
    }
  }

  /**
   * 注销Agent
   * 
   * @param id Agent ID
   */
  async unregisterAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      if (agent.dispose) {
        await agent.dispose();
      }
      this.agents.delete(id);
      this.registrations.delete(id);
      
      console.log(`[AgentManager] Unregistered agent: ${id}`);
    }
  }

  /**
   * 清理所有Agent
   */
  async dispose(): Promise<void> {
    console.log('[AgentManager] Disposing all agents...');
    
    for (const [id, agent] of this.agents.entries()) {
      try {
        if (agent.dispose) {
          await agent.dispose();
        }
      } catch (error) {
        console.error(`[AgentManager] Error disposing agent ${id}:`, error);
      }
    }
    
    this.agents.clear();
    this.registrations.clear();
    this.initialized = false;
    
    console.log('[AgentManager] Disposed');
  }

  /**
   * 解析Agent（支持工厂函数）
   */
  private async resolveAgent(registration: AgentRegistration): Promise<IAgent> {
    if (typeof registration.agent === 'function') {
      return await registration.agent();
    }
    return registration.agent;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalAgents: number;
    enabledAgents: number;
    agentsByCapability: Record<string, number>;
  } {
    const agentsByCapability: Record<string, number> = {};
    let enabledCount = 0;
    
    for (const agent of this.agents.values()) {
      enabledCount++;
      
      const capabilities = agent.getCapabilities();
      for (const cap of capabilities) {
        agentsByCapability[cap.name] = (agentsByCapability[cap.name] || 0) + 1;
      }
    }
    
    return {
      totalAgents: this.registrations.size,
      enabledAgents: enabledCount,
      agentsByCapability
    };
  }
}
