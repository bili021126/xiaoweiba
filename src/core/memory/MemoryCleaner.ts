/**
 * 记忆清理器 - 负责记忆的过期清理和层级迁移
 * 
 * 职责：
 * 1. 清理过期记忆（SHORT_TERM > 7天）
 * 2. 迁移短期记忆到长期记忆
 * 3. 维护记忆健康度
 */

import { DatabaseManager } from '../../storage/DatabaseManager';
import { AuditLogger } from '../security/AuditLogger';

export class MemoryCleaner {
  constructor(
    private dbManager: DatabaseManager,
    private auditLogger: AuditLogger
  ) {}

  /**
   * 清理过期记忆
   * @param projectFingerprint 项目指纹
   * @returns 清理的记忆数量
   */
  async cleanupExpired(projectFingerprint: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      // SHORT_TERM记忆超过7天自动清理
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      this.dbManager.run(
        'DELETE FROM episodic_memory WHERE project_fingerprint = ? AND memory_tier = ? AND timestamp < ?',
        [projectFingerprint, 'SHORT_TERM', sevenDaysAgo]
      );
      
      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_cleanup', 'success', duration, {
        parameters: { projectFingerprint, cutoffTimestamp: sevenDaysAgo }
      });
      
      console.log(`[MemoryCleaner] Expired memories cleaned for ${projectFingerprint}`);
      return 0; // sql.js无法直接获取删除行数，返回0
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_cleanup', error as Error, duration);
      throw error;
    }
  }

  /**
   * 迁移短期记忆到长期记忆
   * @param projectFingerprint 项目指纹
   * @returns 迁移的记忆数量
   */
  async migrateShortToLongTerm(projectFingerprint: string): Promise<number> {
    const startTime = Date.now();
    
    try {
      // SHORT_TERM记忆存在超过7天且finalWeight >= 7.0的迁移到LONG_TERM
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      this.dbManager.run(
        `UPDATE episodic_memory 
         SET memory_tier = 'LONG_TERM' 
         WHERE project_fingerprint = ? 
           AND memory_tier = 'SHORT_TERM' 
           AND timestamp < ? 
           AND final_weight >= 7.0`,
        [projectFingerprint, sevenDaysAgo]
      );
      
      const duration = Date.now() - startTime;
      await this.auditLogger.log('memory_migrate', 'success', duration, {
        parameters: { projectFingerprint, cutoffTimestamp: sevenDaysAgo }
      });
      
      console.log(`[MemoryCleaner] Memories migrated to LONG_TERM for ${projectFingerprint}`);
      return 0; // sql.js无法直接获取更新行数
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logError('memory_migrate', error as Error, duration);
      throw error;
    }
  }

  /**
   * 获取记忆统计信息
   * @param projectFingerprint 项目指纹
   * @returns 统计信息
   */
  async getStats(projectFingerprint: string): Promise<{
    total: number;
    shortTerm: number;
    longTerm: number;
    byTaskType: Record<string, number>;
  }> {
    const db = this.dbManager.getDatabase();
    
    // 总数
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ?');
    totalStmt.bind([projectFingerprint]);
    totalStmt.step();
    const total = (totalStmt.get()[0] as number) || 0;
    totalStmt.free();
    
    // 短期记忆数
    const shortTermStmt = db.prepare('SELECT COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? AND memory_tier = ?');
    shortTermStmt.bind([projectFingerprint, 'SHORT_TERM']);
    shortTermStmt.step();
    const shortTerm = (shortTermStmt.get()[0] as number) || 0;
    shortTermStmt.free();
    
    // 长期记忆数
    const longTermStmt = db.prepare('SELECT COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? AND memory_tier = ?');
    longTermStmt.bind([projectFingerprint, 'LONG_TERM']);
    longTermStmt.step();
    const longTerm = (longTermStmt.get()[0] as number) || 0;
    longTermStmt.free();
    
    // 按任务类型统计
    const taskTypeStmt = db.prepare('SELECT task_type, COUNT(*) as count FROM episodic_memory WHERE project_fingerprint = ? GROUP BY task_type');
    taskTypeStmt.bind([projectFingerprint]);
    
    const byTaskType: Record<string, number> = {};
    while (taskTypeStmt.step()) {
      const row = taskTypeStmt.get();
      byTaskType[row[0] as string] = row[1] as number;
    }
    taskTypeStmt.free();
    
    return { total, shortTerm, longTerm, byTaskType };
  }
}
