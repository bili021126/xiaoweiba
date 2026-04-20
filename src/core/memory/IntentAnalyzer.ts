import { IntentVector } from './types';
import { LENGTH_LIMITS, CONFIDENCE_THRESHOLDS } from '../../constants';

/**
 * 意图分析器 - 分析用户查询，输出意图向量
 * 
 * 基于规则和简单NLP识别查询的时间敏感性、实体敏感性和语义模糊度
 */
export class IntentAnalyzer {
  // 时间关键词模式
  private temporalPatterns = [
    /刚才/, /上次/, /前一个/, /刚刚/, /最近/, 
    /上一个/, /上一步/, /之前的/, /那次/
  ];
  
  // 久远时间关键词模式（用于检索历史记忆）
  private distantTemporalPatterns = [
    /很久以前/, /之前/, /上个月/, /去年/, /历史/, 
    /以前的/, /早期的/, /过去的/, /旧版本/
  ];
  
  // 实体关键词模式（函数、类、表名等）
  private entityPatterns = [
    /函数/, /方法/, /类/, /表/, /接口/,
    /[A-Z][a-z]+(?:[A-Z][a-z]+)+/  // 驼峰命名视为实体
  ];
  
  // 语义模糊词（自然语言问句）
  private semanticPatterns = [
    /怎么/, /为什么/, /什么/, /如何/, /哪里/, /哪个/
  ];

  /**
   * 分析查询文本，输出意图向量
   * @param query 用户查询文本
   * @param languageId 当前编辑器语言ID（可选）
   * @returns 意图向量 {temporal, entity, semantic, distantTemporal}
   */
  analyze(query: string, languageId?: string): IntentVector {
    // ✅ 截断超长查询，防止正则匹配性能问题（最多1000字符）
    // 截断过长的查询
    const truncatedQuery = query.length > LENGTH_LIMITS.MAX_QUERY_LENGTH 
      ? query.substring(0, LENGTH_LIMITS.MAX_QUERY_LENGTH) 
      : query;
    
    let temporal = 0;
    let entity = 0;
    let semantic = 0;
    let distantTemporal = 0;
  
    // 检测时间敏感性
    if (this.temporalPatterns.some(p => p.test(truncatedQuery))) {
      temporal = 0.8;
    }
    
    // 检测久远时间意图
    if (this.distantTemporalPatterns.some(p => p.test(truncatedQuery))) {
      distantTemporal = 0.9;
    }
  
    // 检测实体敏感性
    if (this.entityPatterns.some(p => p.test(truncatedQuery))) {
      entity = 0.7;
    }
  
    // 检测语义模糊度
    if (this.semanticPatterns.some(p => p.test(query))) {
      semantic = 0.6;
    }
  
    // 如果查询很短（<3字），倾向于时间敏感（可能是“刚才”的省略）
    if (query.length < 3) {
      temporal = Math.max(temporal, 0.5);
    }
  
    // 如果包含代码块标识（反引号），增强实体敏感度
    if (query.includes('`')) {
      entity = Math.min(1, entity + 0.3);
    }
  
    // 新增：当前编辑器为代码语言，增强代码相关判断
    if (languageId && this.isCodeLanguage(languageId)) {
      entity = Math.max(entity, 0.6);  // 代码环境下默认有实体
    }
  
    return { temporal, entity, semantic, distantTemporal };
  }
  
  /**
   * 判断是否为代码语言
   */
  private isCodeLanguage(languageId: string): boolean {
    const codeLanguages = [
      'typescript', 'javascript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'ruby', 'php', 'sql', 'html', 'css', 'json', 'xml'
    ];
    return codeLanguages.includes(languageId.toLowerCase());
  }

  /**
   * 获取主导意图（用于日志和调试）
   */
  getDominantIntent(intent: IntentVector): 'temporal' | 'entity' | 'semantic' | 'balanced' {
    const max = Math.max(intent.temporal, intent.entity, intent.semantic);
    
    // 判断主导意图
    if (max === intent.temporal && intent.temporal > CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE) return 'temporal';
    if (max === intent.entity && intent.entity > CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE) return 'entity';
    if (max === intent.semantic && intent.semantic > CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE) return 'semantic';
    
    return 'balanced';
  }
}
