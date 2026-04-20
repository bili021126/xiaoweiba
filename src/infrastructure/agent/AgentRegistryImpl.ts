/**
 * Agent注册表实现
 * 
 * 职责：
 * 1. 管理所有注册的Agents
 * 2. 根据意图查找候选Agents
 * 3. 根据ID获取Agent
 */

import { injectable } from 'tsyringe';
import { IAgentRegistry } from '../../core/ports/IAgentRegistry';
import { IAgent } from '../../core/agent/IAgent';
import { Intent } from '../../core/domain/Intent';

@injectable()
export class AgentRegistryImpl implements IAgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  /**
   * 注册Agent
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`[AgentRegistry] Agent ${agent.id} already registered, overwriting`);
    }
    this.agents.set(agent.id, agent);
  }

  /**
   * 根据意图查找候选Agents
   */
  findAgentsForIntent(intent: Intent): IAgent[] {
    const candidates: IAgent[] = [];
    
    for (const agent of this.agents.values()) {
      if (agent.supportedIntents.includes(intent.name)) {
        candidates.push(agent);
      }
    }
    
    // 按优先级排序（如果有）
    candidates.sort((a, b) => {
      const priorityA = a.getCapabilities()?.find(c => c.name === intent.name)?.priority || 0;
      const priorityB = b.getCapabilities()?.find(c => c.name === intent.name)?.priority || 0;
      return priorityB - priorityA; // 降序
    });
    
    return candidates;
  }

  /**
   * 获取所有Agents
   */
  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 根据ID获取Agent
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.agents.clear();
  }

  /**
   * 注销Agent（动态卸载）
   */
  unregister(agentId: string): boolean {
    const existed = this.agents.delete(agentId);
    if (existed) {
      // 可选：记录审计日志或通知其他组件
    }
    return existed;
  }
}
