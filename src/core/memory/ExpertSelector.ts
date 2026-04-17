import { EXPERT_WEIGHTS, FeedbackRecord, ExpertState, RetrievalWeights, IntentVector } from './types';
import * as vscode from 'vscode';

const DEFAULT_WEIGHTS: RetrievalWeights = { k: 0.30, t: 0.20, e: 0.20, v: 0.30 };

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
   */
  recordFeedback(intent: IntentVector, clickedWeights: RetrievalWeights): void {
    this.feedbackHistory.push({
      intent,
      clickedWeights,
      timestamp: Date.now()
    });

    // 限制历史记录长度
    if (this.feedbackHistory.length > this.MAX_HISTORY) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.MAX_HISTORY);
    }

    // 防抖：积累反馈后延迟更新权重
    this.scheduleWeightUpdate();
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
      // 从workspaceState读取当前权重
      const currentWeights = this.context.workspaceState.get<RetrievalWeights>(this.STORAGE_KEY) || DEFAULT_WEIGHTS;
      const lr = 0.1; // 学习率
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

      // 梯度更新
      for (const factor of ['k', 't', 'e', 'v'] as const) {
        let newWeight = currentWeights[factor] + lr * (avgClicked[factor] - 0.25); // 期望均匀贡献0.25
        newWeight = Math.max(0.05, Math.min(0.7, newWeight)); // 限制范围
        newWeights[factor] = newWeight;
        total += newWeight;
      }

      // 归一化确保总和为1
      for (const factor of ['k', 't', 'e', 'v'] as const) {
        newWeights[factor]! /= total;
      }

      // 保存到workspaceState
      await this.context.workspaceState.update(this.STORAGE_KEY, newWeights);
      console.log('[ExpertSelector] Weights updated:', newWeights);
    } catch (error) {
      console.error('[ExpertSelector] Failed to update weights:', error);
    }
  }

  /**
   * 根据历史反馈选择最匹配的专家权重（元学习）
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
