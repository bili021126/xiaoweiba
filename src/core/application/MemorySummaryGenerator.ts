/**
 * 记忆摘要生成器 - 负责从意图生成摘要和提取实体
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道如何生成摘要
 * - 所有摘要生成逻辑集中在此
 */

import { injectable } from 'tsyringe';
import { Intent } from '../domain/Intent';

@injectable()
export class MemorySummaryGenerator {
  /**
   * 根据意图生成有意义的摘要
   */
  generateSummary(intent: Intent, result: any): string {
    // 根据意图生成有意义的摘要
    if (intent.name === 'explain_code' && intent.codeContext) {
      return `解释了 ${intent.codeContext.filePath} 中的代码`;
    }
    
    if (intent.name === 'generate_commit') {
      const commitMsg = result.data?.commitMessage || result.commitMessage;
      return `生成了提交信息: ${commitMsg?.substring(0, 50) || ''}`;
    }
    
    if (intent.name === 'generate_code' && intent.codeContext) {
      return `在 ${intent.codeContext.filePath} 中生成代码`;
    }
    
    if (intent.name === 'check_naming' && intent.codeContext) {
      return `检查了 ${intent.codeContext.filePath} 的命名规范`;
    }
    
    if (intent.name === 'optimize_sql') {
      return '优化了SQL查询';
    }

    return `执行了 ${intent.name}`;
  }

  /**
   * 从意图中提取实体
   */
  extractEntities(intent: Intent): string[] {
    const entities: string[] = [];

    // 提取文件路径
    if (intent.codeContext?.filePath) {
      entities.push(intent.codeContext.filePath);
    }

    // 提取语言
    if (intent.codeContext?.language) {
      entities.push(intent.codeContext.language);
    }

    // 提取用户输入中的关键词（简单实现）
    if (intent.userInput) {
      const keywords = intent.userInput
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
      entities.push(...keywords);
    }

    return entities;
  }
}
