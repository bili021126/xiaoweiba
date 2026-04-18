import { DatabaseManager } from '../../storage/DatabaseManager';
import { AuditLogger } from '../security/AuditLogger';
import { ErrorCode, createError } from '../../utils/ErrorCodes';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 记忆归档管理器
 * 负责将过期记忆归档到文件，减少数据库大小
 */
export interface ArchivalConfig {
  retentionDays: number; // 保留天数
  archivePath: string; // 归档文件路径
  autoArchive: boolean; // 是否自动归档
}

const DEFAULT_CONFIG: ArchivalConfig = {
  retentionDays: 90,
  archivePath: '', // 需要在初始化时设置
  autoArchive: true
};

export class MemoryArchiver {
  private config: ArchivalConfig;
  private dbManager: DatabaseManager;
  private auditLogger: AuditLogger;

  constructor(
    dbManager: DatabaseManager,
    auditLogger: AuditLogger,
    config: Partial<ArchivalConfig> = {}
  ) {
    this.dbManager = dbManager;
    this.auditLogger = auditLogger;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行归档操作
   * @param projectFingerprint 项目指纹
   * @returns 归档的记忆数量
   */
  async archive(projectFingerprint: string): Promise<number> {
    const startTime = Date.now();
    try {
      if (!this.config.autoArchive) {
        console.log('[MemoryArchiver] Auto-archive disabled, skip');
        return 0;
      }

      const db = this.dbManager.getDatabase();
      const cutoffTimestamp = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;

      // 查询需要归档的记忆
      const memories = this.queryMemoriesToArchive(db, projectFingerprint, cutoffTimestamp);

      if (memories.length === 0) {
        console.log('[MemoryArchiver] No memories to archive');
        return 0;
      }

      // 写入归档文件
      const archiveFile = await this.writeArchiveFile(memories, projectFingerprint);

      // 从数据库删除已归档的记忆
      this.deleteArchivedMemories(db, projectFingerprint, cutoffTimestamp);

      const archivedCount = db.getRowsModified();

      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_archive', 'success', duration, {
        parameters: { archivedCount, archiveFile }
      });

      console.log(`[MemoryArchiver] Archived ${archivedCount} memories to ${archiveFile}`);
      return archivedCount;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_archive', error as Error, duration);
      console.error('[MemoryArchiver] Archive failed:', error);
      throw error;
    }
  }

  /**
   * 查询需要归档的记忆
   */
  private queryMemoriesToArchive(db: any, projectFingerprint: string, cutoffTimestamp: number): any[] {
    const sql = `
      SELECT * FROM episodic_memory 
      WHERE project_fingerprint = ? AND timestamp < ?
      ORDER BY timestamp ASC
    `;

    const stmt = db.prepare(sql);
    stmt.bind([projectFingerprint, cutoffTimestamp]);

    const memories: any[] = [];
    while (stmt.step()) {
      memories.push(stmt.getAsObject());
    }
    stmt.free();

    return memories;
  }

  /**
   * 写入归档文件（JSON格式）
   */
  private async writeArchiveFile(memories: any[], projectFingerprint: string): Promise<string> {
    // 确保归档目录存在，并进行路径合法性校验
    let archiveDir = this.config.archivePath || path.join(process.cwd(), 'archives');
    
    // 路径规范化与安全校验（防止路径遍历攻击）
    archiveDir = path.normalize(archiveDir);
    const baseDir = path.resolve(process.cwd());
    if (!archiveDir.startsWith(baseDir)) {
      throw createError(
        ErrorCode.SEC_PATH_TRAVERSAL_DETECTED,
        `Invalid archive path: ${archiveDir} is outside of base directory`,
        `归档路径不合法：${archiveDir} 超出了基础目录范围`
      );
    }
    
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // 生成归档文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `memory_archive_${projectFingerprint}_${timestamp}.json`;
    const filePath = path.join(archiveDir, fileName);

    // 写入JSON文件
    const archiveData = {
      version: '1.0',
      archivedAt: new Date().toISOString(),
      projectFingerprint,
      memoryCount: memories.length,
      memories
    };

    fs.writeFileSync(filePath, JSON.stringify(archiveData, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * 删除已归档的记忆
   */
  private deleteArchivedMemories(db: any, projectFingerprint: string, cutoffTimestamp: number): void {
    db.run(
      'DELETE FROM episodic_memory WHERE project_fingerprint = ? AND timestamp < ?',
      [projectFingerprint, cutoffTimestamp]
    );
  }

  /**
   * 从归档文件恢复记忆
   * @param archiveFilePath 归档文件路径
   * @returns 恢复的记忆数量
   */
  async restoreFromArchive(archiveFilePath: string): Promise<number> {
    try {
      if (!fs.existsSync(archiveFilePath)) {
        throw new Error(`Archive file not found: ${archiveFilePath}`);
      }

      const content = fs.readFileSync(archiveFilePath, 'utf-8');
      const archiveData = JSON.parse(content);

      if (!archiveData.memories || !Array.isArray(archiveData.memories)) {
        throw new Error('Invalid archive file format');
      }

      const db = this.dbManager.getDatabase();
      let restoredCount = 0;

      for (const memory of archiveData.memories) {
        db.run(
          `INSERT OR IGNORE INTO episodic_memory 
           (id, project_fingerprint, timestamp, task_type, summary, entities, decision, outcome, final_weight, model_id, latency_ms, memory_tier)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            memory.id,
            memory.project_fingerprint,
            memory.timestamp,
            memory.task_type,
            memory.summary,
            memory.entities,
            memory.decision,
            memory.outcome,
            memory.final_weight,
            memory.model_id,
            memory.latency_ms,
            memory.memory_tier || 'LONG_TERM'
          ]
        );
        restoredCount++;
      }

      console.log(`[MemoryArchiver] Restored ${restoredCount} memories from ${archiveFilePath}`);
      return restoredCount;
    } catch (error) {
      console.error('[MemoryArchiver] Restore failed:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ArchivalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ArchivalConfig {
    return { ...this.config };
  }
}
