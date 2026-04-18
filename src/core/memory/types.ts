/**
 * 记忆检索相关类型定义
 */

/**
 * 意图向量 - 描述用户查询的敏感维度
 */
export interface IntentVector {
  temporal: number;        // 0-1，时间敏感程度（是否包含"刚才"、"上次"等）
  entity: number;          // 0-1，实体敏感程度（是否包含函数名、表名等）
  semantic: number;        // 0-1，语义模糊程度（是否像自然语言描述而非精确关键词）
  distantTemporal: number; // 0-1，久远时间意图（是否检索历史记忆，如"很久以前"、"上个月"）
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

// ========== EpisodicMemory 类型定义 ==========

/**
 * 任务类型枚举
 */
export type TaskType =
  | 'CODE_EXPLAIN'
  | 'CODE_GENERATE'
  | 'TEST_GENERATE'
  | 'SQL_OPTIMIZE'
  | 'NAMING_CHECK'
  | 'COMMIT_GENERATE'
  | 'SKILL_EXECUTE'
  | 'WORKFLOW_EXECUTE'
  | 'CHAT_COMMAND';

/**
 * 任务结果枚举
 */
export type TaskOutcome = 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';

/**
 * 记忆层级枚举
 */
export type MemoryTier = 'SHORT_TERM' | 'LONG_TERM';

/**
 * 情景记忆记录
 */
export interface EpisodicMemoryRecord {
  id: string;
  projectFingerprint: string;
  timestamp: number;
  taskType: TaskType;
  summary: string;
  entities: string[];
  decision?: string;
  outcome: TaskOutcome;
  finalWeight: number;
  modelId: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
  vector?: Buffer; // 向量数据（从数据库加载）
  memoryTier?: MemoryTier; // 记忆层级
  lastAccessedAt?: number; // 深化点4: 最后访问时间
}

/**
 * 记忆查询选项
 */
export interface MemoryQueryOptions {
  projectFingerprint?: string;
  taskType?: TaskType;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'finalWeight';
  sortOrder?: 'ASC' | 'DESC';
  sinceTimestamp?: number;
  memoryTier?: MemoryTier; // 按层级过滤
}
