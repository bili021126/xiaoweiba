/**
 * ToolGateway 单元测试
 *
 * 测试覆盖：
 * - SEC-001: TaskToken 验证
 * - SEC-002: 命令拦截
 * - COM-002: 工具调用网关化
 * - AG-004: 权限验证
 */

import 'reflect-metadata';
import { ToolGateway, ToolRiskLevel, ToolCallRequest } from '../../../src/core/security/ToolGateway';
import { TaskTokenManager } from '../../../src/core/security/TaskTokenManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';

describe('ToolGateway', () => {
  let toolGateway: ToolGateway;
  let mockTaskTokenManager: jest.Mocked<TaskTokenManager>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    // Create mocks using jest.mocked pattern
    mockTaskTokenManager = {
      generateToken: jest.fn(),
      validateToken: jest.fn(),
      revokeToken: jest.fn(),
      cleanupExpired: jest.fn(),
      getActiveTokenCount: jest.fn(),
      validate: jest.fn().mockResolvedValue(true),
      consume: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<TaskTokenManager>;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined),
      exportLogs: jest.fn(),
      cleanupOldLogs: jest.fn(),
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      logToolCall: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<AuditLogger>;

    // Create ToolGateway instance with mocks
    toolGateway = new ToolGateway(mockTaskTokenManager, mockAuditLogger);

    // Register test tools
    toolGateway.registerTool({
      name: 'read_file',
      riskLevel: ToolRiskLevel.LOW,
      description: 'Read a file',
      requiresToken: false
    });

    toolGateway.registerTool({
      name: 'write_file',
      riskLevel: ToolRiskLevel.MEDIUM,
      description: 'Write to a file',
      requiresToken: true
    });

    toolGateway.registerTool({
      name: 'shell',
      riskLevel: ToolRiskLevel.HIGH,
      description: 'Execute shell command',
      requiresToken: true
    });
  });

  describe('Tool Registration', () => {
    it('should register tools correctly', () => {
      const tools = toolGateway.listRegisteredTools();
      expect(tools).toHaveLength(3);
      expect(tools.map((t: any) => t.name)).toContain('read_file');
      expect(tools.map((t: any) => t.name)).toContain('write_file');
      expect(tools.map((t: any) => t.name)).toContain('shell');
    });

    it('should return tool info by name', () => {
      const info = toolGateway.getToolInfo('write_file');
      expect(info).toBeDefined();
      expect(info?.riskLevel).toBe(ToolRiskLevel.MEDIUM);
      expect(info?.requiresToken).toBe(true);
    });

    it('should return undefined for unregistered tool', () => {
      const info = toolGateway.getToolInfo('nonexistent_tool');
      expect(info).toBeUndefined();
    });
  });

  describe('Command Validation (SEC-002)', () => {
    describe('Whitelist Commands', () => {
      const allowedCommands = [
        'ls -la',
        'git status',
        'git log',
        'cat package.json',
        'pwd',
        'echo "hello"',
        'grep -r "test" .',
        'find . -name "*.ts"',
        'wc -l file.ts',
        'head -n 10 file.ts',
        'tail -n 5 file.ts'
      ];

      allowedCommands.forEach(cmd => {
        it(`should allow: ${cmd}`, () => {
          expect(toolGateway.validateCommand(cmd)).toBe(true);
        });
      });
    });

    describe('Blacklist Commands', () => {
      const blockedCommands = [
        'rm -rf /',
        'rm -rf *',
        'dd if=/dev/zero of=/dev/sda',
        ':(){ :|:& };:',
        'mkfs.ext4 /dev/sda1',
        'chmod 777 /etc/passwd',
        'sudo rm -rf /',
        'su root',
        'passwd user',
        'shutdown now',
        'reboot',
        'format C:',
        'del /f /q *.*'
      ];

      blockedCommands.forEach(cmd => {
        it(`should block: ${cmd}`, () => {
          expect(toolGateway.validateCommand(cmd)).toBe(false);
        });
      });
    });

    describe('Edge Cases', () => {
      it('should reject empty command', () => {
        expect(toolGateway.validateCommand('')).toBe(false);
        expect(toolGateway.validateCommand('   ')).toBe(false);
      });

      it('should reject unknown commands not in whitelist', () => {
        expect(toolGateway.validateCommand('python script.py')).toBe(false);
        expect(toolGateway.validateCommand('npm install')).toBe(false);
        expect(toolGateway.validateCommand('node app.js')).toBe(false);
      });
    });
  });

  describe('TaskToken Validation (SEC-001)', () => {
    it('should allow LOW risk tool without token', async () => {
      const request: ToolCallRequest = {
        toolName: 'read_file',
        parameters: { path: '/path/to/file.ts' }
      };

      // Note: This will fail because invokeTool is not implemented
      // but we can verify the token check logic doesn't throw
      try {
        await toolGateway.executeTool(request);
      } catch (error) {
        // Expected to fail at invokeTool stage, not token validation
        expect((error as Error).message).toContain('not implemented');
      }

      // Verify token validation was NOT called for LOW risk
      expect(mockTaskTokenManager.validate).not.toHaveBeenCalled();
    });

    it('should reject MEDIUM risk tool without token', async () => {
      const request: ToolCallRequest = {
        toolName: 'write_file',
        parameters: { path: '/path/to/file.ts', content: 'test' }
      };

      const result = await toolGateway.executeTool(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires a valid TaskToken');
      expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOOL_CALL_MISSING_TOKEN'
        })
      );
    });

    it('should reject HIGH risk tool with invalid token', async () => {
      mockTaskTokenManager.validate = jest.fn().mockResolvedValue(false);

      const request: ToolCallRequest = {
        toolName: 'shell',
        parameters: { command: 'ls -la' },
        taskToken: 'invalid-token'
      };

      const result = await toolGateway.executeTool(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired TaskToken');
      expect(mockTaskTokenManager.validate).toHaveBeenCalledWith('invalid-token');
      expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TOOL_CALL_INVALID_TOKEN'
        })
      );
    });

    it('should accept valid token for MEDIUM risk tool', async () => {
      const request: ToolCallRequest = {
        toolName: 'write_file',
        parameters: { path: '/path/to/file.ts', content: 'test' },
        taskToken: 'valid-token'
      };

      try {
        await toolGateway.executeTool(request);
      } catch (error) {
        // Expected to fail at invokeTool stage
        expect((error as Error).message).toContain('not implemented');
      }

      // Verify token was validated
      expect(mockTaskTokenManager.validate).toHaveBeenCalledWith('valid-token');
      // Note: consume is not called because invokeTool throws an error
      // In a real implementation, consume would be called after successful execution
    });
  });

  describe('Unregistered Tool', () => {
    it('should reject unregistered tool', async () => {
      const request: ToolCallRequest = {
        toolName: 'nonexistent_tool',
        parameters: {}
      };

      const result = await toolGateway.executeTool(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });
  });

  describe('Parameter Sanitization', () => {
    it('should redact sensitive parameters in logs', async () => {
      const request: ToolCallRequest = {
        toolName: 'read_file',
        parameters: {
          path: '/path/to/file.ts',
          password: 'secret123',
          apiKey: 'sk-123456',
          normalParam: 'visible'
        }
      };

      try {
        await toolGateway.executeTool(request);
      } catch (error) {
        // Ignore invokeTool error
      }

      // Verify audit log was called with sanitized parameters
      expect(mockAuditLogger.logToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            password: '***REDACTED***',
            apiKey: '***REDACTED***',
            normalParam: 'visible'
          })
        })
      );
    });
  });

  describe('Security Event Logging (SEC-005)', () => {
    it('should log blocked commands', async () => {
      const request: ToolCallRequest = {
        toolName: 'shell',
        parameters: { command: 'rm -rf /' },
        taskToken: 'valid-token'
      };

      const result = await toolGateway.executeTool(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command blocked by security policy');
      expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'COMMAND_BLOCKED',
          severity: 'CRITICAL'
        })
      );
    });
  });
});
