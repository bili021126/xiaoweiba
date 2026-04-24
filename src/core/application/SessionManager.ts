/**
 * 会话管理器 - 负责会话的 CRUD 操作
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道会话管理的细节
 * - 所有会话相关的数据库操作集中在此
 */

import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';

@injectable()
export class SessionManager {
  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager
  ) {}

  /**
   * 创建新会话
   */
  async createSession(sessionId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const db = this.dbManager.getDatabase();
      const timestamp = Date.now();
      
      db.run(
        `INSERT INTO chat_sessions (session_id, metadata, created_at, last_active_at, message_count)
         VALUES (?, ?, ?, ?, 0)`,
        [sessionId, JSON.stringify(metadata || {}), timestamp, timestamp]
      );
      
      console.log(`[SessionManager] Created session: ${sessionId}`);
    } catch (error) {
      console.error('[SessionManager] createSession failed:', error);
      throw error;
    }
  }

  /**
   * 加载会话历史
   */
  async loadSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string; timestamp: number }>> {
    try {
      const db = this.dbManager.getDatabase();
      const stmt = db.prepare(
        `SELECT role, content, timestamp FROM chat_messages 
         WHERE session_id = ? 
         ORDER BY timestamp ASC`
      );
      const result = stmt.bind([sessionId]).getAsObject();
      
      if (!result || result.length === 0) {
        return [];
      }

      const columns = result[0].columns;
      const values = result[0].values;
      
      const roleIndex = columns.indexOf('role');
      const contentIndex = columns.indexOf('content');
      const timestampIndex = columns.indexOf('timestamp');
      
      return (result as any[]).map((row: any) => ({
        role: row[roleIndex] as string,
        content: row[contentIndex] as string,
        timestamp: row[timestampIndex] as number
      }));
    } catch (error) {
      console.error('[SessionManager] loadSessionHistory failed:', error);
      return [];
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = this.dbManager.getDatabase();
      
      // 先删除消息
      db.run(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
      
      // 再删除会话
      db.run(`DELETE FROM chat_sessions WHERE session_id = ?`, [sessionId]);
      
      console.log(`[SessionManager] Deleted session: ${sessionId}`);
    } catch (error) {
      console.error('[SessionManager] deleteSession failed:', error);
      throw error;
    }
  }

  /**
   * 列出所有会话（按最后活跃时间倒序）
   */
  async listSessions(): Promise<Array<{ id: string; title: string; lastActiveAt: number; messageCount: number }>> {
    try {
      const db = this.dbManager.getDatabase();
      const result = db.exec(
        `SELECT session_id, metadata, last_active_at, message_count 
         FROM chat_sessions 
         ORDER BY last_active_at DESC`
      );
      
      if (!result || result.length === 0) {
        return [];
      }

      const columns = result[0].columns;
      const values = result[0].values;
      
      const idIndex = columns.indexOf('session_id');
      const metadataIndex = columns.indexOf('metadata');
      const lastActiveIndex = columns.indexOf('last_active_at');
      const messageCountIndex = columns.indexOf('message_count');
      
      return values.map(row => {
        const metadata = JSON.parse((row[metadataIndex] as string) || '{}');
        return {
          id: row[idIndex] as string,
          title: metadata.title || '未命名会话',
          lastActiveAt: row[lastActiveIndex] as number,
          messageCount: row[messageCountIndex] as number
        };
      });
    } catch (error) {
      console.error('[SessionManager] listSessions failed:', error);
      return [];
    }
  }

  /**
   * 保存消息到会话
   */
  async saveMessage(sessionId: string, role: string, content: string): Promise<void> {
    try {
      const db = this.dbManager.getDatabase();
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();
      
      // 插入消息
      db.run(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [messageId, sessionId, role, content, timestamp]
      );
      
      // 更新会话的最后活跃时间和消息计数
      db.run(
        `UPDATE chat_sessions 
         SET last_active_at = ?, message_count = message_count + 1
         WHERE session_id = ?`,
        [timestamp, sessionId]
      );
    } catch (error) {
      console.error('[SessionManager] saveMessage failed:', error);
      throw error;
    }
  }
}
