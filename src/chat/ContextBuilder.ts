import * as vscode from 'vscode';
import { EpisodicMemory, EpisodicMemoryRecord } from '../core/memory/EpisodicMemory';
import { PreferenceMemory, PreferenceRecommendation } from '../core/memory/PreferenceMemory';
import { SessionManager, ChatMessage } from './SessionManager';

/**
 * 编辑器上下文
 */
interface EditorContext {
  filePath?: string;
  language?: string;
  selectedCode?: string;
  cursorLine?: number;
  fileContent?: string;
}

/**
 * 上下文构建结果
 */
interface ContextBuildResult {
  messages: any[];
  systemPrompt: string;
}

/**
 * 上下文构建器
 * 
 * 负责收集编辑器状态、会话历史、记忆系统检索，组装最终Prompt
 */
export class ContextBuilder {
  constructor(
    private episodicMemory: EpisodicMemory,
    private preferenceMemory: PreferenceMemory,
    private sessionManager: SessionManager
  ) {}

  /**
   * 构建上下文
   */
  async build(options: {
    userMessage: string;
    includeSelectedCode?: boolean;
    maxHistoryMessages?: number;
    enableCrossSession?: boolean;
  }): Promise<ContextBuildResult> {
    // 1. 获取编辑器上下文
    const editorContext = await this.getEditorContext(options.includeSelectedCode);

    // 2. 获取会话历史
    const historyMessages = this.sessionManager.getRecentMessages(options.maxHistoryMessages || 5);

    // 3. 检索情景记忆（相关记忆）
    // 如果启用跨会话，则获取更多记忆，然后分割
    const memoryLimit = options.enableCrossSession ? 6 : 3;
    const allEpisodes = await this.episodicMemory.search(options.userMessage, {
      limit: memoryLimit
    });

    // 4. 跨会话检索（从检索结果中分割）
    let crossSessionMemories: EpisodicMemoryRecord[] = [];
    let episodes: EpisodicMemoryRecord[] = [];
    
    if (options.enableCrossSession) {
      // 前3条作为当前会话相关，后3条作为跨会话
      episodes = allEpisodes.slice(0, 3);
      crossSessionMemories = allEpisodes.slice(3);
    } else {
      episodes = allEpisodes;
    }

    // 5. 检索偏好记忆
    let preferences: PreferenceRecommendation[] = [];
    try {
      preferences = await this.preferenceMemory.getRecommendations(
        'CODE_PATTERN',
        {},
        undefined
      );
    } catch (error) {
      console.warn('[ContextBuilder] 偏好检索失败:', error);
    }

    // 6. 构建系统提示
    const systemPrompt = this.buildSystemPrompt(
      editorContext,
      episodes,
      crossSessionMemories,
      preferences
    );

    // 7. 构建消息数组
    const messages = this.buildMessages(historyMessages, options.userMessage, editorContext);

    return { messages, systemPrompt };
  }

  /**
   * 获取编辑器上下文
   */
  private async getEditorContext(includeCode: boolean = true): Promise<EditorContext> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return {};
    }

    const context: EditorContext = {
      filePath: editor.document.uri.fsPath,
      language: editor.document.languageId,
      cursorLine: editor.selection.active.line
    };

    if (includeCode && !editor.selection.isEmpty) {
      context.selectedCode = editor.document.getText(editor.selection);
    }

    // 获取文件内容（限制大小）
    const fileContent = editor.document.getText();
    if (fileContent.length < 10000) { // 只包含小于10KB的文件
      context.fileContent = fileContent;
    }

    return context;
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(
    editorContext: EditorContext,
    episodes: EpisodicMemoryRecord[],
    crossSessionMemories: EpisodicMemoryRecord[],
    preferences: PreferenceRecommendation[]
  ): string {
    const parts: string[] = [];

    // 基础角色定义
    parts.push('你是小尾巴AI助手，一个专业的编程伴侣，擅长代码解释、代码生成和技术问题解答。');

    // 编辑器上下文
    if (editorContext.filePath || editorContext.language) {
      parts.push('\n<editor_context>');
      if (editorContext.filePath) {
        parts.push(`当前文件: ${editorContext.filePath}`);
      }
      if (editorContext.language) {
        parts.push(`语言: ${editorContext.language}`);
      }
      if (editorContext.selectedCode) {
        parts.push(`\n选中代码:\n\`\`\`${editorContext.language || 'code'}\n${editorContext.selectedCode}\n\`\`\``);
      }
      parts.push('</editor_context>');
    }

    // 相关情景记忆
    if (episodes.length > 0) {
      parts.push('\n<relevant_memories>');
      parts.push('以下是相关的历史任务记忆:');
      episodes.slice(0, 3).forEach(ep => {
        parts.push(`- [${new Date(ep.timestamp).toLocaleDateString()}] ${ep.summary}`);
      });
      parts.push('</relevant_memories>');
    }

    // 跨会话记忆
    if (crossSessionMemories.length > 0) {
      parts.push('\n<cross_session_memories>');
      parts.push('以下是之前会话中讨论过的内容:');
      crossSessionMemories.slice(0, 3).forEach(mem => {
        parts.push(`- [${new Date(mem.timestamp).toLocaleDateString()}] ${mem.summary}`);
      });
      parts.push('</cross_session_memories>');
    }

    // 用户偏好
    if (preferences.length > 0) {
      parts.push('\n<user_preferences>');
      parts.push('用户偏好:');
      preferences.slice(0, 3).forEach(pref => {
        parts.push(`- ${JSON.stringify(pref.record.pattern)}`);
      });
      parts.push('</user_preferences>');
    }

    // 回答指南
    parts.push('\n<guidelines>');
    parts.push('- 回答要简洁明了，避免冗长');
    parts.push('- 代码示例要完整可运行');
    parts.push('- 如果不确定，请明确说明');
    parts.push('- 优先使用中文回答');
    parts.push('</guidelines>');

    return parts.join('\n');
  }

  /**
   * 构建消息数组
   */
  private buildMessages(
    historyMessages: ChatMessage[],
    currentUserMessage: string,
    editorContext: EditorContext
  ): any[] {
    const messages: any[] = [];

    // 添加历史消息
    for (const msg of historyMessages) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: currentUserMessage
    });

    return messages;
  }
}
