import * as crypto from 'crypto';
import { injectable } from 'tsyringe';

/**
 * 任务权限级别
 */
export type TaskPermissionLevel = 'read' | 'write' | 'execute';

/**
 * 任务令牌接口
 */
export interface ITaskToken {
  /** 令牌ID */
  tokenId: string;
  /** 关联的任务ID */
  taskId: string;
  /** 权限级别 */
  permission: TaskPermissionLevel;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt: number;
  /** 是否已使用 */
  used: boolean;
  /** HMAC签名（防篡改） */
  signature: string;
}

/**
 * 任务令牌验证结果
 */
export interface TokenValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 令牌数据（如果有效） */
  token?: ITaskToken;
  /** 错误原因（如果无效） */
  error?: string;
}

/**
 * 任务级授权令牌管理器
 * 
 * 为每个AI代理任务生成一次性使用的授权令牌，确保：
 * 1. 最小权限原则：每个任务只能访问被明确授权的资源
 * 2. 时效性：令牌在任务完成后或超时后自动失效
 * 3. 防篡改：使用HMAC-SHA256签名保护令牌完整性
 * 4. 一次性使用：令牌使用后自动标记为已使用，防止重放攻击
 */
@injectable()
export class TaskTokenManager {
  private static readonly TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5分钟过期
  private static readonly HMAC_ALGORITHM = 'sha256';
  
  private activeTokens: Map<string, ITaskToken> = new Map();
  private hmacKey: string;

  constructor() {
    // 生成HMAC密钥（实际项目中应从配置或密钥管理服务获取）
    this.hmacKey = crypto.randomBytes(32).toString('hex');
  }

  /**
   * 为任务生成新的授权令牌
   * @param taskId 任务唯一标识
   * @param permission 授予的权限级别
   * @returns 生成的任务令牌
   */
  generateToken(taskId: string, permission: TaskPermissionLevel = 'read'): ITaskToken {
    const now = Date.now();
    const tokenId = this.generateTokenId();
    
    const token: ITaskToken = {
      tokenId,
      taskId,
      permission,
      createdAt: now,
      expiresAt: now + TaskTokenManager.TOKEN_EXPIRY_MS,
      used: false,
      signature: '' // 稍后计算
    };

    // 计算HMAC签名
    token.signature = this.computeSignature(token);

    // 存储令牌
    this.activeTokens.set(tokenId, token);

    return token;
  }

  /**
   * 验证任务令牌的有效性
   * @param token 待验证的令牌
   * @returns 验证结果
   */
  validateToken(token: ITaskToken): TokenValidationResult {
    // 检查令牌是否存在于活跃列表中
    const storedToken = this.activeTokens.get(token.tokenId);
    if (!storedToken) {
      return { valid: false, error: '令牌不存在或已被撤销' };
    }

    // 检查是否已使用
    if (storedToken.used) {
      return { valid: false, error: '令牌已被使用，不可重复使用' };
    }

    // 检查是否过期
    if (Date.now() > storedToken.expiresAt) {
      // 清理过期令牌
      this.activeTokens.delete(token.tokenId);
      return { valid: false, error: '令牌已过期' };
    }

    // 验证HMAC签名（防篡改）- 使用传入的token数据重新计算签名进行比对
    const expectedSignature = this.computeSignatureForValidation(
      token.tokenId,
      token.taskId,
      token.permission,
      token.createdAt,
      token.expiresAt
    );
    
    if (!this.secureCompare(token.signature, expectedSignature)) {
      return { valid: false, error: '令牌签名无效，可能被篡改' };
    }

    return { valid: true, token: storedToken };
  }

  /**
   * 标记令牌为已使用（一次性使用）
   * @param tokenId 令牌ID
   * @returns 是否成功标记
   */
  consumeToken(tokenId: string): boolean {
    const token = this.activeTokens.get(tokenId);
    if (!token) {
      return false;
    }

    if (token.used) {
      return false; // 已经使用过
    }

    token.used = true;
    return true;
  }

  /**
   * 撤销任务的所有令牌（任务取消或完成时调用）
   * @param taskId 任务ID
   * @returns 撤销的令牌数量
   */
  revokeTaskTokens(taskId: string): number {
    let revokedCount = 0;
    
    for (const [tokenId, token] of this.activeTokens.entries()) {
      if (token.taskId === taskId) {
        this.activeTokens.delete(tokenId);
        revokedCount++;
      }
    }

    return revokedCount;
  }

  /**
   * 清理所有过期令牌
   * @returns 清理的令牌数量
   */
  cleanupExpiredTokens(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [tokenId, token] of this.activeTokens.entries()) {
      if (now > token.expiresAt || token.used) {
        this.activeTokens.delete(tokenId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * 检查任务是否有指定权限
   * @param token 任务令牌
   * @param requiredPermission 所需权限
   * @returns 是否有权限
   */
  hasPermission(token: ITaskToken, requiredPermission: TaskPermissionLevel): boolean {
    const permissionLevels: Record<TaskPermissionLevel, number> = {
      'read': 1,
      'write': 2,
      'execute': 3
    };

    return permissionLevels[token.permission] >= permissionLevels[requiredPermission];
  }

  /**
   * 获取活跃令牌数量（用于监控）
   */
  getActiveTokenCount(): number {
    return this.activeTokens.size;
  }

  /**
   * 生成唯一的令牌ID
   */
  private generateTokenId(): string {
    return `tt_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * 计算令牌的HMAC签名（生成时使用）
   */
  private computeSignature(token: ITaskToken): string {
    return this.computeSignatureForValidation(
      token.tokenId,
      token.taskId,
      token.permission,
      token.createdAt,
      token.expiresAt
    );
  }

  /**
   * 为验证计算HMAC签名（使用传入的字段值）
   */
  private computeSignatureForValidation(
    tokenId: string,
    taskId: string,
    permission: TaskPermissionLevel,
    createdAt: number,
    expiresAt: number
  ): string {
    const data = `${tokenId}:${taskId}:${permission}:${createdAt}:${expiresAt}`;
    const hmac = crypto.createHmac(TaskTokenManager.HMAC_ALGORITHM, this.hmacKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * 安全比较两个字符串（防止时序攻击）
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      // 如果不是有效的hex字符串，回退到普通比较
      return a === b;
    }
  }
}
