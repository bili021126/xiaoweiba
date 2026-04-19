/**
 * Chat模块类型定义
 */

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
