/**
 * 记忆检索相关类型定义
 */

/**
 * 意图向量 - 描述用户查询的敏感维度
 */
export interface IntentVector {
  temporal: number;   // 0-1，时间敏感程度（是否包含"刚才"、"上次"等）
  entity: number;     // 0-1，实体敏感程度（是否包含函数名、表名等）
  semantic: number;   // 0-1，语义模糊程度（是否像自然语言描述而非精确关键词）
}

/**
 * 检索权重配置
 */
export interface RetrievalWeights {
  k: number;  // 关键词（TF-IDF）权重
  t: number;  // 时间衰减权重
  e: number;  // 实体匹配权重
  v: number;  // 向量相似度权重
}

/**
 * 预设专家权重配置
 */
export const EXPERT_WEIGHTS: Record<string, RetrievalWeights> = {
  balanced:   { k: 0.30, t: 0.20, e: 0.20, v: 0.30 }, // 默认均衡
  temporal:   { k: 0.20, t: 0.60, e: 0.10, v: 0.10 }, // 时间优先（最近记忆）
  entity:     { k: 0.50, t: 0.10, e: 0.30, v: 0.10 }, // 实体优先（精确匹配）
  semantic:   { k: 0.10, t: 0.10, e: 0.20, v: 0.60 }, // 语义优先（向量检索）
  hybrid:     { k: 0.30, t: 0.20, e: 0.20, v: 0.30 }  // 混合（同balanced，可不同）
};

/**
 * 反馈记录 - 用于专家选择器的学习
 */
export interface FeedbackRecord {
  intent: IntentVector;
  clickedWeights: RetrievalWeights; // 点击结果的实际权重组合
  timestamp: number;
}

/**
 * 专家状态 - 用于持久化
 */
export interface ExpertState {
  currentExpert: string;
  feedbackHistory: FeedbackRecord[];
}
