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
  | 'inline_completion'; // ✅ 新增：行内补全

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
  };
}
