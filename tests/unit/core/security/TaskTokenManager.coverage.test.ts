/**
 * TaskTokenManager 单元测试 - 覆盖率提�?
 */

import 'reflect-metadata';
import { TaskTokenManager } from '../../../../src/core/security/TaskTokenManager';

describe('TaskTokenManager - 覆盖率提�?, () => {
  let tokenManager: TaskTokenManager;

  beforeEach(() => {
    tokenManager = new TaskTokenManager();
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('应生成具有唯一ID的令�?, () => {
      const token1 = tokenManager.generateToken('action1', 'read');
      const token2 = tokenManager.generateToken('action1', 'read');

      expect(token1.tokenId).not.toBe(token2.tokenId);
      expect(token1.tokenId).toMatch(/^tt_\d+_[a-z0-9]{16}$/);
    });

    it('应设置正确的过期时间�?分钟后）', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const token = tokenManager.generateToken('test_action', 'write');

      expect(token.expiresAt).toBe(now + 5 * 60 * 1000);
    });

    it('应保存不同的权限级别', () => {
      const readToken = tokenManager.generateToken('action1', 'read');
      const writeToken = tokenManager.generateToken('action2', 'write');

      expect(readToken.permission).toBe('read');
      expect(writeToken.permission).toBe('write');
    });

    it('应增加活跃令牌数�?, () => {
      const initialCount = tokenManager.getActiveTokenCount();
      
      tokenManager.generateToken('action1', 'read');
      tokenManager.generateToken('action2', 'write');

      expect(tokenManager.getActiveTokenCount()).toBe(initialCount + 2);
    });
  });

  describe('validateToken', () => {
    it('应验证有效的未过期令�?, () => {
      const token = tokenManager.generateToken('test_action', 'read');
      
      const isValid = tokenManager.validateToken(token.tokenId, 'read');

      expect(isValid).toBe(true);
    });

    it('应拒绝不存在的令�?, () => {
      const isValid = tokenManager.validateToken('non_existent_token', 'read');
      
      expect(isValid).toBe(false);
    });

    it('应拒绝已过期的令�?, () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const token = tokenManager.generateToken('test_action', 'read');
      
      // 模拟时间超过5分钟
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);

      const isValid = tokenManager.validateToken(token.tokenId, 'read');

      expect(isValid).toBe(false);
    });

    it('应拒绝权限不匹配的令�?, () => {
      const token = tokenManager.generateToken('test_action', 'read');
      
      const isValid = tokenManager.validateToken(token.tokenId, 'write');

      expect(isValid).toBe(false);
    });

    it('过期令牌应从activeTokens中删�?, () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const token = tokenManager.generateToken('test_action', 'read');
      expect(tokenManager.getActiveTokenCount()).toBe(1);
      
      // 模拟时间超过5分钟
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      tokenManager.validateToken(token.tokenId, 'read');

      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });
  });

  describe('revokeToken', () => {
    it('应成功撤销有效令牌', () => {
      const token = tokenManager.generateToken('test_action', 'read');
      
      tokenManager.revokeToken(token.tokenId);

      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });

    it('撤销不存在的令牌不应抛出异常', () => {
      expect(() => {
        tokenManager.revokeToken('non_existent');
      }).not.toThrow();
    });

    it('撤销后令牌应失效', () => {
      const token = tokenManager.generateToken('test_action', 'read');
      
      tokenManager.revokeToken(token.tokenId);
      const isValid = tokenManager.validateToken(token.tokenId, 'read');

      expect(isValid).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('应清理所有过期令�?, () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const token1 = tokenManager.generateToken('action1', 'read');
      const token2 = tokenManager.generateToken('action2', 'write');
      
      expect(tokenManager.getActiveTokenCount()).toBe(2);
      
      // 模拟时间超过5分钟
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      
      tokenManager.cleanupExpired();

      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });

    it('应保留未过期的令�?, () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const validToken = tokenManager.generateToken('action1', 'read');
      
      // 只过�?分钟（未过期�?
      jest.spyOn(Date, 'now').mockReturnValue(now + 2 * 60 * 1000);
      
      tokenManager.cleanupExpired();

      expect(tokenManager.getActiveTokenCount()).toBe(1);
      expect(tokenManager.validateToken(validToken.tokenId, 'read')).toBe(true);
    });

    it('应同时清理多个过期令牌并保留有效令牌', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      const expiredToken1 = tokenManager.generateToken('action1', 'read');
      const validToken = tokenManager.generateToken('action2', 'write');
      const expiredToken2 = tokenManager.generateToken('action3', 'read');
      
      // 模拟时间：expiredToken1和expiredToken2已过期，validToken仍有�?
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      
      // 重新生成validToken使其不过�?
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      const newValidToken = tokenManager.generateToken('action4', 'write');
      
      tokenManager.cleanupExpired();

      expect(tokenManager.getActiveTokenCount()).toBe(1);
    });

    it('无过期令牌时不应影响活跃令牌', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      
      tokenManager.generateToken('action1', 'read');
      tokenManager.generateToken('action2', 'write');
      
      // 只过�?分钟
      jest.spyOn(Date, 'now').mockReturnValue(now + 1 * 60 * 1000);
      
      tokenManager.cleanupExpired();

      expect(tokenManager.getActiveTokenCount()).toBe(2);
    });
  });

  describe('getActiveTokenCount', () => {
    it('初始时应返回0', () => {
      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });

    it('生成令牌后应正确计数', () => {
      tokenManager.generateToken('action1', 'read');
      expect(tokenManager.getActiveTokenCount()).toBe(1);
      
      tokenManager.generateToken('action2', 'write');
      expect(tokenManager.getActiveTokenCount()).toBe(2);
    });

    it('撤销令牌后应减少计数', () => {
      const token1 = tokenManager.generateToken('action1', 'read');
      const token2 = tokenManager.generateToken('action2', 'write');
      
      expect(tokenManager.getActiveTokenCount()).toBe(2);
      
      tokenManager.revokeToken(token1.tokenId);
      expect(tokenManager.getActiveTokenCount()).toBe(1);
      
      tokenManager.revokeToken(token2.tokenId);
      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });
  });

  describe('边界条件', () => {
    it('应处理大量令牌的生成和清�?, () => {
      const tokens: string[] = [];
      
      // 生成100个令�?
      for (let i = 0; i < 100; i++) {
        const token = tokenManager.generateToken(`action_${i}`, i % 2 === 0 ? 'read' : 'write');
        tokens.push(token.tokenId);
      }
      
      expect(tokenManager.getActiveTokenCount()).toBe(100);
      
      // 撤销一�?
      for (let i = 0; i < 50; i++) {
        tokenManager.revokeToken(tokens[i]);
      }
      
      expect(tokenManager.getActiveTokenCount()).toBe(50);
    });

    it('应处理空字符串actionId', () => {
      const token = tokenManager.generateToken('', 'read');
      
      expect(token.actionId).toBe('');
      expect(tokenManager.validateToken(token.tokenId, 'read')).toBe(true);
    });

    it('多次撤销同一令牌应安�?, () => {
      const token = tokenManager.generateToken('action1', 'read');
      
      tokenManager.revokeToken(token.tokenId);
      expect(() => {
        tokenManager.revokeToken(token.tokenId);
      }).not.toThrow();
      
      expect(tokenManager.getActiveTokenCount()).toBe(0);
    });
  });
});
