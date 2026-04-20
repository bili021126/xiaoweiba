import { injectable, inject } from 'tsyringe';
import { AuditLogger } from '../security/AuditLogger';
import { ExpertSelector } from './ExpertSelector';

/**
 * 反馈记录器 - 负责用户反馈收集和专家系统管理
 * 
 * 职责：
 * - 记录用户对检索结果的反馈
 * - 管理专家选择器状态
 * - 审计日志记录
 */
@injectable()
export class FeedbackRecorder {
  constructor(
    @inject(AuditLogger) private auditLogger: AuditLogger,
    private expertSelector: ExpertSelector
  ) {}

  /**
   * 记录用户反馈
   * @param query 原始查询
   * @param clickedMemoryId 用户点击的记忆ID
   */
  public recordFeedback(query: string, clickedMemoryId: string): void {
    try {
      // 记录审计日志
      this.auditLogger.log('feedback_record', 'success', 0, {
        parameters: { query, clickedMemoryId }
      }).catch(err => {
        // 反馈记录失败，静默处理
      });
      
      console.log(`[FeedbackRecorder] Feedback recorded for query: "${query}" -> ${clickedMemoryId}`);
    } catch (error) {
      console.error('[FeedbackRecorder] Failed to record feedback:', error);
    }
  }

  /**
   * 重置专家系统
   */
  public resetExpert(): void {
    try {
      this.expertSelector.reset();
      
      // 记录审计日志
      this.auditLogger.log('expert_reset', 'success', 0, {}).catch(err => {
        // 专家重置日志记录失败，静默处理
      });
      
      console.log('[FeedbackRecorder] Expert system reset');
    } catch (error) {
      console.error('[FeedbackRecorder] Failed to reset expert:', error);
    }
  }

  /**
   * 获取专家选择器实例（用于外部访问）
   */
  public getExpertSelector(): ExpertSelector {
    return this.expertSelector;
  }
}
