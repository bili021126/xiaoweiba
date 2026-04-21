/**
 * 反馈记录器 - 负责处理用户反馈并调整检索权重
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道反馈处理的细节
 * - 所有反馈记录和权重调整逻辑集中在此
 */

import { injectable, inject } from 'tsyringe';
import { IntentAnalyzer } from '../memory/IntentAnalyzer';
import { ExpertSelector } from '../memory/ExpertSelector';
import { ProjectFingerprint } from '../../utils/ProjectFingerprint';
import { DatabaseManager } from '../../storage/DatabaseManager';

@injectable()
export class FeedbackRecorder {
  private readonly intentAnalyzer = new IntentAnalyzer();
  private readonly expertSelector = new ExpertSelector();

  constructor(
    @inject(ProjectFingerprint) private projectFingerprint: ProjectFingerprint,
    @inject(DatabaseManager) private dbManager: DatabaseManager
  ) {}

  /**
   * 记录用户点击反馈
   */
  async recordClickFeedback(
    query: string,
    clickedMemoryId: string,
    dwellTimeMs: number
  ): Promise<void> {
    try {
      // 1. 从query提取意图向量
      const intentVector = this.intentAnalyzer.analyze(query);
      
      // 2. 获取基础权重配置（ExpertSelector会基于多次反馈自动调整）
      //    注意：不使用clickedMemoryId对应的历史权重，避免冷启动问题
      const clickedWeights = this.expertSelector.getBaseWeights();
      
      // 3. 记录到ExpertSelector（用于动态调整检索权重）
      this.expertSelector.recordFeedback(intentVector, clickedWeights, query, dwellTimeMs);
      
      // 4. 持久化到数据库（用于后续分析和回溯）
      const projectFingerprint = await this.projectFingerprint.getCurrentProjectFingerprint();
      const db = this.dbManager.getDatabase();
      
      db.run(
        `INSERT INTO feedback_records (
          id, project_fingerprint, query, clicked_memory_id, 
          dwell_time_ms, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectFingerprint,
          query,
          clickedMemoryId,
          dwellTimeMs,
          Date.now()
        ]
      );
      
      console.log(`[FeedbackRecorder] Recorded click feedback for memory: ${clickedMemoryId}`);
    } catch (error) {
      console.error('[FeedbackRecorder] recordClickFeedback failed:', error);
      // 静默失败，不影响主流程
    }
  }

  /**
   * 获取专家选择器实例（用于外部访问）
   */
  getExpertSelector(): ExpertSelector {
    return this.expertSelector;
  }
}
