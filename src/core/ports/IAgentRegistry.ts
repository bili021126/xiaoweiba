/**
 * Agent注册表端口
 */

import { IAgent } from '../agent/IAgent';
import { Intent } from '../domain/Intent';

/**
 * Agent注册表接口
 */
export interface IAgentRegistry {
  /**
   * 注册Agent
   */
  register(agent: IAgent): void;

  /**
   * 根据意图查找能处理的Agent列表
   * @returns 按能力优先级排序
   */
  findAgentsForIntent(intent: Intent): IAgent[];

  /**
   * 获取所有Agent
   */
  getAll(): IAgent[];

  /**
   * 根据ID获取Agent
   * @param agentId Agent ID
   * @returns Agent实例，如果不存在返回undefined
   */
  getAgent(agentId: string): IAgent | undefined;
}
