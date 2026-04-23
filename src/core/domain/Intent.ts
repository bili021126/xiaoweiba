/**
 * 意图名称 - 系统理解的所有用户意图
 */
export type IntentName =
  | 'explain_code'
  | 'generate_code'
  | 'generate_commit'
  | 'check_naming'
  | 'optimize_sql'
  | 'chat'
  | 'configure_api_key'
  | 'export_memory'
  | 'import_memory'
  | 'inline_completion' // ✅ 新增：行内补全
  | 'new_session' // ✅ 新增：新建会话
  | 'switch_session' // ✅ 新增：切换会话
  | 'delete_session'; // ✅ 新增：删除会话

/**
 * 代码上下文 - 编辑器状态的快照
 */
export interface CodeContext {
  filePath: string;
  language: string;
  selectedCode?: string;
  cursorLine?: number;
  fullFileContent?: string; // 限制大小
}

/**
 * 意图 - 用户操作的精简表达
 * 取代散乱的 CommandInput
 */
export interface Intent {
  /** 意图名称 */
  name: IntentName;

  /** 原始用户输入（如有） */
  userInput?: string;

  /** 代码上下文 */
  codeContext?: CodeContext;

  /** 元数据（来源、时间戳等） */
  metadata: {
    timestamp: number;
    source: 'command' | 'chat' | 'auto' | 'inline_completion'; // ✅ 新增inline_completion
    sessionId?: string;
    
    // ✅ L1: 意图向量 (Intent Vector)
    intentVector?: {
      temporal: number;          // 时间敏感度 (0-1)
      entity: number;            // 实体敏感度 (0-1)
      semantic: number;          // 语义复杂度 (0-1)
      distantTemporal: number;   // 远期时间依赖 (0-1)
    };
    
    // ✅ L1: 查询特征
    complexity?: 'simple' | 'moderate' | 'complex';  // 查询复杂度
    requiresCodeContext?: boolean;  // 是否需要代码上下文
    
    coreIntent?: string; // ✅ L1: 核心意图（北极星）
    enrichedContext?: {
      activeFilePath?: string;
      activeFileLanguage?: string;
      cursorLine?: number;
      selectedCode?: {
        content: string;
        startLine: number;
        endLine: number;
      };
      visibleCode?: {
        content: string;
        startLine: number;
        endLine: number;
      };
      timestamp: number;
    };
    
    // ✅ 修复 #28：TaskToken（用于写操作授权）
    taskToken?: string;
  };
}
