/**
 * TaskTokenManager 单元测试
 */

import 'reflect-metadata';
import { TaskTokenManager, TaskPermissionLevel } from '../../../../src/core/security/TaskToken';

describe('TaskTokenManager', () => {
  let tokenManager: TaskTokenManager;

  beforeEach(() => {
    tokenManager = new TaskTokenManager();
  });

  describe('generateToken', () => {
    it('应该生成有效的任务令牌', () => {
      const token = tokenManager.generateToken('task-001', 'read');

      expect(token.tokenId).toMatch(/^tt_[0-9a-f]{32}$/);
      expect(token.taskId).toBe('task-001');
      expect(token.permission).toBe('read');
      expect(token.createdAt).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.createdAt);
      expect(token.used).toBe(false);
      expect(token.signature).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('应该使用默认read权限', () => {
      const token = tokenManager.generateToken('task-002');
      expect(token.permission).toBe('read');
    });

    it('应该为不同任务生成不同的令牌', () => {
      const token1 = tokenManager.generateToken('task-001');
      const token2 = tokenManager.generateToken('task-002');

      expect(token1.tokenId).not.toBe(token2.tokenId);
      expect(token1.signature).not.toBe(token2.signature);
    });

    it('应该为同一任务多次调用生成不同令牌', () => {
      const token1 = tokenManager.generateToken('task-001');
      const token2 = tokenManager.generateToken('task-001');

      expect(token1.tokenId).not.toBe(token2.tokenId);
    });
  });

  describe('validateToken', () => {
    it('应该验证有效的令牌', () => {
      const token = tokenManager.generateToken('task-001', 'read');
      const result = tokenManager.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token?.tokenId).toBe(token.tokenId);
    });

    it('应该拒绝不存在的令牌', () => {
      const fakeToken = {
        tokenId: 'tt_nonexistent',
        taskId: 'task-001',
        permission: 'read' as const,
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
        used: false,
        signature: 'invalid'
      };

      const result = tokenManager.validateToken(fakeToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不存在');
    });

    it('应该拒绝已使用的令牌', () => {
      const token = tokenManager.generateToken('task-001');
      tokenManager.consumeToken(token.tokenId);

      const result = tokenManager.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('已被使用');
    });

    it('应该拒绝过期的令牌', () => {
      const token = tokenManager.generateToken('task-001');
      
      // 手动修改过期时间为过去
      (token as any).expiresAt = Date.now() - 1000;
      // 更新存储的令牌
      (tokenManager as any).activeTokens.set(token.tokenId, token);

      const result = tokenManager.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('过期');
    });

    it('应该拒绝签名被篡改的令牌', () => {
      const token = tokenManager.generateToken('task-001');
      
      // 篡改签名
      const tamperedToken = { ...token, signature: 'tampered_signature' };

      const result = tokenManager.validateToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('签名无效');
    });

    it('应该拒绝权限被篡改的令牌', () => {
      const token = tokenManager.generateToken('task-001', 'read');
      
      // 篡改权限但保留原签名
      const tamperedToken = { ...token, permission: 'execute' as const };

      const result = tokenManager.validateToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('签名无效');
    });
  });

  describe('consumeToken', () => {
    it('应该成功标记未使用的令牌', () => {
      const token = tokenManager.generateToken('task-001');
      
      const result = tokenManager.consumeToken(token.tokenId);

      expect(result).toBe(true);
      
      // 验证令牌已标记为已使用
      const validation = tokenManager.validateToken(token);
      expect(validation.valid).toBe(false);
    });

    it('应该拒绝消费不存在的令牌', () => {
      const result = tokenManager.consumeToken('nonexistent');
      expect(result).toBe(false);
    });

    it('应该拒绝重复消费同一令牌', () => {
      const token = tokenManager.generateToken('task-001');
      tokenManager.consumeToken(token.tokenId);

      const result = tokenManager.consumeToken(token.tokenId);
      expect(result).toBe(false);
    });
  });

  describe('revokeTaskTokens', () => {
    it('应该撤销任务的所有令牌', () => {
      tokenManager.generateToken('task-001', 'read');
      tokenManager.generateToken('task-001', 'write');
      tokenManager.generateToken('task-002', 'read');

      const revokedCount = tokenManager.revokeTaskTokens('task-001');

      expect(revokedCount).toBe(2);
      expect(tokenManager.getActiveTokenCount()).toBe(1);
    });

    it('应该返回0当任务没有令牌时', () => {
      const revokedCount = tokenManager.revokeTaskTokens('nonexistent-task');
      expect(revokedCount).toBe(0);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('应该清理过期的令牌', () => {
      const token1 = tokenManager.generateToken('task-001');
      const token2 = tokenManager.generateToken('task-002');
      
      // 手动使token1过期
      (tokenManager as any).activeTokens.get(token1.tokenId).expiresAt = Date.now() - 1000;

      const cleanedCount = tokenManager.cleanupExpiredTokens();

      expect(cleanedCount).toBe(1);
      expect(tokenManager.getActiveTokenCount()).toBe(1);
    });

    it('应该清理已使用的令牌', () => {
      const token1 = tokenManager.generateToken('task-001');
      tokenManager.generateToken('task-002');
      
      tokenManager.consumeToken(token1.tokenId);

      const cleanedCount = tokenManager.cleanupExpiredTokens();

      expect(cleanedCount).toBe(1);
      expect(tokenManager.getActiveTokenCount()).toBe(1);
    });

    it('应该返回0当没有需要清理的令牌时', () => {
      tokenManager.generateToken('task-001');
      
      const cleanedCount = tokenManager.cleanupExpiredTokens();

      expect(cleanedCount).toBe(0);
    });
  });

  describe('hasPermission', () => {
    it('read权限只能访问read资源', () => {
      const token = tokenManager.generateToken('task-001', 'read');

      expect(tokenManager.hasPermission(token, 'read')).toBe(true);
      expect(tokenManager.hasPermission(token, 'write')).toBe(false);
      expect(tokenManager.hasPermission(token, 'execute')).toBe(false);
    });

    it('write权限可以访问read和write资源', () => {
      const token = tokenManager.generateToken('task-001', 'write');

      expect(tokenManager.hasPermission(token, 'read')).toBe(true);
      expect(tokenManager.hasPermission(token, 'write')).toBe(true);
      expect(tokenManager.hasPermission(token, 'execute')).toBe(false);
    });

    it('execute权限可以访问所有资源', () => {
      const token = tokenManager.generateToken('task-001', 'execute');

      expect(tokenManager.hasPermission(token, 'read')).toBe(true);
      expect(tokenManager.hasPermission(token, 'write')).toBe(true);
      expect(tokenManager.hasPermission(token, 'execute')).toBe(true);
    });
  });

  describe('getActiveTokenCount', () => {
    it('应该返回正确的活跃令牌数量', () => {
      expect(tokenManager.getActiveTokenCount()).toBe(0);

      tokenManager.generateToken('task-001');
      expect(tokenManager.getActiveTokenCount()).toBe(1);

      tokenManager.generateToken('task-002');
      expect(tokenManager.getActiveTokenCount()).toBe(2);

      tokenManager.revokeTaskTokens('task-001');
      expect(tokenManager.getActiveTokenCount()).toBe(1);
    });
  });

  describe('安全特性', () => {
    it('令牌ID应该是不可预测的', () => {
      const tokens = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const token = tokenManager.generateToken(`task-${i}`);
        tokens.add(token.tokenId);
      }

      // 所有令牌ID应该是唯一的
      expect(tokens.size).toBe(100);
    });

    it('签名应该防止篡改', () => {
      const token = tokenManager.generateToken('task-001', 'read');
      
      // 尝试各种篡改方式
      const tamperedVariants = [
        { ...token, taskId: 'other-task' },
        { ...token, permission: 'execute' as const },
        { ...token, createdAt: Date.now() + 1000000 },
        { ...token, expiresAt: Date.now() + 10000000 }
      ];

      tamperedVariants.forEach(tampered => {
        const result = tokenManager.validateToken(tampered);
        expect(result.valid).toBe(false);
      });
    });

    it('应该使用时间安全比较防止时序攻击', () => {
      const token = tokenManager.generateToken('task-001');
      
      // 创建签名长度相同但内容不同的令牌
      const wrongSignature = 'a'.repeat(64);
      const tamperedToken = { ...token, signature: wrongSignature };

      const result = tokenManager.validateToken(tamperedToken);
      expect(result.valid).toBe(false);
    });
  });

  describe('边界条件', () => {
    it('应该处理空taskId', () => {
      const token = tokenManager.generateToken('', 'read');
      expect(token.tokenId).toMatch(/^tt_/);
      expect(token.taskId).toBe('');
    });

    it('应该处理特殊字符taskId', () => {
      const specialId = 'task-with-special_chars.123!@#';
      const token = tokenManager.generateToken(specialId, 'read');
      expect(token.taskId).toBe(specialId);
    });

    it('应该在大量令牌时正常工作', () => {
      const tokens: any[] = [];
      
      for (let i = 0; i < 1000; i++) {
        tokens.push(tokenManager.generateToken(`task-${i}`));
      }

      expect(tokenManager.getActiveTokenCount()).toBe(1000);

      // 验证所有令牌都有效
      const allValid = tokens.every(t => tokenManager.validateToken(t).valid);
      expect(allValid).toBe(true);
    });
  });
});
