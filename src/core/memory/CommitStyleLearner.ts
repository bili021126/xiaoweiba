/**
 * 提交风格学习器 - 从历史记忆中学习用户的提交偏好
 * 
 * 职责：
 * 1. 分析历史提交记录，提取风格特征
 * 2. 构建用户偏好画像
 * 3. 为Prompt生成提供个性化参数
 */

import { injectable, inject } from 'tsyringe';
import { EpisodicMemory, EpisodicMemoryRecord } from './EpisodicMemory';
import { CONFIDENCE_THRESHOLDS } from '../../constants';

export interface CommitStylePreference {
  domain: 'COMMIT_STYLE';
  pattern: {
    alwaysIncludeScope: boolean;  // 是否总是包含scope
    preferredTypes: string[];  // 常用type列表（前3个）
    descriptionMaxLength: number;  // 描述最大长度
    useBulletPoints: boolean;  // 是否使用bullet points
    language: 'zh' | 'en';  // 语言偏好
    customRules?: {
      [module: string]: {
        preferredType: string;
        requiredScope: boolean;
      }
    }
  };
  confidence: number;  // 置信度（0-1，基于样本数量）
  sampleCount: number;  // 样本数量
}

export interface CommitAnalysis {
  typeDistribution: Record<string, number>;
  scopeUsage: number;
  avgDescriptionLength: number;
  bulletPointUsage: number;
  modulePatterns: Record<string, { count: number; types: string[] }>;
}

@injectable()
export class CommitStyleLearner {
  constructor(
    @inject(EpisodicMemory) private episodicMemory: EpisodicMemory
  ) {}

  /**
   * 从历史记忆中学习提交风格
   * 
   * @param filePath 可选，针对特定文件学习
   * @returns 提交风格偏好
   */
  async learnFromHistory(filePath?: string): Promise<CommitStylePreference> {
    // 1. 检索相关的历史提交记忆
    const memories = await this.retrieveRelevantMemories(filePath);
    
    if (memories.length === 0) {
      return this.getDefaultPreference();
    }

    // 2. 分析提交模式
    const analysis = this.analyzeCommitPatterns(memories);

    // 3. 构建偏好
    const preference: CommitStylePreference = {
      domain: 'COMMIT_STYLE',
      pattern: {
        alwaysIncludeScope: analysis.scopeUsage > 0.8,
        preferredTypes: Object.entries(analysis.typeDistribution)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type]) => type),
        descriptionMaxLength: Math.ceil(analysis.avgDescriptionLength * 1.2),
        useBulletPoints: analysis.bulletPointUsage > CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE,
        language: 'zh',
        customRules: this.extractModulePatterns(analysis.modulePatterns)
      },
      confidence: Math.min(memories.length / 20, 1.0),  // 20个样本达到100%置信度
      sampleCount: memories.length
    };

    console.log(`[CommitStyleLearner] Learned from ${memories.length} commits, confidence: ${(preference.confidence * 100).toFixed(0)}%`);
    
    return preference;
  }

  /**
   * 检索相关的历史提交记忆
   */
  private async retrieveRelevantMemories(filePath?: string): Promise<EpisodicMemoryRecord[]> {
    const options: any = {
      taskType: 'COMMIT_GENERATE',
      limit: 50,  // 最多分析50条
      sortBy: 'timestamp',
      sortOrder: 'DESC'
    };

    // 如果指定了文件，优先检索该文件的记忆
    if (filePath) {
      const fileName = filePath.split('/').pop()?.split('\\').pop() || '';
      const memories = await this.episodicMemory.search(fileName, {
        taskType: 'COMMIT_GENERATE',
        limit: 50
      });
      
      if (memories.length > 0) {
        return memories;
      }
    }

    // 否则检索所有提交记忆
    return await this.episodicMemory.retrieve(options);
  }

  /**
   * 分析提交模式
   */
  private analyzeCommitPatterns(memories: EpisodicMemoryRecord[]): CommitAnalysis {
    const typeDistribution: Record<string, number> = {};
    let scopeCount = 0;
    let totalDescriptionLength = 0;
    let bulletPointCount = 0;
    const modulePatterns: Record<string, { count: number; types: string[] }> = {};

    memories.forEach(memory => {
      // 解析提交信息的第一行
      const firstLine = memory.decision?.split('\n')[0] || '';
      
      // 提取type
      const typeMatch = firstLine.match(/^(feat|fix|docs|style|refactor|test|chore)/);
      if (typeMatch) {
        const type = typeMatch[1];
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
      }

      // 检查是否有scope
      if (firstLine.includes('(') && firstLine.includes(')')) {
        scopeCount++;
        
        // 提取scope并统计模块模式
        const scopeMatch = firstLine.match(/\(([^)]+)\)/);
        if (scopeMatch) {
          const scope = scopeMatch[1];
          if (!modulePatterns[scope]) {
            modulePatterns[scope] = { count: 0, types: [] };
          }
          modulePatterns[scope].count++;
          
          if (typeMatch && !modulePatterns[scope].types.includes(typeMatch[1])) {
            modulePatterns[scope].types.push(typeMatch[1]);
          }
        }
      }

      // 计算描述长度
      if (memory.decision) {
        totalDescriptionLength += memory.decision.length;
      }

      // 检查是否使用bullet points
      if (memory.decision?.includes('- ') || memory.decision?.includes('* ')) {
        bulletPointCount++;
      }
    });

    return {
      typeDistribution,
      scopeUsage: scopeCount / memories.length,
      avgDescriptionLength: totalDescriptionLength / memories.length,
      bulletPointUsage: bulletPointCount / memories.length,
      modulePatterns
    };
  }

  /**
   * 提取模块级别的自定义规则
   */
  private extractModulePatterns(
    modulePatterns: Record<string, { count: number; types: string[] }>
  ): CommitStylePreference['pattern']['customRules'] {
    const customRules: CommitStylePreference['pattern']['customRules'] = {};

    Object.entries(modulePatterns).forEach(([module, data]) => {
      // 只对有足够样本的模块生成规则（至少3次）
      if (data.count >= 3) {
        // 找出最常用的type
        const typeCounts: Record<string, number> = {};
        data.types.forEach(type => {
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        
        const preferredType = Object.entries(typeCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0];

        if (preferredType) {
          customRules![module] = {
            preferredType,
            requiredScope: true
          };
        }
      }
    });

    return customRules;
  }

  /**
   * 获取默认偏好（无历史数据时）
   */
  private getDefaultPreference(): CommitStylePreference {
    return {
      domain: 'COMMIT_STYLE',
      pattern: {
        alwaysIncludeScope: false,
        preferredTypes: ['feat', 'fix', 'docs'],
        descriptionMaxLength: 100,
        useBulletPoints: true,
        language: 'zh'
      },
      confidence: 0,
      sampleCount: 0
    };
  }

  /**
   * 将偏好格式化为Prompt文本
   */
  formatPreferenceForPrompt(preference: CommitStylePreference): string {
    const lines: string[] = [];

    if (preference.sampleCount === 0) {
      return '（无历史提交记录，使用默认规范）';
    }

    lines.push(`- 基于${preference.sampleCount}次历史提交学习的风格`);
    lines.push(`- 置信度: ${(preference.confidence * 100).toFixed(0)}%`);
    
    if (preference.pattern.alwaysIncludeScope) {
      lines.push('- 总是包含scope，格式：<type>(<scope>): <description>');
    }

    if (preference.pattern.preferredTypes.length > 0) {
      lines.push(`- 常用类型: ${preference.pattern.preferredTypes.join(', ')}`);
    }

    lines.push(`- 描述长度建议: ≤${preference.pattern.descriptionMaxLength}字符`);

    if (preference.pattern.useBulletPoints) {
      lines.push('- 详细描述时使用bullet points（- 开头）');
    }

    if (preference.pattern.customRules && Object.keys(preference.pattern.customRules).length > 0) {
      lines.push('- 模块级规则:');
      Object.entries(preference.pattern.customRules).forEach(([module, rule]) => {
        lines.push(`  * ${module}: 倾向使用"${rule.preferredType}"类型`);
      });
    }

    return lines.join('\n');
  }
}
