import { EXPERT_WEIGHTS, FeedbackRecord, ExpertState, RetrievalWeights, IntentVector } from './types';
import * as vscode from 'vscode';

const DEFAULT_WEIGHTS: RetrievalWeights = { k: 0.30, t: 0.20, e: 0.20, v: 0.30 };

/**
 * 反馈验证结果
 */
interface FeedbackValidation {
  isValid: boolean;
  reason?: string;
}

/**
 * 权重快照（用于回滚）
 */
interface WeightSnapshot {
  weights: RetrievalWeights;
  timestamp: number;
  feedbackCount: number;
}

/**
 * 专家权重选择器 - 根据用户历史反馈，动态选择最优的检索权重配置
 * 
 * 支持基于反馈的元学习，自动调整到最适合用户习惯的专家权重
 */
export class ExpertSelector {
  private feedbackHistory: FeedbackRecord[] = [];
  private currentExpert: string = 'balanced';
  private readonly MAX_HISTORY = 100; // 最多保留100条反馈记录
  private context?: vscode.ExtensionContext;
  private weightUpdateTimer?: NodeJS.Timeout;
  private readonly STORAGE_KEY = 'xiaoweiba.retrievalWeights';
  private readonly SNAPSHOTS_KEY = 'xiaoweiba.weightSnapshots';
  
  // ========== 局部限制 ==========
  // 限制1: 权重边界
  private readonly MIN_WEIGHT = 0.05;
  private readonly MAX_WEIGHT = 0.70;
  
  // 限制2: 反馈有效性跟踪
  private lastClickTime: Map<string, number> = new Map(); // query -> timestamp
  private readonly CLICK_DEBOUNCE_MS = 30 * 60 * 1000; // 30分钟去重
  private readonly MIN_DWELL_TIME_MS = 2000; // 最小停留时间2秒
  
  // 限制3: 学习率衰减
  private baseLearningRate = 0.1;
  private currentLearningRate = 0.1;
  private totalFeedbackCount = 0;
  private readonly LR_DECAY_INTERVAL = 10; // 每10次反馈衰减
  private readonly LR_DECAY_FACTOR = 0.9;
  
  // 深化点3: 权重归一化跟踪
  private lastNormalizationTime: number = Date.now();
  private readonly NORMALIZATION_INTERVAL = 24 * 3600 * 1000; // 24小时
  
  // 深化点5: 自适应学习率
  private adaptiveLearningRates: { k: number; t: number; e: number; v: number } = {
    k: 0.1, t: 0.1, e: 0.1, v: 0.1
  };
  private lastFeedbackDirection: { k: number; t: number; e: number; v: number } | null = null;
  
  // ========== 全局护栏 ==========
  // 准入控制
  private readonly MIN_FEEDBACK_THRESHOLD = 20; // 最小反馈量
  private readonly INTENT_DOMINANCE_THRESHOLD = 0.8; // 意图分布均衡阈值
  
  // 运行时监控
  private readonly WEIGHT_DRIFT_THRESHOLD = 0.2; // 24小时权重变化阈值
  private lastWeightCheck: RetrievalWeights | null = null;
  private lastWeightCheckTime: number = Date.now();
  
  // 点击率滑动窗口
  private recentRetrievals: Array<{ clicked: boolean; timestamp: number }> = [];
  private readonly RETRIEVAL_WINDOW_SIZE = 50;
  private readonly CTR_DROP_THRESHOLD = 0.10; // 点击率下降10%
  
  // 回滚与熔断
  private readonly MAX_SNAPSHOTS = 5;
  private consecutiveAnomalies = 0;
  private readonly MAX_CONSECUTIVE_ANOMALIES = 3;

  /**
   * 设置ExtensionContext（用于持久化权重）
   */
  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  /**
   * 记录一次点击反馈
   * @param intent 查询时的意图向量
   * @param clickedWeights 用户实际点击结果的权重配置
   * @param query 原始查询文本（用于去重）
   * @param dwellTimeMs 停留时间（毫秒）
   */
  recordFeedback(
    intent: IntentVector,
    clickedWeights: RetrievalWeights,
    query?: string,
    dwellTimeMs?: number
  ): void {
    // 限制2: 反馈有效性验证
    const validation = this.validateFeedback(query, dwellTimeMs);
    if (!validation.isValid) {
      console.debug(`[ExpertSelector] Feedback rejected: ${validation.reason}`);
      return;
    }

    this.feedbackHistory.push({
      intent,
      clickedWeights,
      timestamp: Date.now()
    });

    // 限制历史记录长度
    if (this.feedbackHistory.length > this.MAX_HISTORY) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.MAX_HISTORY);
    }

    // 全局护栏: 准入控制 - 最小反馈量
    if (this.feedbackHistory.length < this.MIN_FEEDBACK_THRESHOLD) {
      console.debug(`[ExpertSelector] Accumulating feedback: ${this.feedbackHistory.length}/${this.MIN_FEEDBACK_THRESHOLD}`);
      return;
    }

    // 全局护栏: 准入控制 - 意图分布均衡检查
    if (!this.checkIntentDistribution()) {
      console.warn('[ExpertSelector] Intent distribution imbalanced, skipping update');
      return;
    }

    // 防抖：积累反馈后延迟更新权重
    this.scheduleWeightUpdate();
  }

  /**
   * 验证反馈有效性
   */
  private validateFeedback(query?: string, dwellTimeMs?: number): FeedbackValidation {
    // 停留时间校验
    if (dwellTimeMs !== undefined && dwellTimeMs < this.MIN_DWELL_TIME_MS) {
      return { isValid: false, reason: `Dwell time too short: ${dwellTimeMs}ms < ${this.MIN_DWELL_TIME_MS}ms` };
    }

    // 30分钟去重
    if (query) {
      const lastClick = this.lastClickTime.get(query);
      const now = Date.now();
      if (lastClick && (now - lastClick) < this.CLICK_DEBOUNCE_MS) {
        return { isValid: false, reason: 'Duplicate click within 30 minutes' };
      }
      this.lastClickTime.set(query, now);
    }

    return { isValid: true };
  }

  /**
   * 检查意图分布均衡性
   */
  private checkIntentDistribution(): boolean {
    if (this.feedbackHistory.length < 10) return true; // 样本太少不检查

    // 统计最近20条反馈的意图主导类型
    const recentFeedback = this.feedbackHistory.slice(-20);
    const dominantCounts: Record<string, number> = { temporal: 0, entity: 0, semantic: 0, balanced: 0 };

    for (const fb of recentFeedback) {
      const maxVal = Math.max(fb.intent.temporal, fb.intent.entity, fb.intent.semantic);
      if (maxVal === fb.intent.temporal && fb.intent.temporal > 0.5) {
        dominantCounts.temporal++;
      } else if (maxVal === fb.intent.entity && fb.intent.entity > 0.5) {
        dominantCounts.entity++;
      } else if (maxVal === fb.intent.semantic && fb.intent.semantic > 0.5) {
        dominantCounts.semantic++;
      } else {
        dominantCounts.balanced++;
      }
    }

    // 检查是否有单一意图占比超过80%
    const total = recentFeedback.length;
    for (const count of Object.values(dominantCounts)) {
      if (count / total > this.INTENT_DOMINANCE_THRESHOLD) {
        console.warn(`[ExpertSelector] Intent dominance detected: ${count}/${total} (${(count/total*100).toFixed(1)}%)`);
        return false;
      }
    }

    return true;
  }

  /**
   * 调度权重更新（防抖）
   */
  private scheduleWeightUpdate(): void {
    if (this.weightUpdateTimer) clearTimeout(this.weightUpdateTimer);
    // 积累5条反馈后更新一次权重
    if (this.feedbackHistory.length >= 5) {
      this.weightUpdateTimer = setTimeout(() => this.updateFactorWeights(), 3000);
    }
  }

  /**
   * 更新因子权重（在线学习）
   * 使用梯度下降逻辑：新权重 = 旧权重 + 学习率 * (实际贡献 - 期望贡献)
   */
  private async updateFactorWeights(): Promise<void> {
    if (!this.context || this.feedbackHistory.length === 0) return;
  
    try {
      // 全局护栏: 回滚与熔断 - 保存快照
      await this.saveSnapshot();

      // 从 workspaceState读取当前权重
      const currentWeights = this.context.workspaceState.get<RetrievalWeights>(this.STORAGE_KEY) || DEFAULT_WEIGHTS;
      let total = 0;
      const newWeights: Partial<RetrievalWeights> = {};
  
      // 计算平均点击权重作为“实际贡献”
      const avgClicked: RetrievalWeights = { k: 0, t: 0, e: 0, v: 0 };
      for (const fb of this.feedbackHistory.slice(-10)) { // 使用最近10条
        avgClicked.k += fb.clickedWeights.k;
        avgClicked.t += fb.clickedWeights.t;
        avgClicked.e += fb.clickedWeights.e;
        avgClicked.v += fb.clickedWeights.v;
      }
      const count = Math.min(this.feedbackHistory.length, 10);
      avgClicked.k /= count;
      avgClicked.t /= count;
      avgClicked.e /= count;
      avgClicked.v /= count;
  
      // 深化点5: 自适应学习率调整
      const currentDirection = { k: avgClicked.k - 0.25, t: avgClicked.t - 0.25, e: avgClicked.e - 0.25, v: avgClicked.v - 0.25 };
      if (this.lastFeedbackDirection) {
        for (const factor of ['k', 't', 'e', 'v'] as const) {
          const sameDirection = (currentDirection[factor] * this.lastFeedbackDirection![factor]) > 0;
          if (sameDirection) {
            // 方向一致，降低学习率（防止过冲）
            this.adaptiveLearningRates[factor] *= 0.8;
          } else {
            // 方向变化，恢复学习率（加速收敛）
            this.adaptiveLearningRates[factor] = 0.1;
          }
          this.adaptiveLearningRates[factor] = Math.max(0.01, Math.min(0.2, this.adaptiveLearningRates[factor]));
        }
      }
      this.lastFeedbackDirection = currentDirection;
  
      // 限制3: 学习率衰减（每10次反馈*0.9）
      this.totalFeedbackCount++;
      if (this.totalFeedbackCount % this.LR_DECAY_INTERVAL === 0) {
        this.currentLearningRate *= this.LR_DECAY_FACTOR;
        console.log(`[ExpertSelector] Learning rate decayed to ${this.currentLearningRate.toFixed(4)}`);
      }

      // 梯度更新（使用自适应学习率）
      for (const factor of ['k', 't', 'e', 'v'] as const) {
        let newWeight = currentWeights[factor] + this.adaptiveLearningRates[factor] * (avgClicked[factor] - 0.25);
        // 限制1: 权重边界硬截断
        newWeight = Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, newWeight));
        newWeights[factor] = newWeight;
        total += newWeight;
      }
  
      // 深化点3: 带平滑因子的归一化
      const now = Date.now();
      const timeSinceLastNorm = now - this.lastNormalizationTime;
      const needsRenormalization = timeSinceLastNorm > this.NORMALIZATION_INTERVAL;
        
      if (needsRenormalization) {
        // 定期归一化，加入平滑因子防止权重僵化
        const smoothingFactor = 0.1; // 10%平滑
        for (const factor of ['k', 't', 'e', 'v'] as const) {
          newWeights[factor]! = (1 - smoothingFactor) * (newWeights[factor]! / total) + smoothingFactor * 0.25;
        }
        this.lastNormalizationTime = now;
        console.log('[ExpertSelector] Periodic renormalization with smoothing');
      } else {
        // 常规归一化
        for (const factor of ['k', 't', 'e', 'v'] as const) {
          newWeights[factor]! /= total;
        }
      }

      // 全局护栏: 运行时监控 - 权重漂移检查
      this.checkWeightDrift(newWeights as RetrievalWeights);

      // 保存到workspaceState
      await this.context.workspaceState.update(this.STORAGE_KEY, newWeights);
      console.log('[ExpertSelector] Weights updated:', newWeights, '(learning rates:', this.adaptiveLearningRates, ')');

      // 重置异常计数
      this.consecutiveAnomalies = 0;
    } catch (error) {
      console.error('[ExpertSelector] Failed to update weights:', error);
      // 全局护栏: 回滚与熔断 - 连续异常检测
      this.consecutiveAnomalies++;
      if (this.consecutiveAnomalies >= this.MAX_CONSECUTIVE_ANOMALIES) {
        console.warn('[ExpertSelector] Consecutive anomalies detected, rolling back...');
        await this.rollbackToLastStable();
      }
    }
  }

  /**
   * 保存权重快照（用于回滚）
   */
  private async saveSnapshot(): Promise<void> {
    if (!this.context) return;

    try {
      const currentWeights = this.context.workspaceState.get<RetrievalWeights>(this.STORAGE_KEY) || DEFAULT_WEIGHTS;
      const snapshots = this.context.workspaceState.get<WeightSnapshot[]>(this.SNAPSHOTS_KEY) || [];

      // 添加新快照
      snapshots.push({
        weights: { ...currentWeights },
        timestamp: Date.now(),
        feedbackCount: this.feedbackHistory.length
      });

      // 保留最近5个快照
      if (snapshots.length > this.MAX_SNAPSHOTS) {
        snapshots.shift();
      }

      await this.context.workspaceState.update(this.SNAPSHOTS_KEY, snapshots);
      console.log(`[ExpertSelector] Snapshot saved (${snapshots.length} total)`);
    } catch (error) {
      console.error('[ExpertSelector] Failed to save snapshot:', error);
    }
  }

  /**
   * 检查权重漂移
   */
  private checkWeightDrift(newWeights: RetrievalWeights): void {
    if (!this.lastWeightCheck) {
      this.lastWeightCheck = { ...newWeights };
      this.lastWeightCheckTime = Date.now();
      return;
    }

    const now = Date.now();
    const hoursSinceLastCheck = (now - this.lastWeightCheckTime) / (3600 * 1000);

    // 24小时内检查
    if (hoursSinceLastCheck < 24) return;

    // 检查任意因子变化是否超过阈值
    let maxDrift = 0;
    for (const factor of ['k', 't', 'e', 'v'] as const) {
      const drift = Math.abs(newWeights[factor] - this.lastWeightCheck![factor]);
      maxDrift = Math.max(maxDrift, drift);
    }

    if (maxDrift > this.WEIGHT_DRIFT_THRESHOLD) {
      console.warn(`[ExpertSelector] Weight drift detected: ${maxDrift.toFixed(3)} in 24h`);
    }

    // 更新检查点
    this.lastWeightCheck = { ...newWeights };
    this.lastWeightCheckTime = now;
  }

  /**
   * 回滚到上一个稳定快照
   */
  private async rollbackToLastStable(): Promise<void> {
    if (!this.context) return;

    try {
      const snapshots = this.context.workspaceState.get<WeightSnapshot[]>(this.SNAPSHOTS_KEY) || [];
      if (snapshots.length === 0) {
        console.warn('[ExpertSelector] No snapshots available for rollback');
        return;
      }

      // 使用倒数第二个快照（最后一个是异常前的）
      const stableSnapshot = snapshots[snapshots.length - 2] || snapshots[0];
      await this.context.workspaceState.update(this.STORAGE_KEY, stableSnapshot.weights);

      console.log('[ExpertSelector] Rolled back to snapshot:', stableSnapshot);

      // 重置状态
      this.consecutiveAnomalies = 0;
      this.feedbackHistory = [];
    } catch (error) {
      console.error('[ExpertSelector] Rollback failed:', error);
    }
  }

  /**
   * 手动重置专家权重（提供命令调用）
   */
  async resetToDefault(): Promise<void> {
    if (!this.context) return;

    await this.context.workspaceState.update(this.STORAGE_KEY, DEFAULT_WEIGHTS);
    this.feedbackHistory = [];
    this.currentLearningRate = this.baseLearningRate;
    this.totalFeedbackCount = 0;
    this.consecutiveAnomalies = 0;

    console.log('[ExpertSelector] Reset to default weights');
  }

  /**
   * 根据历史反馈选择最匹配的专家权重（元学习）
   * 
   * @deprecated 此方法已废弃，完全依赖在线学习权重更新（updateFactorWeights）
   * 保留仅用于向后兼容，不再被调用
   */
  private updateBestExpert(): void {
    if (this.feedbackHistory.length === 0) return;

    const scores: Record<string, number> = {};
    
    // 初始化所有专家的得分
    for (const expName of Object.keys(EXPERT_WEIGHTS)) {
      scores[expName] = 0;
    }

    // 计算每个专家的平均匹配度
    for (const fb of this.feedbackHistory) {
      for (const [expName, expWeight] of Object.entries(EXPERT_WEIGHTS)) {
        // 匹配度：将意图向量和权重向量映射到同一空间计算余弦相似度
        const intentVec = fb.intent;
        const weightVec = { 
          t: expWeight.t,  // temporal
          e: expWeight.e,  // entity
          v: expWeight.v   // semantic/vector
        };

        // 点积
        const dot = intentVec.temporal * weightVec.t + 
                    intentVec.entity * weightVec.e + 
                    intentVec.semantic * weightVec.v;

        // 范数
        const normIntent = Math.hypot(intentVec.temporal, intentVec.entity, intentVec.semantic);
        const normWeight = Math.hypot(weightVec.t, weightVec.e, weightVec.v);

        // 余弦相似度
        const sim = dot / (normIntent * normWeight + 1e-8);
        scores[expName] += sim;
      }
    }

    // 选择得分最高的专家
    let best = 'balanced';
    let bestScore = -Infinity;

    for (const [exp, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = exp;
      }
    }

    if (best !== this.currentExpert) {
      console.log(`[ExpertSelector] Switched expert: ${this.currentExpert} → ${best} (score: ${bestScore.toFixed(2)})`);
      this.currentExpert = best;
    }
  }

  /**
   * 获取当前专家名称
   */
  getCurrentExpert(): string {
    return this.currentExpert;
  }

  /**
   * 获取当前专家的基础权重
   */
  getBaseWeights(): RetrievalWeights {
    return EXPERT_WEIGHTS[this.currentExpert] || EXPERT_WEIGHTS.balanced;
  }

  /**
   * 重置专家选择（用于命令 xiaoweiba.reset-expert）
   */
  reset(): void {
    this.currentExpert = 'balanced';
    this.feedbackHistory = [];
    console.log('[ExpertSelector] Expert state reset to balanced');
  }

  /**
   * 从持久化状态恢复
   */
  restore(state: ExpertState): void {
    if (state.currentExpert && EXPERT_WEIGHTS[state.currentExpert]) {
      this.currentExpert = state.currentExpert;
    }
    if (state.feedbackHistory && Array.isArray(state.feedbackHistory)) {
      this.feedbackHistory = state.feedbackHistory.slice(-this.MAX_HISTORY);
    }
    console.log(`[ExpertSelector] Restored expert: ${this.currentExpert}, history: ${this.feedbackHistory.length} records`);
  }

  /**
   * 获取可持久化的状态
   */
  getState(): ExpertState {
    return {
      currentExpert: this.currentExpert,
      feedbackHistory: this.feedbackHistory.slice(-50) // 只保存最近50条
    };
  }
}
