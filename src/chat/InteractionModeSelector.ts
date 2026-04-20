import { InteractionMode } from './DialogManager';
import { ConfigManager } from '../storage/ConfigManager';
import * as vscode from 'vscode';
import { LENGTH_LIMITS, CONFIDENCE_THRESHOLDS } from '../constants';

/**
 * 用户偏好配置
 */
export interface UserPreference {
  defaultMode: InteractionMode;
  enableClarification: boolean;
  maxClarificationRounds: number;
  preferConcise: boolean;
}

/**
 * 交互模式选择器
 * 
 * 根据任务类型、用户偏好和历史行为智能选择交互模式
 */
export class InteractionModeSelector {
  private userPreference: UserPreference;
  private modeHistory: Array<{
    taskType: string;
    selectedMode: InteractionMode;
    userSatisfaction?: number;  // 1-5评分
    timestamp: number;
  }> = [];
  private readonly STORAGE_KEY = 'interactionModePreference';

  constructor(
    private configManager: ConfigManager,
    private context?: vscode.ExtensionContext
  ) {
    this.userPreference = this.loadUserPreference();
  }

  /**
   * 选择最佳交互模式
   */
  selectMode(
    taskType: string,
    messageComplexity: number,
    hasAmbiguity: boolean,
    isExploratory: boolean
  ): InteractionMode {
    // 如果用户有明确的默认偏好，优先使用
    if (this.userPreference.defaultMode !== 'AUTO') {
      return this.userPreference.defaultMode;
    }

    // 基于规则的模式选择
    const mode = this.selectByRules(taskType, messageComplexity, hasAmbiguity, isExploratory);
    
    // 记录选择历史
    this.recordSelection(taskType, mode);
    
    return mode;
  }

  /**
   * 记录用户对模式的反馈（隐式）
   */
  recordFeedback(
    taskType: string,
    usedMode: InteractionMode,
    satisfaction: number  // 1-5，基于用户是否追问、是否满意等推断
  ): void {
    const lastRecord = this.modeHistory[this.modeHistory.length - 1];
    if (lastRecord && lastRecord.selectedMode === usedMode) {
      lastRecord.userSatisfaction = satisfaction;
    }

    // 如果满意度低，调整偏好
    if (satisfaction < 3) {
      this.adjustPreference(usedMode);
    }

    // 保存历史记录（保留最近100条）
    // 限制历史记录长度
    if (this.modeHistory.length > LENGTH_LIMITS.MAX_MODE_HISTORY) {
      this.modeHistory = this.modeHistory.slice(-LENGTH_LIMITS.MAX_MODE_HISTORY);
    }
  }

  /**
   * 获取推荐的澄清轮数
   */
  getMaxClarificationRounds(mode: InteractionMode): number {
    switch (mode) {
      case 'QUICK':
        return 0;
      case 'DEEP':
        return this.userPreference.maxClarificationRounds || 3;
      case 'COACH':
        return 5;  // 教练模式允许更多轮次
      case 'AUTO':
        return 2;
      default:
        return 2;
    }
  }

  /**
   * 判断是否应该启用澄清
   */
  shouldEnableClarification(
    mode: InteractionMode,
    hasAmbiguity: boolean
  ): boolean {
    if (!this.userPreference.enableClarification) {
      return false;
    }

    if (mode === 'QUICK') {
      return false;
    }

    if (mode === 'DEEP' || mode === 'COACH') {
      return true;
    }

    // AUTO模式下，仅在存在歧义时澄清
    return hasAmbiguity;
  }

  /**
   * 更新用户偏好
   */
  updatePreference(preference: Partial<UserPreference>): void {
    this.userPreference = { ...this.userPreference, ...preference };
    this.saveUserPreference();
  }

  /**
   * 获取当前偏好
   */
  getPreference(): UserPreference {
    return { ...this.userPreference };
  }

  // ========== 私有方法 ==========

  /**
   * 基于规则选择模式
   */
  private selectByRules(
    taskType: string,
    complexity: number,
    hasAmbiguity: boolean,
    isExploratory: boolean
  ): InteractionMode {
    // 探索性查询 -> 教练模式
    if (isExploratory) {
      return 'COACH';
    }

    // 高复杂度或存在歧义 -> 深度模式
    // 高复杂度或歧义建议使用深度模式
    if (complexity > CONFIDENCE_THRESHOLDS.DEEP_MODE_COMPLEXITY || hasAmbiguity) {
      return 'DEEP';
    }

    // 中等复杂度 -> 深度模式
    if (complexity > 0.4) {
      return 'DEEP';
    }

    // 简单任务 -> 快速模式
    return 'QUICK';
  }

  /**
   * 记录模式选择
   */
  private recordSelection(taskType: string, mode: InteractionMode): void {
    this.modeHistory.push({
      taskType,
      selectedMode: mode,
      timestamp: Date.now()
    });
  }

  /**
   * 根据反馈调整偏好
   */
  private adjustPreference(unsuccessfulMode: InteractionMode): void {
    // 如果某个模式多次失败，降低其优先级
    const failureCount = this.modeHistory.filter(
      h => h.selectedMode === unsuccessfulMode && (h.userSatisfaction || 0) < 3
    ).length;

    if (failureCount > 3) {
      // 切换到更保守的模式
      if (unsuccessfulMode === 'QUICK') {
        this.userPreference.defaultMode = 'DEEP';
      } else if (unsuccessfulMode === 'DEEP') {
        this.userPreference.defaultMode = 'COACH';
      }
      
      this.saveUserPreference();
    }
  }

  /**
   * 加载用户偏好
   */
  private loadUserPreference(): UserPreference {
    // 1. 尝试从workspaceState加载
    if (this.context) {
      const stored = this.context.workspaceState.get<UserPreference>(this.STORAGE_KEY);
      if (stored) {
        return stored;
      }
    }
    
    // 2. 从配置文件加载
    try {
      const config = this.configManager.getConfig();
      return {
        defaultMode: (config.chat?.defaultInteractionMode as InteractionMode) || 'AUTO',
        enableClarification: config.chat?.enableClarification ?? true,
        maxClarificationRounds: config.chat?.maxClarificationRounds || 3,
        preferConcise: config.chat?.preferConcise ?? false
      };
    } catch (error) {
      // 使用默认配置，静默失败
      return {
        defaultMode: 'AUTO',
        enableClarification: true,
        maxClarificationRounds: 3,
        preferConcise: false
      };
    }
  }

  /**
   * 保存用户偏好
   */
  private saveUserPreference(): void {
    try {
      // 保存到workspaceState（如果context可用）
      if (this.context) {
        this.context.workspaceState.update(this.STORAGE_KEY, this.userPreference);
      }
    } catch (error) {
      // 保存失败静默处理，不影响主流程
    }
  }
}
