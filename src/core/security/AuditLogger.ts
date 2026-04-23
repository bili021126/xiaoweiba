import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import pino from 'pino';
import { injectable, inject } from 'tsyringe';
import { ConfigManager } from '../../storage/ConfigManager';

export interface AuditLogEntry {
  timestamp: number;
  sessionId: string;
  operation: string;
  result: 'success' | 'failure';
  durationMs: number;
  parametersHash?: string;
  filePath?: string;
  hmacSignature: string;
}

@injectable()
export class AuditLogger {
  private logger: pino.Logger;
  private logDir: string;
  private currentLogFile: string;
  private hmacKey: Buffer;
  private maxFileSize: number;
  private maxFiles: number;

  constructor(@inject(ConfigManager) private configManager: ConfigManager) {
    const homeDir = os.homedir();
    this.logDir = path.join(homeDir, '.xiaoweiba', 'logs');

    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 生成 HMAC 密钥（从系统密钥环或随机生成）
    this.hmacKey = this.generateHmacKey();

    // 获取配置
    const config = this.configManager.getConfig();
    this.maxFileSize = config.audit.maxFileSizeMB * 1024 * 1024;
    this.maxFiles = config.audit.maxFiles;

    // 当前日志文件
    this.currentLogFile = this.getOrCreateLogFile();

    // 初始化 pino logger
    this.logger = pino(
      {
        level: config.audit.level,
        formatters: {
          level: (label) => ({ level: label.toUpperCase() })
        },
        timestamp: pino.stdTimeFunctions.isoTime
      },
      pino.destination({
        dest: this.currentLogFile,
        sync: true
      })
    );
  }

  /**
   * 记录审计日志
   */
  async log(
    operation: string,
    result: 'success' | 'failure',
    durationMs: number,
    options?: {
      sessionId?: string;
      parameters?: Record<string, unknown>;
      filePath?: string;
    }
  ): Promise<void> {
    try {
      const entry: Omit<AuditLogEntry, 'hmacSignature'> = {
        timestamp: Date.now(),
        sessionId: options?.sessionId || this.generateSessionId(),
        operation,
        result,
        durationMs,
        parametersHash: options?.parameters
          ? this.hashParameters(options.parameters)
          : undefined,
        filePath: options?.filePath
      };

      // 生成 HMAC 签名
      const hmacSignature = this.generateHmac(entry);

      // 写入加密日志
      this.writeEncryptedLog({ ...entry, hmacSignature });

      // 同时写入结构化日志（用于调试）
      this.logger.info({
        timestamp: entry.timestamp,
        sessionId: entry.sessionId,
        operation: entry.operation,
        result: entry.result,
        durationMs: entry.durationMs
      });

      // 检查是否需要轮转
      this.checkLogRotation();
    } catch (error) {
      // 审计日志失败不应影响主流程，但需要记录到控制台
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * 记录错误日志
   */
  async logError(
    operation: string,
    error: Error,
    durationMs: number,
    options?: {
      sessionId?: string;
      filePath?: string;
    }
  ): Promise<void> {
    await this.log(operation, 'failure', durationMs, {
      ...options,
      parameters: { error: error.message, stack: error.stack }
    });
  }

  /**
   * 导出审计日志
   */
  exportLogs(outputPath: string): void {
    const logFiles = this.getLogFiles();
    const allLogs: AuditLogEntry[] = [];

    for (const logFile of logFiles) {
      try {
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AuditLogEntry;
            // 验证 HMAC
            if (this.verifyHmac(entry)) {
              allLogs.push(entry);
            }
          } catch {
            // 跳过无效行
          }
        }
      } catch (error) {
        console.warn(`Failed to read log file ${logFile}:`, error);
      }
    }

    // 按时间排序
    allLogs.sort((a, b) => a.timestamp - b.timestamp);

    // 写入导出文件
    fs.writeFileSync(outputPath, JSON.stringify(allLogs, null, 2), 'utf-8');
  }

  /**
   * 清理旧日志
   */
  cleanupOldLogs(): void {
    const logFiles = this.getLogFiles();

    // 保留最近的 maxFiles 个文件
    if (logFiles.length > this.maxFiles) {
      const filesToDelete = logFiles.slice(0, logFiles.length - this.maxFiles);
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file);
        } catch (error) {
          console.warn(`Failed to delete old log file ${file}:`, error);
        }
      }
    }
  }

  /**
   * 获取或创建日志文件
   */
  private getOrCreateLogFile(): string {
    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `audit-${dateStr}.log`);

    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '', 'utf-8');
    }

    return logFile;
  }

  /**
   * 生成 HMAC 密钥
   */
  private generateHmacKey(): Buffer {
    // 在实际生产中，应该从系统密钥环获取
    // 这里使用随机生成的密钥作为示例
    const keyPath = path.join(this.logDir, '.hmac-key');

    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    }

    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    fs.chmodSync(keyPath, 0o600); // 仅所有者可读写

    return key;
  }

  /**
   * 生成 HMAC 签名
   */
  private generateHmac(entry: Omit<AuditLogEntry, 'hmacSignature'>): string {
    const data = JSON.stringify(entry);
    const hmac = crypto.createHmac('sha256', this.hmacKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * 验证 HMAC 签名
   */
  private verifyHmac(entry: AuditLogEntry): boolean {
    const { hmacSignature, ...rest } = entry;
    const expectedHmac = this.generateHmac(rest);
    return crypto.timingSafeEqual(
      Buffer.from(hmacSignature, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );
  }

  /**
   * 写入加密日志
   */
  private writeEncryptedLog(entry: AuditLogEntry): void {
    // 在实际生产中，可以使用 AES-256-GCM 加密整个日志条目
    // 这里为了简化，直接写入 JSON（HMAC 已保证完整性）
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentLogFile, line, 'utf-8');
  }

  /**
   * 哈希化参数
   */
  private hashParameters(params: Record<string, unknown>): string {
    const data = JSON.stringify(params);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    // ✅ 修复 #40：使用 crypto.randomBytes 替代 Math.random()
    const randomPart = crypto.randomBytes(8).toString('hex');
    return `sess_${Date.now()}_${randomPart}`;
  }

  /**
   * 检查日志轮转
   */
  private checkLogRotation(): void {
    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.maxFileSize) {
        // 轮转日志
        const timestamp = Date.now();
        const rotatedFile = `${this.currentLogFile}.${timestamp}`;
        fs.renameSync(this.currentLogFile, rotatedFile);

        // 创建新日志文件
        this.currentLogFile = this.getOrCreateLogFile();

        // 重新初始化 logger
        this.logger = pino(
          {
            level: this.configManager.getConfig().audit.level,
            formatters: {
              level: (label) => ({ level: label.toUpperCase() })
            },
            timestamp: pino.stdTimeFunctions.isoTime
          },
          pino.destination({
            dest: this.currentLogFile,
            sync: true
          })
        );

        // 清理旧日志
        this.cleanupOldLogs();
      }
    } catch (error) {
      console.warn('Log rotation failed:', error);
    }
  }

  /**
   * 获取所有日志文件（按时间排序）
   */
  private getLogFiles(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter((f) => f.startsWith('audit-') && f.endsWith('.log'))
        .map((f) => path.join(this.logDir, f))
        .sort();
    } catch {
      return [];
    }
  }
}
