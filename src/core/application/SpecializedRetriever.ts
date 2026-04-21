/**
 * 专门化检索器 - 负责不同意图场景的检索策略
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道每种场景的检索细节
 * - 所有检索策略集中在此，便于优化和测试
 */

import { injectable, inject } from 'tsyringe';
import { Intent } from '../domain/Intent';
import { EpisodicMemory } from '../memory/EpisodicMemory';

@injectable()
export class SpecializedRetriever {
  constructor(
    @inject(EpisodicMemory) private episodicMemory: EpisodicMemory
  ) {}

  /**
   * 代码解释场景检索
   */
  async retrieveForExplainCode(intent: Intent): Promise<any[]> {
    if (!intent.codeContext) return [];

    const filePath = intent.codeContext.filePath;
    const fileName = filePath.split(/[/\\]/).pop() || '';
    
    try {
      // 1. 检索该文件的历史解释
      const fileMemories = await this.episodicMemory.search(fileName, {
        taskType: 'CODE_EXPLAIN',
        limit: 3
      });

      // 2. 检索相关概念的解释
      if (intent.userInput) {
        const conceptMemories = await this.episodicMemory.search(intent.userInput, {
          taskType: 'CODE_EXPLAIN',
          limit: 2
        });
        return [...fileMemories, ...conceptMemories];
      }

      return fileMemories;
    } catch (error) {
      console.error('[SpecializedRetriever] retrieveForExplainCode failed:', error);
      return [];
    }
  }

  /**
   * 提交信息生成场景检索
   */
  async retrieveForCommit(intent: Intent): Promise<any[]> {
    try {
      // 检索最近的提交记录，学习用户的提交风格
      const recentCommits = await this.episodicMemory.retrieve({
        taskType: 'COMMIT_GENERATE',
        limit: 5
      });

      return recentCommits;
    } catch (error) {
      console.error('[SpecializedRetriever] retrieveForCommit failed:', error);
      return [];
    }
  }

  /**
   * 聊天场景检索
   */
  async retrieveForChat(intent: Intent): Promise<any[]> {
    if (!intent.userInput) return [];

    try {
      // 1. 语义搜索相关对话
      const semanticResults = await this.episodicMemory.search(intent.userInput, {
        limit: 5
      });

      // 2. 如果有文件上下文，也检索相关文件的历史
      if (intent.codeContext?.filePath) {
        const fileName = intent.codeContext.filePath.split(/[/\\]/).pop() || '';
        const fileResults = await this.episodicMemory.search(fileName, {
          limit: 3
        });
        
        // 合并并去重
        const allResults = [...semanticResults, ...fileResults];
        const uniqueIds = new Set<string>();
        return allResults.filter(item => {
          if (uniqueIds.has(item.id)) return false;
          uniqueIds.add(item.id);
          return true;
        });
      }

      return semanticResults;
    } catch (error) {
      console.error('[SpecializedRetriever] retrieveForChat failed:', error);
      return [];
    }
  }
}
