import { IAgent, AgentCapability, AgentMetadata, AgentResult } from '../core/agent/IAgent';
import { IMemoryPort } from '../core/ports/IMemoryPort';
import { IEventBus } from '../core/ports/IEventBus';
import { MemoryContext } from '../core/domain/MemoryContext';
import { Intent } from '../core/domain/Intent';
import { AssistantResponseEvent, SessionListUpdatedEvent, SessionHistoryLoadedEvent } from '../core/events/DomainEvent'; // ✅ P1-04: 引入新事件
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
    const now = new Date();
    const friendlyTitle = `新会话 ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // ✅ P1-02: 持久化到数据库（使用友好标题）
    await this.memoryPort.createSession(sessionId, {
      title: friendlyTitle,
      createdAt: Date.now()
    });

    console.log('[SessionManagementAgent] Created session:', sessionId, 'with title:', friendlyTitle);

    // ✅ 发布会话列表更新事件（通知前端刷新列表）
    this.eventBus.publish(new SessionListUpdatedEvent('created', sessionId));

    // ✅ DeepSeek 风格：简洁的成功提示，不暴露技术 ID
    this.eventBus.publish(new AssistantResponseEvent({
      messageId: `msg_${Date.now()}_system`,
      content: `✨ 已创建新会话`,
      timestamp: Date.now()
    }));

    return {
      success: true,
      data: { sessionId, title: friendlyTitle },
      durationMs: Date.now() - startTime,
      // ✅ P1-02: 添加记忆元数据
      memoryMetadata: {
        taskType: 'SESSION_MANAGEMENT',
        summary: `创建了新会话：${friendlyTitle}`,
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
    
    console.log('[SessionManagementAgent] Handling switch session:', sessionId);
    
    if (!sessionId) {
      throw new Error('缺少会话ID');
    }

    // ✅ P1-02: 从数据库加载会话历史
    console.log('[SessionManagementAgent] Loading session history from database...');
    const history = await this.memoryPort.loadSessionHistory(sessionId);
    console.log('[SessionManagementAgent] Loaded', history.length, 'messages');

    // ✅ P1-04: 发布会话历史加载事件（携带完整历史供前端渲染）
    const messages = history.map((msg, index) => ({
      id: `msg_${msg.timestamp}_${index}`,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }));
    
    console.log('[SessionManagementAgent] Publishing SessionHistoryLoadedEvent with', messages.length, 'messages');
    this.eventBus.publish(new SessionHistoryLoadedEvent(sessionId, messages));

    // ✅ 发布会话列表更新事件（通知前端当前会话已切换）
    this.eventBus.publish(new SessionListUpdatedEvent('switched', sessionId));

    // ✅ DeepSeek 风格：简洁提示，显示消息数量
    this.eventBus.publish(new AssistantResponseEvent({
      messageId: `msg_${Date.now()}_system`,
      content: history.length > 0 
        ? `🔄 已切换会话（${history.length} 条消息）`
        : `🔄 已切换到新会话`,
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


