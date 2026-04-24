/**
 * ChatAgent 纯逻辑工具函数
 * 
 * 从 ChatAgent 中提取的独立函数，便于单元测试
 */

import { Intent } from '../core/domain/Intent';
import { DialogManager } from '../chat/DialogManager';

/**
 * 判断是否应该记录记忆
 */
export function shouldRecordMemory(intent: Intent, userMessage: string, assistantResponse: string): boolean {
  if (intent.name !== 'chat') return true;
  
  // 使用 DialogManager 的复杂度评估替代简单规则
  const dialogManager = new DialogManager();
  const { complexity } = dialogManager.assessComplexity(userMessage);
  
  // 复杂度 > 0.3 或回复长度 > 80 时记录
  return complexity > 0.3 || assistantResponse.length > 80;
}

/**
 * 从消息中提取实体
 */
export function extractEntitiesFromMessage(message: string): string[] {
  const entities: string[] = [];

  // 提取代码相关的关键词
  const codeKeywords = ['函数', '类', '方法', '变量', '接口', '类型', '代码', 'algorithm', 'function', 'class', 'method'];
  codeKeywords.forEach(keyword => {
    if (message.includes(keyword)) {
      entities.push(keyword);
    }
  });

  // 提取文件名模式（简单匹配）
  const filePattern = /\b\w+\.(ts|js|py|java|cpp|go|rs)\b/g;
  const fileMatches = message.match(filePattern);
  if (fileMatches) {
    entities.push(...fileMatches);
  }

  return entities;
}
