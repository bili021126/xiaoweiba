import { IAgent, AgentCapability, AgentMetadata, AgentResult } from '../core/agent/IAgent';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus';
import { MemoryContext } from '../core/domain/MemoryContext';
import { Intent } from '../core/domain/Intent';
import { AssistantResponseEvent, SessionListUpdatedEvent } from '../core/events/DomainEvent';
import { injectable, inject } from 'tsyringe';
import * as vscode from 'vscode';

/**
 * 会话管理Agent
 * 
 * 职责：
 * 1. 新建会话
 * 2. 切换会话
 * 3. 删除会话
 * 4. 加载会话历史
 */
@injectable()
export class SessionManagementAgent implements IAgent {
  readonly id = 'session_management_agent';
  readonly name = '会话管理助手';
  readonly supportedIntents = ['new_session', 'switch_session', 'delete_session'];
  
  readonly metadata: AgentMetadata = {
    version: '1.0.0',
    description: '管理聊天会话（新建、切换、删除）',
    author: 'XiaoWeiBa Team',
    tags: ['session', 'management']
  };

  private initialized = false;

  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    if (!this.initialized) {
      throw new Error('Agent未初始化');
    }

    const startTime = Date.now();
    const { intent } = params;

    try {
      switch (intent.name) {
        case 'new_session':
          return await this.handleNewSession(startTime);
        
        case 'switch_session':
          return await this.handleSwitchSession(intent, startTime);
        
        case 'delete_session':
          return await this.handleDeleteSession(intent, startTime);
        
        default:
          throw new Error(`不支持的意图: ${intent.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 发布错误响应
      this.eventBus.publish(new AssistantResponseEvent({
        messageId: `msg_${Date.now()}_error`,
        content: `会话操作失败：${errorMessage}`,
        timestamp: Date.now()
      }));

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * 处理新建会话
   */
  private async handleNewSession(startTime: number): Promise<AgentResult> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // ✅ P1-02: 持久化到数据库
    await this.memoryPort.createSession(sessionId, {
      title: `会话 ${new Date().toLocaleString()}`,
      createdAt: Date.now()
    });

    // ✅ 发布会话列表更新事件（通知前端刷新列表）
    this.eventBus.publish(new SessionListUpdatedEvent('created', sessionId));

    // 发布成功响应
    this.eventBus.publish(new AssistantResponseEvent({
      messageId: `msg_${Date.now()}_system`,
      content: `✅ 已创建新会话 (ID: ${sessionId})`,
      timestamp: Date.now()
    }));

    return {
      success: true,
      data: { sessionId },
      durationMs: Date.now() - startTime,
      // ✅ P1-02: 添加记忆元数据
      memoryMetadata: {
        taskType: 'SESSION_MANAGEMENT',
        summary: `创建了新会话 ${sessionId}`,
        entities: [sessionId],
        outcome: 'SUCCESS'
      }
    };
  }

  /**
   * 处理切换会话
   */
  private async handleSwitchSession(intent: Intent, startTime: number): Promise<AgentResult> {
    const sessionId = intent.userInput;
    
    if (!sessionId) {
      throw new Error('缺少会话ID');
    }

    // ✅ P1-02: 从数据库加载会话历史
    const history = await this.memoryPort.loadSessionHistory(sessionId);

    // ✅ 发布会话列表更新事件（通知前端当前会话已切换）
    this.eventBus.publish(new SessionListUpdatedEvent('switched', sessionId));

    // 发布成功响应（包含历史消息数量）
    this.eventBus.publish(new AssistantResponseEvent({
      messageId: `msg_${Date.now()}_system`,
      content: `🔄 已切换到会话 (ID: ${sessionId}, ${history.length} 条消息)`,
      timestamp: Date.now()
    }));

    return {
      success: true,
      data: { sessionId, messageCount: history.length },
      durationMs: Date.now() - startTime,
      // ✅ P1-02: 添加记忆元数据
      memoryMetadata: {
        taskType: 'SESSION_MANAGEMENT',
        summary: `切换到会话 ${sessionId}（${history.length} 条消息）`,
        entities: [sessionId],
        outcome: 'SUCCESS'
      }
    };
  }

  /**
   * 处理删除会话
   */
  private async handleDeleteSession(intent: Intent, startTime: number): Promise<AgentResult> {
    const sessionId = intent.userInput;
    
    if (!sessionId) {
      throw new Error('缺少会话ID');
    }

    // ✅ P1-02: 从数据库删除会话
    await this.memoryPort.deleteSession(sessionId);

    // ✅ 发布会话列表更新事件（通知前端刷新列表）
    this.eventBus.publish(new SessionListUpdatedEvent('deleted', sessionId));

    // 发布成功响应
    this.eventBus.publish(new AssistantResponseEvent({
      messageId: `msg_${Date.now()}_system`,
      content: `🗑️ 已删除会话 (ID: ${sessionId})`,
      timestamp: Date.now()
    }));

    return {
      success: true,
      data: { sessionId },
      durationMs: Date.now() - startTime,
      // ✅ P1-02: 添加记忆元数据
      memoryMetadata: {
        taskType: 'SESSION_MANAGEMENT',
        summary: `删除了会话 ${sessionId}`,
        entities: [sessionId],
        outcome: 'SUCCESS'
      }
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized;
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'session_management',
        description: '管理聊天会话（新建、切换、删除）',
        priority: 5
      }
    ];
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}


