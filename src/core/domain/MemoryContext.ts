/**
 * 记忆上下文 - 检索结果的封装
 */

/**
 * 情景记忆项
 */
export interface EpisodicMemoryItem {
  id: string;
  summary: string;
  taskType: string;
  timestamp: number;
  entities: string[];  // 实体列表（文件名、关键词等）
}

/**
 * 偏好推荐项
 */
export interface PreferenceRecommendation {
  domain: string;
  pattern: string | Record<string, any>;  // 支持字符串或对象
  confidence: number;
}

/**
 * 提交风格偏好（来自CommitStyleLearner）
 */
export interface CommitStylePreference {
  domain: 'COMMIT_STYLE';
  pattern: {
    alwaysIncludeScope: boolean;
    preferredTypes: string[];
    descriptionMaxLength: number;
    useBulletPoints: boolean;
    language: 'zh' | 'en';
    customRules?: {
      [module: string]: {
        preferredType: string;
        requiredScope: boolean;
      }
    };
  };
  confidence: number;
  sampleCount: number;
}

/**
 * 记忆上下文
 */
export interface MemoryContext {
  episodicMemories: EpisodicMemoryItem[];
  preferenceRecommendations: PreferenceRecommendation[];
  userPreferences?: {
    preferredAgent?: string;
    commitStylePreference?: CommitStylePreference;  // ✅ 添加提交风格偏好
  };
  /** 会话历史（用于多轮对话） */
  sessionHistory?: Array<{ role: string; content: string }>;
  /** 原始查询文本（可选） */
  originalQuery?: string;
  /** 检索耗时（ms，可选） */
  retrievalDuration?: number;
}
