import * as vscode from 'vscode';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { LLMTool } from '../tools/LLMTool';

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    codeBlocks?: { language: string; code: string }[];
    usedMemoryIds?: string[];
    command?: string;  // '/explain', '/generate' 等
  };
}

/**
 * 聊天会话接口
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 会话管理器
 * 
 * 负责管理聊天会话的创建、切换、删除和持久化
 */
export class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private currentSessionId: string | null = null;
  private readonly MAX_SESSIONS = 20;
  private readonly STORAGE_KEY_SESSIONS = 'xiaoweiba.chatSessions';
  private readonly STORAGE_KEY_CURRENT = 'xiaoweiba.currentSessionId';

  constructor(
    private context: vscode.ExtensionContext,
    private episodicMemory?: EpisodicMemory,
    private llmTool?: LLMTool
  ) {
    this.loadSessions();
  }

  /**
   * 创建新会话
   */
  createSession(): ChatSession {
    const session: ChatSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    // 如果会话数量超过限制，删除最旧的会话
    if (this.sessions.size > this.MAX_SESSIONS) {
      this.removeOldestSession();
    }

    this.persistSessions();
    return session;
  }

  /**
   * 切换到指定会话
   */
  switchSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // 切换前对旧会话生成摘要（如果消息数>=5）
    const oldSession = this.getCurrentSession();
    if (oldSession && oldSession.messages.length >= 5) {
      this.summarizeSessionLocal(oldSession).catch(err => {
        console.warn('[SessionManager] 会话摘要生成失败:', err);
      });
    }

    this.currentSessionId = sessionId;
    this.persistSessions();
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // 删除前生成摘要（如果消息数>=5）
    const session = this.sessions.get(sessionId);
    if (session && session.messages.length >= 5) {
      this.summarizeSessionLocal(session).catch(err => {
        console.warn('[SessionManager] 会话摘要生成失败:', err);
      });
    }

    this.sessions.delete(sessionId);

    // 如果删除的是当前会话，切换到另一个会话或创建新会话
    if (this.currentSessionId === sessionId) {
      const remainingSessions = Array.from(this.sessions.keys());
      if (remainingSessions.length > 0) {
        this.currentSessionId = remainingSessions[0];
      } else {
        this.createSession();
      }
    }

    this.persistSessions();
  }

  /**
   * 获取会话列表
   */
  getSessionList(): Array<{ id: string; title: string; messageCount: number; createdAt: number }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      title: session.title || `会话 ${new Date(session.createdAt).toLocaleString()}`,
      messageCount: session.messages.length,
      createdAt: session.createdAt
    })).sort((a, b) => b.createdAt - a.createdAt); // 按创建时间降序
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): ChatSession | null {
    if (!this.currentSessionId) {
      return null;
    }
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * 获取所有会话列表
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  /**
   * 获取最近的消息
   */
  getRecentMessages(count: number = 5): ChatMessage[] {
    const session = this.getCurrentSession();
    if (!session) {
      return [];
    }

    return session.messages.slice(-count);
  }

  /**
   * 添加消息到当前会话
   */
  addMessage(message: ChatMessage): void {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('没有活跃的会话');
    }

    session.messages.push(message);
    session.updatedAt = Date.now();

    // 如果是第一条用户消息，自动生成会话标题
    if (session.messages.length === 1 && message.role === 'user') {
      session.title = this.generateTitle(message.content);
    }

    // 检查是否需要生成会话摘要
    if (session.messages.length >= 10 && session.messages.length % 10 === 0) {
      this.summarizeSession(session).catch(err => {
        console.error('[SessionManager] 会话摘要生成失败:', err);
      });
    }

    this.persistSessions();
  }

  /**
   * 生成会话标题
   */
  private generateTitle(firstMessage: string): string {
    // 截取前30个字符作为标题
    const title = firstMessage.trim().substring(0, 30);
    return title.length > 0 ? title : '新会话';
  }

  /**
   * 生成会话摘要并存储到情景记忆（使用LLM）
   * @deprecated 已改用summarizeSessionLocal实现零API成本
   */
  private async summarizeSession(session: ChatSession): Promise<void> {
    if (!this.llmTool || !this.episodicMemory) {
      return; // 依赖未初始化，跳过
    }

    if (session.messages.length < 10) {
      return; // 消息太少，不生成摘要
    }

    try {
      const conversationText = session.messages
        .slice(-20) // 只使用最近20条消息
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n');

      const prompt = `请为以下对话生成一个简短的摘要（不超过50字），并提取关键实体（技术名词、函数名、项目名等，以逗号分隔）。

对话历史：
${conversationText}

输出格式：
摘要：<摘要>
实体：<实体1,实体2,...>`;

      const result = await this.llmTool.call({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 150,
        temperature: 0.3
      });

      if (result.success && result.data) {
        const { summary, entities } = this.parseSummary(result.data);

        // 记录到情景记忆
        await this.episodicMemory.record({
          taskType: 'CHAT_COMMAND',
          summary,
          entities,
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: 0,
          metadata: { sessionId: session.id }
        });

        console.log('[SessionManager] 会话摘要生成成功:', summary);
      }
    } catch (error) {
      console.error('[SessionManager] 会话摘要生成失败:', error);
    }
  }

  /**
   * 解析摘要文本
   */
  private parseSummary(text: string): { summary: string; entities: string[] } {
    const summaryMatch = text.match(/摘要[:：]\s*(.+?)(?=\n实体[:：]|$)/s);
    const entitiesMatch = text.match(/实体[:：]\s*(.+?)$/s);

    const summary = summaryMatch ? summaryMatch[1].trim() : text.substring(0, 50);
    const entitiesStr = entitiesMatch ? entitiesMatch[1].trim() : '';
    const entities = entitiesStr.split(/[,，]/).map(e => e.trim()).filter(e => e.length > 0);

    return { summary, entities };
  }

  /**
   * 使用本地规则生成会话摘要（零API成本）
   */
  private async summarizeSessionLocal(session: ChatSession): Promise<void> {
    if (!this.episodicMemory) {
      console.warn('[SessionManager] EpisodicMemory未初始化，跳过摘要生成');
      return; // EpisodicMemory未初始化，跳过
    }

    console.log(`[SessionManager] 检查会话 ${session.id} 是否需要摘要: ${session.messages.length} 条消息`);
    
    if (session.messages.length < 5) {
      console.log(`[SessionManager] 会话消息不足5条 (${session.messages.length})，跳过摘要生成`);
      return; // 消息太少，不生成摘要
    }

    try {
      const { summary, entities } = this.generateLocalSummary(session);
      console.log(`[SessionManager] 生成摘要: "${summary}"`);
      console.log(`[SessionManager] 提取实体: [${entities.join(', ')}]`);

      // 记录到情景记忆
      const recordId = await this.episodicMemory.record({
        taskType: 'CHAT_COMMAND',
        summary,
        entities,
        outcome: 'SUCCESS',
        modelId: 'local-rule', // 标记为本地规则生成
        durationMs: 0,
        metadata: { sessionId: session.id }
      });

      console.log('[SessionManager] 本地规则摘要生成成功，recordId:', recordId);
    } catch (error) {
      console.error('[SessionManager] 本地规则摘要生成失败:', error);
    }
  }

  /**
   * 使用本地规则生成会话摘要
   */
  private generateLocalSummary(session: ChatSession): { summary: string; entities: string[] } {
    const userMessages = session.messages
      .filter(m => m.role === 'user')
      .map(m => m.content);

    if (userMessages.length === 0) {
      return { summary: '空会话', entities: [] };
    }

    // 规则：取第一条用户消息的前30字 + 最后一条用户消息的关键词
    const first = userMessages[0]?.slice(0, 30) || '';
    const last = userMessages[userMessages.length - 1]?.slice(0, 20) || '';

    // 提取关键实体（简单正则匹配技术名词）
    const allText = userMessages.join(' ');
    const techTerms = allText.match(/\b(function|class|interface|type|const|let|import|export|async|await|Promise|Array|Object|string|number|boolean|void|null|undefined)\b/gi) || [];
    const uniqueTerms = [...new Set(techTerms)].slice(0, 5);

    const summary = `${first} ... ${last}`.slice(0, 80);
    const entities = uniqueTerms;

    return { summary, entities };
  }

  /**
   * 删除最旧的会话
   */
  private removeOldestSession(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, session] of this.sessions) {
      if (session.updatedAt < oldestTime) {
        oldestTime = session.updatedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.sessions.delete(oldestId);
      console.log('[SessionManager] 删除最旧会话:', oldestId);
    }
  }

  /**
   * 持久化会话到workspaceState
   */
  private persistSessions(): void {
    const sessionsArray = Array.from(this.sessions.values());
    this.context.workspaceState.update(this.STORAGE_KEY_SESSIONS, sessionsArray);
    this.context.workspaceState.update(this.STORAGE_KEY_CURRENT, this.currentSessionId);
  }

  /**
   * 从workspaceState加载会话
   */
  private loadSessions(): void {
    const sessionsData = this.context.workspaceState.get<ChatSession[]>(this.STORAGE_KEY_SESSIONS);
    const currentSessionId = this.context.workspaceState.get<string>(this.STORAGE_KEY_CURRENT);

    if (sessionsData && sessionsData.length > 0) {
      for (const session of sessionsData) {
        this.sessions.set(session.id, session);
      }

      if (currentSessionId && this.sessions.has(currentSessionId)) {
        this.currentSessionId = currentSessionId;
      } else {
        // 如果当前会话不存在，使用最新的会话
        const sortedSessions = Array.from(this.sessions.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt
        );
        if (sortedSessions.length > 0) {
          this.currentSessionId = sortedSessions[0].id;
        }
      }

      console.log(`[SessionManager] 加载了 ${this.sessions.size} 个会话`);
    } else {
      // 没有历史会话，创建新会话
      this.createSession();
    }
  }
}
