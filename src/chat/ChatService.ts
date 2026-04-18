import { ChatMessage } from './SessionManager';
import { SessionManager } from './SessionManager';
import { ContextBuilder } from './ContextBuilder';
import { PromptEngine } from './PromptEngine';
import { LLMTool } from '../tools/LLMTool';
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';
import { ConfigManager } from '../storage/ConfigManager';
import { AuditLogger } from '../core/security/AuditLogger';
import { DialogManager, InteractionMode } from './DialogManager';
import { InteractionModeSelector } from './InteractionModeSelector';
import { MemorySystem } from '../core/memory/MemorySystem';
import * as vscode from 'vscode';

/**
 * 聊天服务层
 * 
 * 封装所有聊天相关的业务逻辑，实现与UI层的解耦
 * 遵循单一职责原则：只处理业务逻辑，不关心Webview细节
 */
export class ChatService {
  private sessionManager: SessionManager;
  private contextBuilder: ContextBuilder;
  private promptEngine: PromptEngine;
  private dialogManager: DialogManager;
  private modeSelector: InteractionModeSelector;

  constructor(
    private context: vscode.ExtensionContext,
    private llmTool: LLMTool,
    private episodicMemory: EpisodicMemory,
    private preferenceMemory: PreferenceMemory,
    private configManager: ConfigManager,
    private auditLogger: AuditLogger,
    private memorySystem: MemorySystem  // 新增参数
  ) {
    // 依赖注入子模块
    this.sessionManager = new SessionManager(context, episodicMemory, llmTool);
    this.contextBuilder = new ContextBuilder(episodicMemory, preferenceMemory, this.sessionManager);
    this.promptEngine = new PromptEngine(configManager);
    this.dialogManager = new DialogManager();
    this.modeSelector = new InteractionModeSelector(configManager, context);
  }

  /**
   * 处理用户消息（核心业务逻辑）
   */
  async handleUserMessage(text: string, options?: { command?: string }): Promise<{
    userMessage: ChatMessage;
    assistantMessage?: ChatMessage;
    needsClarification?: boolean;
    clarificationQuestion?: string;
  }> {
    // 检查是否为命令请求
    if (options?.command) {
      await this.executeCommandFromChat(options.command, text);
      return {
        userMessage: {
          id: `msg_${Date.now()}_user`,
          role: 'user' as const,
          content: text,
          timestamp: Date.now()
        }
      };
    }

    // 检查是否为澄清响应
    const dialogContext = this.dialogManager.getContext();
    if (dialogContext.state === 'CLARIFYING') {
      return await this.handleClarificationResponse(text);
    }

    // 智能意图识别 + 复杂度评估
    const assessment = this.dialogManager.assessComplexity(text);
    const detectedCommand = this.detectIntent(text);
    const taskType = detectedCommand || 'GENERAL_CHAT';
    
    const mode = this.modeSelector.selectMode(
      taskType,
      assessment.complexity,
      assessment.needsClarification,
      this.isExploratoryQuery(text)
    );

    // 根据模式决定是否需要澄清
    const shouldClarify = this.modeSelector.shouldEnableClarification(
      mode,
      assessment.needsClarification
    );

    if (shouldClarify && mode !== 'QUICK') {
      return await this.startClarification(text, taskType, mode);
    }

    // 直接执行或普通对话
    if (detectedCommand) {
      await this.executeCommandFromChat(detectedCommand, text);
      return {
        userMessage: {
          id: `msg_${Date.now()}_user`,
          role: 'user' as const,
          content: text,
          timestamp: Date.now()
        }
      };
    }

    return await this.handleGeneralChat(text);
  }

  /**
   * 获取当前会话消息
   */
  getCurrentSessionMessages(): ChatMessage[] {
    return this.sessionManager.getCurrentSession()?.messages || [];
  }

  /**
   * 创建新会话
   */
  createNewSession(): void {
    this.sessionManager.createSession();
    this.dialogManager.reset();
  }

  /**
   * 切换会话
   */
  switchSession(sessionId: string): void {
    this.sessionManager.switchSession(sessionId);
    this.dialogManager.reset();
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    this.sessionManager.deleteSession(sessionId);
  }

  /**
   * 获取会话列表
   */
  getSessionList() {
    return this.sessionManager.getSessionList();
  }

  /**
   * 获取对话管理器（用于UI展示澄清状态）
   */
  getDialogManager(): DialogManager {
    return this.dialogManager;
  }

  // ========== 私有方法 ==========

  private async handleClarificationResponse(userResponse: string): Promise<any> {
    const nextQuestion = this.dialogManager.getNextQuestion();
    
    if (nextQuestion) {
      this.dialogManager.handleUserResponse(nextQuestion.id, userResponse);
      
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: userResponse,
        timestamp: Date.now()
      };
      this.sessionManager.addMessage(userMessage);

      const remainingQuestion = this.dialogManager.getNextQuestion();
      if (remainingQuestion) {
        return {
          userMessage,
          needsClarification: true,
          clarificationQuestion: remainingQuestion.question
        };
      } else {
        // 所有问题已回答，执行任务
        this.dialogManager.reset();
        // TODO: 使用完整上下文执行
        return { userMessage };
      }
    }
    
    return { userMessage: null };
  }

  private async startClarification(
    userMessage: string,
    taskType: string,
    mode: InteractionMode
  ): Promise<any> {
    this.dialogManager.startDialog(userMessage, mode);
    
    const questions = this.dialogManager.generateClarificationQuestions(userMessage, taskType);
    
    if (questions.length > 0) {
      (this.dialogManager as any).context.clarificationQuestions = questions;
      
      return {
        userMessage: {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: userMessage,
          timestamp: Date.now()
        },
        needsClarification: true,
        clarificationQuestion: questions[0].question
      };
    } else {
      this.dialogManager.reset();
      return await this.handleGeneralChat(userMessage);
    }
  }

  private async handleGeneralChat(text: string): Promise<any> {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(userMessage);

    const contextResult = await this.contextBuilder.build({
      userMessage: text,
      includeSelectedCode: true,
      maxHistoryMessages: 10,
      enableCrossSession: true
    });

    const systemPrompt = this.promptEngine.generatePrompt(text, contextResult);

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(assistantMessage);

    try {
      const response = await this.llmTool.call({
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextResult.messages
        ]
      });

      assistantMessage.content = response.data || '';
      return { userMessage, assistantMessage };
    } catch (error) {
      console.error('[ChatService] LLM call failed:', error);
      assistantMessage.content = '抱歉，生成回复时出现错误。';
      return { userMessage, assistantMessage };
    }
  }

  private detectIntent(message: string): string | null {
    // TODO: 从ChatViewProvider迁移意图识别逻辑
    return null;
  }

  /**
   * 执行聊天中的命令（改为调用 MemorySystem.executeAction）
   */
  private async executeCommandFromChat(command: string, context?: string): Promise<void> {
    const startTime = Date.now();
    console.log(`[ChatService] Executing command from chat: ${command}`);
    
    // 命令到 actionId 的映射
    const commandToActionMap: Record<string, string> = {
      'explainCode': 'explainCode',
      'generateCommit': 'generateCommit',
      'checkNaming': 'checkNaming',
      'generateCode': 'generateCode',
    };

    const actionId = commandToActionMap[command];
    if (!actionId) {
      vscode.window.showWarningMessage(`⚠️ 未知命令: ${command}`);
      return;
    }

    try {
      const editor = vscode.window.activeTextEditor;
      const input = {
        userInput: context,
        selectedCode: editor?.document.getText(editor.selection),
        filePath: editor?.document.uri.fsPath,
        language: editor?.document.languageId
      };

      // 统一通过 MemorySystem 调度
      await this.memorySystem.executeAction(actionId, input);

      const durationMs = Date.now() - startTime;
      await this.auditLogger.log('chat_command', 'success', durationMs, {
        parameters: { command, actionId, contextLength: context?.length || 0 }
      });

      console.log(`[ChatService] Command ${command} executed successfully`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error(`[ChatService] Command execution failed:`, error);
      
      await this.auditLogger.logError('chat_command', error as Error, durationMs);
      vscode.window.showErrorMessage(`命令执行失败: ${error}`);
    }
  }

  private isExploratoryQuery(message: string): boolean {
    const exploratoryPatterns = [
      /怎么.*/,
      /如何.*/,
      /什么是.*/,
      /学习.*/,
      /了解.*/,
      /最佳实践/
    ];
    
    return exploratoryPatterns.some(pattern => pattern.test(message));
  }
}
