/**
 * 业务常量定义
 * 
 * 集中管理所有魔法数字，提高代码可读性和可维护性
 */

// ========== 对话系统常量 ==========
export const CHAT = {
  /** 长消息阈值（字符数） */
  LONG_MESSAGE_THRESHOLD: 200,
  
  /** 默认历史消息数量 */
  DEFAULT_HISTORY_MESSAGES: 5,
  
  /** 默认记忆检索数量 */
  DEFAULT_MEMORY_LIMIT: 3,
  
  /** 跨会话记忆检索数量 */
  CROSS_SESSION_MEMORY_LIMIT: 3,
  
  /** 时间查询显示的记忆数量 */
  TEMPORAL_QUERY_DISPLAY_LIMIT: 5,
  
  /** 相关记忆显示数量 */
  RELEVANT_MEMORY_DISPLAY_LIMIT: 3,
  
  /** 偏好记忆显示数量 */
  PREFERENCE_DISPLAY_LIMIT: 3,
  
  /** 最佳实践显示数量 */
  BEST_PRACTICE_DISPLAY_LIMIT: 3
} as const;

// ========== 记忆系统常量 ==========
export const MEMORY = {
  /** 生疏期记忆阈值 */
  NOVICE_THRESHOLD: 5,
  
  /** 熟悉期记忆阈值 */
  FAMILIAR_THRESHOLD: 20,
  
  /** 代码块权重 */
  CODE_BLOCK_WEIGHT: 0.3,
  
  /** 基础检索限制（非跨会话） */
  BASE_RETRIEVAL_LIMIT: 3,
  
  /** 基础检索限制（跨会话） */
  CROSS_SESSION_RETRIEVAL_LIMIT: 6
} as const;

// ========== 复杂度评估常量 ==========
export const COMPLEXITY = {
  /** 代码片段复杂度增量 */
  CODE_SNIPPET_COMPLEXITY: 0.3,
  
  /** 多文件引用复杂度增量 */
  MULTI_FILE_COMPLEXITY: 0.2,
  
  /** 技术术语复杂度增量 */
  TECHNICAL_TERM_COMPLEXITY: 0.1
} as const;

// ========== Git智能化常量 ==========
export const GIT = {
  /** 最大分析文件数 */
  MAX_FILES_TO_ANALYZE: 5,
  
  /** 提交信息最大长度 */
  COMMIT_MESSAGE_MAX_LENGTH: 72,
  
  /** 历史提交学习数量 */
  HISTORY_COMMIT_LEARN_COUNT: 10,
  
  /** 元数据中实体的最大数量 */
  MAX_ENTITIES_IN_METADATA: 5
} as const;

// ========== LLM调用常量 ==========
export const LLM = {
  /** 默认温度参数 */
  DEFAULT_TEMPERATURE: 0.7,
  
  /** 代码生成最大Token数 */
  CODE_GENERATION_MAX_TOKENS: 2000,
  
  /** 摘要生成最大Token数 */
  SUMMARY_MAX_TOKENS: 500,
  
  /** 澄清问题最大数量 */
  MAX_CLARIFICATION_QUESTIONS: 3
} as const;

// ========== 缓存常量 ==========
export const CACHE = {
  /** LLM响应缓存TTL（毫秒）- 1小时 */
  LLM_RESPONSE_TTL: 60 * 60 * 1000,
  
  /** 最大缓存条目数 */
  MAX_CACHE_ENTRIES: 100
} as const;

// ========== UI常量 ==========
export const UI = {
  /** 进度报告间隔（毫秒） */
  PROGRESS_REPORT_INTERVAL: 1000,
  
  /** 最大显示建议数 */
  MAX_SUGGESTIONS: 5
} as const;
