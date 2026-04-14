/**
 * 小尾巴结构化错误码定义
 * 格式: XWB-{模块}-{序号}
 * 
 * 模块缩写:
 * - CFG: 配置管理 (Config)
 * - DB: 数据库 (Database)
 * - LLM: 大语言模型 (Large Language Model)
 * - SEC: 安全 (Security)
 * - MEM: 记忆系统 (Memory)
 * - SKL: 技能引擎 (Skill)
 * - TL: 工具层 (Tool Layer)
 * - GEN: 通用 (General)
 */

export enum ErrorCode {
  // ==================== 配置相关 (CFG) ====================
  /** 配置文件加载失败 */
  CONFIG_LOAD_FAILED = 'XWB-CFG-001',
  /** YAML 解析错误 */
  CONFIG_PARSE_ERROR = 'XWB-CFG-002',
  /** 配置字段验证失败 */
  CONFIG_VALIDATION_FAILED = 'XWB-CFG-003',
  /** 配置回滚失败 */
  CONFIG_ROLLBACK_FAILED = 'XWB-CFG-004',

  // ==================== 数据库相关 (DB) ====================
  /** 数据库连接初始化失败 */
  DB_CONNECTION_FAILED = 'XWB-DB-001',
  /** SQL 查询执行失败 */
  DB_QUERY_FAILED = 'XWB-DB-002',
  /** 数据库迁移失败 */
  DB_MIGRATION_FAILED = 'XWB-DB-003',
  /** 数据库备份失败 */
  DB_BACKUP_FAILED = 'XWB-DB-004',
  /** 从备份恢复失败 */
  DB_RESTORE_FAILED = 'XWB-DB-005',
  /** 数据库完整性检查失败 */
  DB_INTEGRITY_CHECK_FAILED = 'XWB-DB-006',

  // ==================== LLM 相关 (LLM) ====================
  /** LLM API 调用失败 */
  LLM_API_CALL_FAILED = 'XWB-LLM-001',
  /** API 速率限制 */
  LLM_RATE_LIMITED = 'XWB-LLM-002',
  /** LLM 返回响应格式无效 */
  LLM_INVALID_RESPONSE = 'XWB-LLM-003',
  /** 配置的 LLM 提供商不存在 */
  LLM_PROVIDER_NOT_FOUND = 'XWB-LLM-004',
  /** 内容脱敏处理失败 */
  LLM_CONTENT_MASKING_FAILED = 'XWB-LLM-005',

  // ==================== 安全相关 (SEC) ====================
  /** 任务授权被拒绝 */
  SEC_AUTHORIZATION_DENIED = 'XWB-SEC-001',
  /** 任务权限令牌已过期 */
  SEC_PERMISSION_EXPIRED = 'XWB-SEC-002',
  /** 检测到路径遍历攻击 */
  SEC_PATH_TRAVERSAL_DETECTED = 'XWB-SEC-003',
  /** 命令被安全策略阻止 */
  SEC_COMMAND_BLOCKED = 'XWB-SEC-004',
  /** 审计日志写入失败 */
  SEC_AUDIT_LOG_FAILED = 'XWB-SEC-005',
  /** 加密/解密操作失败 */
  SEC_ENCRYPTION_FAILED = 'XWB-SEC-006',

  // ==================== 记忆相关 (MEM) ====================
  /** 情景记忆记录失败 */
  MEM_RECORD_FAILED = 'XWB-MEM-001',
  /** 记忆检索失败 */
  MEM_RETRIEVAL_FAILED = 'XWB-MEM-002',
  /** 记忆导出失败 */
  MEM_EXPORT_FAILED = 'XWB-MEM-003',
  /** 记忆导入失败 */
  MEM_IMPORT_FAILED = 'XWB-MEM-004',
  /** 记忆衰减计算失败 */
  MEM_DECAY_CALCULATION_FAILED = 'XWB-MEM-005',

  // ==================== 技能相关 (SKL) ====================
  /** 技能文件加载失败 */
  SKL_LOAD_FAILED = 'XWB-SKL-001',
  /** 技能 JSON 解析失败 */
  SKL_PARSE_FAILED = 'XWB-SKL-002',
  /** 技能步骤执行失败 */
  SKL_EXECUTION_FAILED = 'XWB-SKL-003',
  /** 技能 Schema 验证失败 */
  SKL_VALIDATION_FAILED = 'XWB-SKL-004',
  /** 技能执行回滚失败 */
  SKL_ROLLBACK_FAILED = 'XWB-SKL-005',

  // ==================== 工具相关 (TL) ====================
  /** 文件读取失败 */
  TL_FILE_READ_FAILED = 'XWB-TL-001',
  /** 文件写入失败 */
  TL_FILE_WRITE_FAILED = 'XWB-TL-002',
  /** Git 操作失败 */
  TL_GIT_OPERATION_FAILED = 'XWB-TL-003',
  /** Shell 命令执行失败 */
  TL_SHELL_EXECUTION_FAILED = 'XWB-TL-004',
  /** 数据库查询工具失败 */
  TL_DATABASE_QUERY_FAILED = 'XWB-TL-005',

  // ==================== 通用错误 (GEN) ====================
  /** 未知错误（兜底） */
  GEN_UNKNOWN_ERROR = 'XWB-GEN-001',
  /** 操作超时 */
  GEN_TIMEOUT = 'XWB-GEN-002',
  /** 用户输入参数无效 */
  GEN_INVALID_INPUT = 'XWB-GEN-003',
  /** 任务被用户取消 */
  GEN_TASK_CANCELLED = 'XWB-GEN-004'
}

/**
 * 小尾巴统一错误接口
 * 扩展自 Error，添加结构化错误码和用户友好消息
 */
export interface XiaoWeibaError extends Error {
  /** 结构化错误码 */
  code: ErrorCode;
  /** 额外错误详情（用于调试） */
  details?: Record<string, unknown>;
  /** 面向用户的友好错误消息 */
  userMessage: string;
}

/**
 * 小尾巴自定义异常类
 * 
 * @example
 * ```ts
 * throw new XiaoWeibaException(
 *   ErrorCode.CONFIG_LOAD_FAILED,
 *   'YAML parse error at line 5',
 *   '配置文件格式错误，请检查第5行',
 *   { line: 5 }
 * );
 * ```
 */
export class XiaoWeibaException extends Error implements XiaoWeibaError {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly userMessage: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'XiaoWeibaException';
  }

  /**
   * 序列化为 JSON 对象（用于日志记录）
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * 创建结构化错误的工厂函数
 * 
 * @param code - 错误码
 * @param message - 内部技术消息（记录到日志）
 * @param userMessage - 用户友好消息（展示给用户）
 * @param details - 额外详情（可选）
 * @returns XiaoWeibaError 实例
 */
export function createError(
  code: ErrorCode,
  message: string,
  userMessage: string,
  details?: Record<string, unknown>
): XiaoWeibaError {
  return new XiaoWeibaException(code, message, userMessage, details);
}

/**
 * 从任意错误对象提取用户友好消息
 * 
 * @param error - 任意错误对象
 * @returns 适合展示给用户的错误消息字符串
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof XiaoWeibaException) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return `发生未知错误: ${error.message}`;
  }
  return '发生未知错误，请查看日志获取详细信息';
}
