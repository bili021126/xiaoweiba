/**
 * ToolGateway - 工具调用网关
 *
 * Cortex 架构法典 COM-002 & AG-004 实施
 * - 所有工具调用必须通过 ToolGateway
 * - 高风险工具执行前必须验证 TaskToken
 * - 命令执行前必须经过 CommandInterceptor 校验
 */

import { injectable, inject } from 'tsyringe';
import { TaskTokenManager, TaskPermissionLevel } from './TaskTokenManager';
import { AuditLogger } from './AuditLogger';

/**
 * 工具风险级别
 */
export enum ToolRiskLevel {
  /** L1: 低风险 - 只读操作 */
  LOW = 'LOW',
  /** L2: 中风险 - 写文件、修改配置 */
  MEDIUM = 'MEDIUM',
  /** L3: 高风险 - 执行命令、删除文件 */
  HIGH = 'HIGH'
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  parameters: Record<string, unknown>;
  /** TaskToken（中高风险工具必需） */
  taskToken?: string;
  /** 调用上下文 */
  context?: {
    agentId?: string;
    intentId?: string;
    sessionId?: string;
  };
}

/**
 * 工具调用结果
 */
export interface ToolCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  riskLevel: ToolRiskLevel;
  executionTimeMs?: number;
}

/**
 * 工具注册信息
 */
interface ToolRegistration {
  name: string;
  riskLevel: ToolRiskLevel;
  description: string;
  requiresToken: boolean;
}

/**
 * 命令黑白名单配置
 */
interface CommandPolicy {
  /** 白名单正则表达式 */
  whitelist: RegExp[];
  /** 黑名单正则表达式 */
  blacklist: RegExp[];
}

/**
 * ToolGateway - 工具调用统一网关
 *
 * 职责：
 * 1. 验证 TaskToken（SEC-001）
 * 2. 拦截危险命令（SEC-002）
 * 3. 记录审计日志（SEC-005）
 * 4. 控制工具访问权限（AG-004）
 */
@injectable()
export class ToolGateway {
  private toolRegistry: Map<string, ToolRegistration> = new Map();
  private commandPolicy: CommandPolicy = {
    whitelist: [
      /^ls\s/,                    // 列出目录
      /^dir\s/,                   // Windows 列出目录
      /^cat\s/,                   // 查看文件
      /^type\s/,                  // Windows 查看文件
      /^git\s+(status|log|diff|branch)$/,  // Git 查询
      /^pwd$/,                    // 当前目录
      /^cd\s/,                    // 切换目录
      /^echo\s/,                  // 输出文本
      /^grep\s/,                  // 搜索文本
      /^find\s/,                  // 查找文件
      /^wc\s/,                    // 统计行数
      /^head\s/,                  // 查看文件头部
      /^tail\s/,                  // 查看文件尾部
    ],
    blacklist: [
      /rm\s+-rf\s+\//,           // 禁止删除根目录
      /rm\s+-rf\s+\*/,           // 禁止删除所有文件
      /dd\s+if=\/dev\/zero/,     // 禁止磁盘填充
      /:\(\)\{\s*:\|\:&\s*\};:/, // 禁止 fork bomb
      /mkfs\./,                  // 禁止格式化
      /chmod\s+[0-7]*777/,       // 禁止过度授权
      /sudo\s/,                  // 禁止提权
      /su\s+root/,               // 禁止切换root
      /passwd\s/,                // 禁止修改密码
      /shutdown\s/,              // 禁止关机
      /reboot\s/,                // 禁止重启
      /format\s/,                // Windows 格式化
      /del\s+\/[fqs]/i,          // Windows 强制删除
    ]
  };

  constructor(
    @inject(TaskTokenManager) private taskTokenManager: TaskTokenManager,
    @inject(AuditLogger) private auditLogger: AuditLogger
  ) {}

  /**
   * 注册工具
   * @param registration 工具注册信息
   */
  registerTool(registration: ToolRegistration): void {
    this.toolRegistry.set(registration.name, registration);
  }

  /**
   * 执行工具调用
   * @param request 工具调用请求
   * @returns 工具调用结果
   */
  async executeTool<T = unknown>(request: ToolCallRequest): Promise<ToolCallResult<T>> {
    const startTime = Date.now();
    const toolInfo = this.toolRegistry.get(request.toolName);

    // Step 1: 检查工具是否已注册
    if (!toolInfo) {
      return {
        success: false,
        error: `Tool '${request.toolName}' is not registered`,
        riskLevel: ToolRiskLevel.LOW
      };
    }

    // Step 2: 验证 TaskToken（中高风险工具）
    if (toolInfo.requiresToken || toolInfo.riskLevel !== ToolRiskLevel.LOW) {
      if (!request.taskToken) {
        await this.auditLogger.logSecurityEvent({
          event: 'TOOL_CALL_MISSING_TOKEN',
          severity: 'HIGH',
          details: {
            toolName: request.toolName,
            riskLevel: toolInfo.riskLevel,
            agentId: request.context?.agentId
          }
        });

        return {
          success: false,
          error: `Tool '${request.toolName}' requires a valid TaskToken`,
          riskLevel: toolInfo.riskLevel
        };
      }

      const isValid = await this.taskTokenManager.validate(request.taskToken);
      if (!isValid) {
        await this.auditLogger.logSecurityEvent({
          event: 'TOOL_CALL_INVALID_TOKEN',
          severity: 'CRITICAL',
          details: {
            toolName: request.toolName,
            token: request.taskToken,
            agentId: request.context?.agentId
          }
        });

        return {
          success: false,
          error: 'Invalid or expired TaskToken',
          riskLevel: toolInfo.riskLevel
        };
      }
    }

    // Step 3: 命令执行前校验（如果是 shell 命令）
    if (request.toolName === 'shell' || request.toolName === 'exec') {
      const command = request.parameters.command as string;
      if (!this.validateCommand(command)) {
        await this.auditLogger.logSecurityEvent({
          event: 'COMMAND_BLOCKED',
          severity: 'CRITICAL',
          details: {
            command,
            agentId: request.context?.agentId
          }
        });

        return {
          success: false,
          error: 'Command blocked by security policy',
          riskLevel: ToolRiskLevel.HIGH
        };
      }
    }

    // Step 4: 记录审计日志
    await this.auditLogger.logToolCall({
      toolName: request.toolName,
      parameters: this.sanitizeParameters(request.parameters),
      riskLevel: toolInfo.riskLevel,
      agentId: request.context?.agentId,
      sessionId: request.context?.sessionId,
      success: true // 先记录，实际执行后再更新
    });

    try {
      // Step 5: 执行工具（由外部提供实际执行逻辑）
      const result = await this.invokeTool<T>(request);

      const executionTime = Date.now() - startTime;

      // Step 6: 消耗 TaskToken（一次性使用）
      if (request.taskToken) {
        await this.taskTokenManager.consume(request.taskToken);
      }

      return {
        ...result,
        executionTimeMs: executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // 记录失败日志
      await this.auditLogger.logToolCall({
        toolName: request.toolName,
        parameters: this.sanitizeParameters(request.parameters),
        riskLevel: toolInfo.riskLevel,
        agentId: request.context?.agentId,
        sessionId: request.context?.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        riskLevel: toolInfo.riskLevel,
        executionTimeMs: executionTime
      };
    }
  }

  /**
   * 验证命令是否符合安全策略
   * @param command 待执行的命令
   * @returns 是否允许执行
   */
  validateCommand(command: string): boolean {
    if (!command || command.trim().length === 0) {
      return false;
    }

    // 1. 检查黑名单（优先）
    for (const pattern of this.commandPolicy.blacklist) {
      if (pattern.test(command)) {
        console.error(`[ToolGateway] Command blocked by blacklist: ${command}`);
        return false;
      }
    }

    // 2. 检查白名单
    for (const pattern of this.commandPolicy.whitelist) {
      if (pattern.test(command)) {
        return true;
      }
    }

    // 3. 默认拒绝未知命令
    console.warn(`[ToolGateway] Command not in whitelist: ${command}`);
    return false;
  }

  /**
   * 脱敏参数（用于日志记录）
   * @param parameters 原始参数
   * @returns 脱敏后的参数
   */
  private sanitizeParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'privateKey'];
    const sanitized = { ...parameters };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * 调用实际工具（子类实现或注入）
   * @param request 工具调用请求
   * @returns 工具执行结果
   */
  protected async invokeTool<T = unknown>(request: ToolCallRequest): Promise<ToolCallResult<T>> {
    // 默认实现：抛出未实现错误
    // 实际项目中应该注入具体的工具执行器
    throw new Error(`Tool execution not implemented for: ${request.toolName}`);
  }

  /**
   * 获取工具风险信息
   * @param toolName 工具名称
   * @returns 工具注册信息
   */
  getToolInfo(toolName: string): ToolRegistration | undefined {
    return this.toolRegistry.get(toolName);
  }

  /**
   * 列出所有已注册的工具
   * @returns 工具列表
   */
  listRegisteredTools(): ToolRegistration[] {
    return Array.from(this.toolRegistry.values());
  }
}
