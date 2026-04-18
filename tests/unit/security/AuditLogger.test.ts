import * as fs from 'fs';
import * as crypto from 'crypto';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { ConfigManager } from '../../../src/storage/ConfigManager';

// Mock pino at module level
const mockPinoLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

jest.mock('pino', () => {
  const mock = jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  });
  (mock as any).stdTimeFunctions = { isoTime: () => new Date().toISOString() };
  (mock as any).destination = jest.fn();
  return mock;
});

jest.mock('fs');
jest.mock('crypto');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        audit: {
          level: 'info' as const,
          maxFileSizeMB: 20,
          maxFiles: 10
        }
      })
    } as any;

    (mockCrypto.randomBytes as jest.Mock).mockReturnValue(Buffer.from('mock-key'));
    (mockCrypto.createHmac as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hmac')
    });
    (mockCrypto.timingSafeEqual as jest.Mock).mockReturnValue(true);
    (mockCrypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed-params')
    });

    (mockFs.existsSync as jest.Mock).mockReturnValue(false);
    (mockFs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (mockFs.appendFileSync as jest.Mock).mockImplementation(() => {});
    (mockFs.readFileSync as jest.Mock).mockReturnValue('');
    (mockFs.readdirSync as jest.Mock).mockReturnValue([]);
    (mockFs.statSync as jest.Mock).mockReturnValue({ size: 100, mtimeMs: Date.now() });

    auditLogger = new AuditLogger(mockConfigManager);
  });

  describe('log', () => {
    it('should log successful operation', async () => {
      await auditLogger.log('test_operation', 'success', 100, {
        sessionId: 'test-session',
        parameters: { key: 'value' },
        filePath: '/test/file.ts'
      });

      expect(mockFs.appendFileSync).toHaveBeenCalled();
    });

    it('should log failed operation', async () => {
      await auditLogger.log('test_operation', 'failure', 50);
      expect(mockFs.appendFileSync).toHaveBeenCalled();
    });

    it('should generate session id if not provided', async () => {
      await auditLogger.log('test_operation', 'success', 100);
      expect(mockFs.appendFileSync).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error with details', async () => {
      const error = new Error('Test error');
      error.stack = 'Test stack trace';

      await auditLogger.logError('test_operation', error, 200, {
        sessionId: 'test-session'
      });

      expect(mockFs.appendFileSync).toHaveBeenCalled();
    });
  });

  describe('exportLogs', () => {
    it('should export logs to file', () => {
      const mockLogEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'sess_123',
        operation: 'test',
        result: 'success',
        durationMs: 100,
        hmacSignature: 'mock-hmac'
      });

      (mockFs.readdirSync as jest.Mock).mockReturnValue(['audit-2026-04-14.log']);
      (mockFs.readFileSync as jest.Mock).mockReturnValue(mockLogEntry);
      (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});

      auditLogger.exportLogs('/tmp/export.json');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('cleanupOldLogs', () => {
    it('should remove old log files beyond maxFiles limit', () => {
      const oldFiles = Array.from({ length: 15 }, (_, i) =>
        `audit-2026-04-${String(i + 1).padStart(2, '0')}.log`
      );
      (mockFs.readdirSync as jest.Mock).mockReturnValue(oldFiles);
      (mockFs.unlinkSync as jest.Mock).mockImplementation(() => {});

      auditLogger.cleanupOldLogs();
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(5);
    });

    it('应该日志目录不存在时创建目录', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValueOnce(false);
      
      await auditLogger.log('test', 'success', 100);
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it('应该appendFileSync失败时捕获错误', async () => {
      (mockFs.appendFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('写入失败');
      });

      // 不应该抛出异常
      await expect(
        auditLogger.log('test', 'success', 100)
      ).resolves.toBeUndefined();
    });
  });
});
