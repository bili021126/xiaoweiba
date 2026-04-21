/**
 * 记忆端口 - 应用层访问记忆能力的唯一入口
 * 
 * 所有对情景记忆、偏好记忆的读写必须通过此端口
 * 遵循依赖倒置原则：上层依赖接口，下层实现接口
 */

import { Intent } from '../domain/Intent';
import { MemoryContext, EpisodicMemoryItem } from '../../core/domain/MemoryContext'; // ✅ 新增导入
import { TaskCompletedEvent, FeedbackGivenEvent } from '../events/DomainEvent';

/**
 * 推荐项
 */
export interface Recommendation {
  title: string;
  timestamp: number;
  memoryId: string;
}

/**
 * Agent性能数据
 */
export interface AgentPerformance {
  totalAttempts: number;
  successCount: number;
  avgDurationMs: number;
}

/**
 * 记忆端口接口
 */
export interface IMemoryPort {
  /**
   * 根据意图检索相关记忆上下文
   * @param intent 用户意图
   * @returns 记忆上下文（情景记忆 + 偏好推荐）
   */
  retrieveContext(intent: Intent): Promise<MemoryContext>;

  /**
   * 记录任务完成事件到记忆系统
   * @param event 任务完成事件
   */
  recordTaskCompletion(event: TaskCompletedEvent): Promise<void>;

  /**
   * 记录用户反馈事件
   * @param event 用户反馈事件
   */
  recordFeedback(event: FeedbackGivenEvent): Promise<void>;

  /**
   * 主动推荐：根据当前文件推荐相关历史记忆
   * @param filePath 文件路径
   * @returns 推荐列表
   */
  recommendForFile(filePath: string): Promise<Recommendation[]>;

  /**
   * 获取 Agent 性能历史（用于调度决策）
   * @param agentId Agent 标识
   * @param intentName 意图名称
   */
  getAgentPerformance(agentId: string, intentName: string): Promise<AgentPerformance>;

  /**
   * 记录 Agent 执行结果（更新性能数据）
   * @param agentId Agent 标识
   * @param intentName 意图名称
   * @param success 是否成功
   * @param durationMs 耗时
   */
  recordAgentExecution(agentId: string, intentName: string, success: boolean, durationMs: number): Promise<void>;

  // ========== ✅ P1-02: 会话管理 ==========

  /**
   * 创建新会话
   * @param sessionId 会话ID
   * @param metadata 元数据（可选）
   */
  createSession(sessionId: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * 加载会话历史
   * @param sessionId 会话ID
   * @returns 消息列表
   */
  loadSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string; timestamp: number }>>;

  /**
   * 删除会话
   * @param sessionId 会话ID
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * 列出所有会话（按最后活跃时间倒序）
   * @returns 会话列表
   */
  listSessions(): Promise<Array<{ id: string; title: string; lastActiveAt: number; messageCount: number }>>;

  /**
   * 保存消息到会话
   * @param sessionId 会话ID
   * @param role 角色（user/assistant）
   * @param content 内容
   */
  saveMessage(sessionId: string, role: string, content: string): Promise<void>;

  /**
   * ✅ 检索所有情景记忆（用于导出等全量操作）
   */
  retrieveAll(options?: { limit?: number }): Promise<EpisodicMemoryItem[]>;

  /**
   * ✅ 直接记录一条记忆（用于导入等操作）
   */
  recordMemory(record: {
    taskType: string;
    summary: string;
    entities: string[];
    outcome: string;
    modelId?: string;
    durationMs?: number;
    metadata?: Record<string, any>;
  }): Promise<string>;
}
