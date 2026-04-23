import { injectable } from 'tsyringe';
import * as crypto from 'crypto'; // ✅ 修复 #40：使用加密安全的随机数

/**
 * 任务权限级别
 */
export type TaskPermissionLevel = 'read' | 'write';

/**
 * 任务令牌接口（简化版，无HMAC）
 */
interface TaskToken {
  tokenId: string;
  actionId: string;
  permission: TaskPermissionLevel;
  expiresAt: number;
}

/**
 * 任务级授权令牌管理器（简化版）
 * 
 * 为每个AI代理任务生成一次性使用的授权令牌，确保：
 * 1. 最小权限原则：每个任务只能访问被明确授权的资源
 * 2. 时效性：令牌在5分钟后自动失效
 * 3. 一次性使用：令牌使用后可撤销
 */
@injectable()
export class TaskTokenManager {
  private activeTokens: Map<string, TaskToken> = new Map();
  private readonly TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5分钟过期

  /**
   * 生成新的授权令牌
   */
  generateToken(actionId: string, permission: TaskPermissionLevel): TaskToken {
    // ✅ 修复 #40：使用 crypto.randomBytes 替代 Math.random()
    const randomPart = crypto.randomBytes(8).toString('hex');
    const token: TaskToken = {
      tokenId: `tt_${Date.now()}_${randomPart}`,
      actionId,
      permission,
      expiresAt: Date.now() + this.TOKEN_EXPIRY_MS
    };
    this.activeTokens.set(token.tokenId, token);
    return token;
  }

  /**
   * 验证令牌是否有效
   */
  validateToken(tokenId: string, requiredPermission: TaskPermissionLevel): boolean {
    const token = this.activeTokens.get(tokenId);
    if (!token) return false;
    
    // 检查是否过期
    if (Date.now() > token.expiresAt) {
      this.activeTokens.delete(tokenId);
      return false;
    }
    
    // 检查权限是否匹配
    return token.permission === requiredPermission;
  }

  /**
   * 撤销令牌
   */
  revokeToken(tokenId: string): void {
    this.activeTokens.delete(tokenId);
  }

  /**
   * 清理所有过期令牌
   */
  cleanupExpired(): void {
    const now = Date.now();
    for (const [id, token] of this.activeTokens) {
      if (now > token.expiresAt) {
        this.activeTokens.delete(id);
      }
    }
  }

  /**
   * 获取活跃令牌数量（用于调试）
   */
  getActiveTokenCount(): number {
    return this.activeTokens.size;
  }
}
