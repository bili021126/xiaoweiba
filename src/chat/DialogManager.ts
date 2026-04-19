import { ChatMessage } from './types';

/**
 * 对话状态枚举
 */
export type DialogState = 
  | 'IDLE'           // 空闲状态
  | 'CLARIFYING'     // 澄清中
  | 'EXECUTING'      // 执行中
  | 'WAITING_INPUT'  // 等待用户输入
  | 'COMPLETED';     // 完成

/**
 * 交互模式枚举
 */
export type InteractionMode = 
  | 'QUICK'          // 快速模式：直接执行
  | 'DEEP'           // 深度模式：多轮澄清
  | 'COACH'          // 教练模式：引导式对话
  | 'AUTO';          // 自动模式：根据复杂度选择

/**
 * 澄清问题
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  options?: string[];  // 可选的预设选项
  required: boolean;   // 是否必须回答
}

/**
 * 对话上下文
 */
export interface DialogContext {
  state: DialogState;
  mode: InteractionMode;
  currentTask?: string;
  clarificationQuestions: ClarificationQuestion[];
  userResponses: Map<string, string>;
  history: ChatMessage[];
  metadata?: Record<string, any>;
}

/**
 * 对话管理器
 * 
 * 负责管理多轮对话的状态、澄清流程和交互模式切换
 */
export class DialogManager {
  private context: DialogContext;
  private readonly MAX_HISTORY = 20;

  constructor() {
    this.context = {
      state: 'IDLE',
      mode: 'AUTO',
      clarificationQuestions: [],
      userResponses: new Map(),
      history: []
    };
  }

  /**
   * 开始新对话
   */
  startDialog(userMessage: string, mode: InteractionMode = 'AUTO', preserveHistory: boolean = false): DialogContext {
    const existingHistory = preserveHistory ? this.context.history : [];
    
    this.context = {
      state: 'IDLE',
      mode,
      currentTask: this.extractTask(userMessage),
      clarificationQuestions: [],
      userResponses: new Map(),
      history: existingHistory,  // 可选保留历史
      metadata: {
        startTime: Date.now(),
        initialMessage: userMessage
      }
    };

    return this.context;
  }

  /**
   * 评估任务复杂度，决定是否需要澄清
   */
  assessComplexity(userMessage: string): {
    complexity: number;  // 0-1
    needsClarification: boolean;
    suggestedMode: InteractionMode;
  } {
    const length = userMessage.length;
    const hasAmbiguity = this.detectAmbiguity(userMessage);
    const isExploratory = this.isExploratoryQuery(userMessage);

    // 计算复杂度分数
    let complexity = 0;
    complexity += Math.min(length / 200, 0.3);  // 长度因素
    complexity += hasAmbiguity ? 0.4 : 0;        // 歧义因素
    complexity += isExploratory ? 0.3 : 0;       // 探索性因素

    const needsClarification = complexity > 0.5 || hasAmbiguity;
    
    // 根据复杂度建议模式
    let suggestedMode: InteractionMode = 'QUICK';
    if (complexity > 0.7) {
      suggestedMode = 'DEEP';
    } else if (isExploratory) {
      suggestedMode = 'COACH';
    } else if (complexity > 0.4) {
      suggestedMode = 'DEEP';
    }

    return {
      complexity,
      needsClarification,
      suggestedMode
    };
  }

  /**
   * 生成澄清问题
   */
  generateClarificationQuestions(
    userMessage: string,
    taskType: string
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    // 根据任务类型生成不同的澄清问题
    switch (taskType) {
      case 'CODE_EXPLAIN':
        questions.push({
          id: 'explanation_depth',
          question: '您希望解释的详细程度是？',
          options: ['简要概述', '详细说明', '深入原理'],
          required: false
        });
        break;

      case 'CODE_GENERATE':
        questions.push({
          id: 'generation_requirements',
          question: '请描述具体的功能需求或提供示例',
          required: true
        });
        questions.push({
          id: 'tech_stack',
          question: '有特定的技术栈要求吗？',
          options: ['React', 'Vue', 'Angular', '原生JS', '无特殊要求'],
          required: false
        });
        break;

      case 'COMMIT_GENERATE':
        questions.push({
          id: 'commit_scope',
          question: '这次提交主要涉及哪些方面？',
          options: ['功能新增', 'Bug修复', '重构优化', '文档更新'],
          required: false
        });
        break;

      case 'CODE_REFACTOR':
        questions.push({
          id: 'refactor_goal',
          question: '重构的主要目标是？',
          options: ['提升性能', '改善可读性', '增强可维护性', '修复代码异味'],
          required: true
        });
        break;
    }

    return questions;
  }

  /**
   * 处理用户响应
   */
  handleUserResponse(questionId: string, response: string): void {
    this.context.userResponses.set(questionId, response);
    
    // 检查是否所有必需问题都已回答
    const allRequiredAnswered = this.context.clarificationQuestions
      .filter(q => q.required)
      .every(q => this.context.userResponses.has(q.id));

    if (allRequiredAnswered) {
      this.context.state = 'EXECUTING';
    } else {
      this.context.state = 'CLARIFYING';
    }
  }

  /**
   * 获取下一个要问的问题
   */
  getNextQuestion(): ClarificationQuestion | null {
    const unanswered = this.context.clarificationQuestions.find(
      q => !this.context.userResponses.has(q.id)
    );
    return unanswered || null;
  }

  /**
   * 收集完整的上下文信息
   */
  collectFullContext(): {
    originalRequest: string;
    clarifications: Map<string, string>;
    mode: InteractionMode;
  } {
    return {
      originalRequest: this.context.metadata?.initialMessage || '',
      clarifications: new Map(this.context.userResponses),
      mode: this.context.mode
    };
  }

  /**
   * 添加消息到历史
   */
  addMessage(message: ChatMessage): void {
    this.context.history.push(message);
    
    // 限制历史记录数量
    if (this.context.history.length > this.MAX_HISTORY) {
      this.context.history = this.context.history.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * 切换交互模式
   */
  switchMode(mode: InteractionMode): void {
    this.context.mode = mode;
  }

  /**
   * 重置对话状态
   */
  reset(): void {
    this.context = {
      state: 'IDLE',
      mode: 'AUTO',
      clarificationQuestions: [],
      userResponses: new Map(),
      history: []
    };
  }

  /**
   * 获取当前上下文
   */
  getContext(): DialogContext {
    return { ...this.context };
  }

  // ========== 私有辅助方法 ==========

  /**
   * 提取任务类型
   */
  private extractTask(message: string): string {
    // 简单的关键词匹配，实际应该使用更复杂的NLP
    if (message.includes('解释') || message.includes('explain')) {
      return 'CODE_EXPLAIN';
    }
    if (message.includes('生成') || message.includes('create') || message.includes('write')) {
      return 'CODE_GENERATE';
    }
    if (message.includes('commit') || message.includes('提交')) {
      return 'COMMIT_GENERATE';
    }
    if (message.includes('重构') || message.includes('refactor')) {
      return 'CODE_REFACTOR';
    }
    return 'UNKNOWN';
  }

  /**
   * 检测歧义
   */
  private detectAmbiguity(message: string): boolean {
    const ambiguousWords = [
      '这个', '那个', '它', '它们',
      '帮我', '弄一下', '搞一下',
      '可能', '也许', '大概'
    ];
    
    return ambiguousWords.some(word => message.includes(word));
  }

  /**
   * 判断是否为探索性查询
   */
  private isExploratoryQuery(message: string): boolean {
    const exploratoryPatterns = [
      /怎么.*\?/,
      /如何.*\?/,
      /什么是.*/,
      /学习.*/,
      /了解.*/,
      /最佳实践/
    ];
    
    return exploratoryPatterns.some(pattern => pattern.test(message));
  }
}
