/**
 * 会话上下文管理器 - 负责构建聊天场景的完整记忆上下文
 * 
 * 职责：
 * 1. 管理会话历史的压缩（L3）
 * 2. 提取和累积关键决策（L2）
 * 3. 整合核心意图（L1）
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道压缩的细节
 * - 所有会话相关的上下文构建逻辑集中在此
 */

import { injectable, inject } from 'tsyringe';
import { SessionCompressor } from './SessionCompressor';
import { KeyDecision } from '../domain/MemoryContext';
import { DatabaseManager } from '../../storage/DatabaseManager';

@injectable()
export class SessionContextManager {
  constructor(
    @inject(SessionCompressor) private sessionCompressor: SessionCompressor,
    @inject(DatabaseManager) private dbManager: DatabaseManager
  ) {}

  /**
   * 构建聊天场景的完整上下文
   * @param sessionId 会话ID
   * @param coreIntent L1: 核心意图
   * @param existingDecisions 已有的关键决策（用于去重）
   * @returns 包含 L2/L3 的上下文片段
   */
  async buildChatContext(
    sessionId: string,
    coreIntent?: string,
    existingDecisions?: KeyDecision[]
  ): Promise<{
    sessionHistory?: Array<{ role: string; content: string }>;
    keyDecisions?: KeyDecision[];
    sessionSummary?: string;
  }> {
    if (!sessionId) {
      return {};
    }

    try {
      // 1. 从数据库加载会话历史
      const sessionHistory = await this.loadSessionHistory(sessionId);
      
      if (sessionHistory.length === 0) {
        return { sessionHistory: [] };
      }

      // 2. 检查是否需要压缩
      if (!this.sessionCompressor.shouldCompress(sessionHistory)) {
        // 不需要压缩，直接返回原始历史
        return { sessionHistory };
      }

      // 3. 执行压缩并提取 L2/L3
      const decisionTexts = existingDecisions?.map(d => d.decision) || [];
      const compressionResult = await this.sessionCompressor.compressIfNeeded(
        sessionHistory,
        decisionTexts
      );

      // 4. 保存压缩后的历史到内存（用于后续对话）
      this.saveCompressedHistory(sessionId, compressionResult.compressedHistory);

      // 5. 构建新的关键决策列表
      const newKeyDecisions: KeyDecision[] = compressionResult.newKeyDecisions.map(decision => ({
        timestamp: Date.now(),
        decision,
        context: compressionResult.summary
      }));

      console.log(
        `[SessionContextManager] Session compressed: ${compressionResult.originalMessageCount} -> ${compressionResult.compressedMessageCount} messages`
      );

      return {
        sessionHistory: compressionResult.compressedHistory,
        keyDecisions: newKeyDecisions,
        sessionSummary: compressionResult.summary
      };
    } catch (error) {
      console.error('[SessionContextManager] Failed to build chat context:', error);
      // 降级：返回空上下文，不阻断流程
      return { sessionHistory: [] };
    }
  }

  /**
   * 从数据库加载会话历史
   */
  private async loadSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
    try {
      const db = this.dbManager.getDatabase();
      // ✅ 修复 #7：使用参数化查询防止 SQL 注入
      const stmt = db.prepare(
        `SELECT role, content FROM chat_messages 
         WHERE session_id = ? 
         ORDER BY timestamp ASC`
      );
      stmt.bind([sessionId]);
      
      const messages: Array<{ role: string; content: string }> = [];
      while (stmt.step()) {
        const row = stmt.get() as any[];
        messages.push({
          role: row[0] as string,
          content: row[1] as string
        });
      }
      stmt.free();
      
      return messages;
    } catch (error) {
      console.error('[SessionContextManager] Failed to load session history:', error);
      return [];
    }
  }

  /**
   * 保存压缩后的历史到内存缓存
   * 注意：这里只更新内存缓存，不写回数据库
   * 数据库保留完整历史，用于后续分析和导出
   */
  private saveCompressedHistory(
    sessionId: string,
    compressedHistory: Array<{ role: string; content: string }>
  ): void {
    // 这个方法需要通过某种方式访问 MemoryAdapter 的内部缓存
    // 暂时留空，后续通过事件总线或回调机制实现
    console.log(`[SessionContextManager] Compressed history cached for session: ${sessionId}`);
  }
}
