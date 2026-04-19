import * as vscode from 'vscode';
import { EpisodicMemory, EpisodicMemoryRecord } from '../core/memory/EpisodicMemory';
import { PreferenceMemory, PreferenceRecommendation } from '../core/memory/PreferenceMemory';
import { SessionManager, ChatMessage } from './SessionManager';
import { CHAT, MEMORY, COMPLEXITY } from '../constants';

/**
 * 消息复杂度评估常量
 */
const COMPLEXITY_CONSTANTS = {
  LONG_MESSAGE_THRESHOLD: 200,
  CODE_BLOCK_WEIGHT: 0.3,
  TECHNICAL_TERM_WEIGHT: 0.2,
  MULTI_QUESTION_WEIGHT: 0.2,
  MAX_COMPLEXITY: 1
};

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
  messages: ChatMessage[];
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
    const historyMessages = this.sessionManager.getRecentMessages(options.maxHistoryMessages || CHAT.DEFAULT_HISTORY_MESSAGES);

    // 3. 检索情景记忆（相关记忆）
    // 根据用户消息长度和内容复杂度动态调整检索数量
    const messageComplexity = this.assessMessageComplexity(options.userMessage);
    const baseLimit = options.enableCrossSession ? MEMORY.CROSS_SESSION_RETRIEVAL_LIMIT : MEMORY.BASE_RETRIEVAL_LIMIT;
    const memoryLimit = Math.min(baseLimit + (messageComplexity > 0.7 ? 2 : 0), 10);
    
    console.log(`[ContextBuilder] Searching memories with limit=${memoryLimit}, enableCrossSession=${options.enableCrossSession}`);
    console.log('[ContextBuilder] episodicMemory object:', this.episodicMemory ? 'exists' : 'NULL');
    console.log('[ContextBuilder] episodicMemory.search method:', typeof this.episodicMemory.search);
    console.log('[ContextBuilder] episodicMemory instance ID:', (this.episodicMemory as any).__instanceId || 'unknown');
    
    // 并行检索：当前相关记忆 + 跨会话摘要
    let allEpisodes: EpisodicMemoryRecord[] = [];
    let crossSessionSummaries: EpisodicMemoryRecord[] = [];
    
    if (options.enableCrossSession) {
      // 检索当前相关的记忆
      const currentPromise = this.episodicMemory.search(options.userMessage, {
        limit: CHAT.DEFAULT_MEMORY_LIMIT
      });
      
      // 检索跨会话摘要（taskType='CHAT'的记忆是会话摘要）
      const crossSessionPromise = this.retrieveCrossSessionSummaries(CHAT.CROSS_SESSION_MEMORY_LIMIT);
      
      const [currentEpisodes, summaries] = await Promise.all([currentPromise, crossSessionPromise]);
      allEpisodes = currentEpisodes;
      crossSessionSummaries = summaries;
      
      console.log(`[ContextBuilder] Found ${allEpisodes.length} current memories, ${crossSessionSummaries.length} cross-session summaries`);
    } else {
      allEpisodes = await this.episodicMemory.search(options.userMessage, {
        limit: memoryLimit
      });
      console.log(`[ContextBuilder] Found ${allEpisodes.length} memories`);
    }

    // 4. 整理结果
    let episodes: EpisodicMemoryRecord[] = allEpisodes;
    let crossSessionMemories: EpisodicMemoryRecord[] = crossSessionSummaries;

    // ✅ 检测时间指代查询，过滤对话类记忆
    const isTemporalQuery = /刚才|上次|之前|刚刚|最近|做了什么|干了什么|记得/.test(options.userMessage);
    if (isTemporalQuery) {
      // 过滤：只保留实际操作类型的记忆（排除CHAT/CHAT_COMMAND，但保留SESSION_SUMMARY）
      episodes = allEpisodes.filter(ep => 
        !['CHAT', 'CHAT_COMMAND'].includes(ep.taskType) &&
        !ep.summary.startsWith('用户') &&
        !ep.summary.includes('询问')
      );
      console.log(`[ContextBuilder] Temporal query detected, filtered to ${episodes.length} operation memories`);
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
      // 偏好检索失败不影响主流程，静默处理
    }

    // 6. 构建系统提示
    const systemPrompt = await this.buildSystemPrompt(
      editorContext,
      episodes,
      crossSessionMemories,
      preferences,
      options.userMessage  // ✅ 传入用户查询
    );

    // 7. 构建消息数组
    const messages = this.buildMessages(historyMessages, options.userMessage, editorContext);

    // 🔍 调试：打印系统提示词的关键部分
    console.log(`[ContextBuilder] System prompt length: ${systemPrompt.length} chars`);
    if (episodes.length > 0) {
      console.log(`[ContextBuilder] Memory instruction included: YES (${episodes.length} memories)`);
    } else {
      console.log('[ContextBuilder] Memory instruction included: NO (no memories)');
    }

    return { messages, systemPrompt };
  }

  /**
   * 评估消息复杂度（0-1）
   */
  private assessMessageComplexity(message: string): number {
    const length = message.length;
    const hasCodeBlock = /```/.test(message);
    const hasTechnicalTerms = /(function|class|interface|type|const|let|var|import|export)/i.test(message);
    const questionCount = (message.match(/\?/g) || []).length;
    
    let complexity = 0;
    if (length > CHAT.LONG_MESSAGE_THRESHOLD) {
      complexity += COMPLEXITY.CODE_SNIPPET_COMPLEXITY;
    }
    if (hasCodeBlock) {
      complexity += MEMORY.CODE_BLOCK_WEIGHT;
    }
    if (hasTechnicalTerms) {
      complexity += COMPLEXITY.TECHNICAL_TERM_COMPLEXITY;
    }
    if (questionCount > 1) {
      complexity += COMPLEXITY.MULTI_FILE_COMPLEXITY;
    }
    
    return Math.min(complexity, 1.0);
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
   * ✅ 重构：构建系统提示（主方法）
   */
  private async buildSystemPrompt(
    editorContext: EditorContext,
    episodes: EpisodicMemoryRecord[],
    crossSessionMemories: EpisodicMemoryRecord[],
    preferences: PreferenceRecommendation[],
    userQuery: string
  ): Promise<string> {
    const parts: string[] = [];

    // 1. 角色设定和语气
    parts.push(await this.buildRoleAndTone());

    // 2. 编辑器上下文
    if (editorContext.filePath || editorContext.language) {
      parts.push(this.buildEditorContextSection(editorContext));
    }

    // 3. 相关情景记忆
    if (episodes.length > 0) {
      const isTemporalQuery = /刚才|上次|之前|刚刚|最近|做了什么/.test(userQuery);
      parts.push(this.buildMemorySection(episodes, isTemporalQuery));
    }

    // 4. 跨会话记忆
    if (crossSessionMemories.length > 0) {
      parts.push(this.buildCrossSessionSection(crossSessionMemories));
    }

    // 5. 用户偏好
    if (preferences.length > 0) {
      parts.push(this.buildPreferenceSection(preferences));
    }

    // 6. 回答指南
    parts.push(this.buildGuidelinesSection());

    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建角色和语气指令
   */
  private async buildRoleAndTone(): Promise<string> {
    const parts: string[] = [];
    
    // 基础角色设定
    parts.push('你是小尾巴，用户的私人编程学徒。你记得用户在这个项目里做过的每一件事。');
    parts.push('你的语气要自然、亲切，像一个熟悉的搭档，而不是一个查询工具。');

    // 动态语气调整
    const stats = await this.episodicMemory.getStats();
    const validTaskTypes = ['CODE_EXPLAIN', 'CODE_GENERATE', 'COMMIT_GENERATE', 'NAMING_CHECK', 'SQL_OPTIMIZE'];
    let effectiveMemoryCount = 0;
    for (const [taskType, count] of Object.entries(stats.byTaskType)) {
      if (validTaskTypes.includes(taskType)) {
        effectiveMemoryCount += count;
      }
    }
    
    let toneInstruction = '';
    if (effectiveMemoryCount < MEMORY.NOVICE_THRESHOLD) {
      toneInstruction = '你刚成为这个用户的学徒，还不太熟悉。请用礼貌、略带生疏的语气，称呼“您”。回答要完整、客气。';
    } else if (effectiveMemoryCount < MEMORY.FAMILIAR_THRESHOLD) {
      toneInstruction = '你和用户已经合作了一段时间，比较熟悉了。请用自然、友好的语气，称呼“你”。回答可以简洁一些。';
    } else {
      toneInstruction = '你是用户的老搭档了，非常默契。请用随意、亲切的语气，偶尔用“咱们”。回答可以直接、有默契感。';
    }
    
    parts.push(`\n${toneInstruction}`);
    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建编辑器上下文章节
   */
  private buildEditorContextSection(editorContext: EditorContext): string {
    const parts: string[] = ['\n<editor_context>'];
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
    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建记忆章节
   */
  private buildMemorySection(episodes: EpisodicMemoryRecord[], isTemporalQuery: boolean): string {
    const parts: string[] = [];
    
    if (isTemporalQuery) {
      // 时间指代查询：强指令
      parts.push('\n【重要指令】');
      parts.push('用户正在问他刚才在这个项目里做了什么操作。你必须直接根据下面的记录回答。');
      parts.push('严禁使用以下任何表述：');
      parts.push('- “根据对话记录”');
      parts.push('- “根据历史记忆”');
      parts.push('- “你刚才询问了...”');
      parts.push('- “聊天触发命令”');
      parts.push('- 任何技术术语（如 taskType、explainCode 等）');
      parts.push('\n用户最近的实际代码操作：');
      episodes.slice(0, CHAT.TEMPORAL_QUERY_DISPLAY_LIMIT).forEach(ep => {
        const time = new Date(ep.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
        parts.push(`- ${time} ${ep.summary}`);
      });
      parts.push('\n请这样回答：“你刚才在 [时间] 做了 [操作1]，然后做了 [操作2]。需要我帮你回顾细节吗？”');
    } else {
      // 其他查询：记忆作为辅助上下文
      parts.push('\n<relevant_memories>');
      parts.push('以下是相关的历史任务记忆:');
      episodes.slice(0, CHAT.RELEVANT_MEMORY_DISPLAY_LIMIT).forEach(ep => {
        parts.push(`- [${new Date(ep.timestamp).toLocaleDateString()}] ${ep.summary}`);
      });
      parts.push('</relevant_memories>');
      
      parts.push('\n<memory_usage_instruction>');
      parts.push('【重要指令】你必须在回答中引用以下历史记忆！');
      parts.push('当用户询问与历史操作相关的问题时，你必须：');
      parts.push('1. 明确说明你参考了哪些记忆');
      parts.push('2. 使用自然的语言提及，例如：“根据你刚才的操作...”、“我记得你之前...”');
      parts.push('3. 如果记忆中有相关的代码解释、提交信息生成等操作，主动提及并询问用户是否需要详细说明');
      parts.push('\n如果不引用记忆直接回答，会被视为不合格的回答！');
      parts.push('</memory_usage_instruction>');
    }
    
    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建跨会话记忆章节
   */
  private buildCrossSessionSection(crossSessionMemories: EpisodicMemoryRecord[]): string {
    const parts: string[] = ['\n<cross_session_memories>'];
    parts.push('以下是之前会话中讨论过的内容:');
    crossSessionMemories.slice(0, CHAT.CROSS_SESSION_MEMORY_LIMIT).forEach(mem => {
      parts.push(`- [${new Date(mem.timestamp).toLocaleDateString()}] ${mem.summary}`);
    });
    parts.push('</cross_session_memories>');
    
    parts.push('\n<cross_session_memory_instruction>');
    parts.push('【重要】如果用户的问题与之前的会话相关，请主动提及这些跨会话记忆。');
    parts.push('例如：“在上次会话中，我们讨论了...”、“我记得你之前问过...”');
    parts.push('</cross_session_memory_instruction>');
    
    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建用户偏好章节
   */
  private buildPreferenceSection(preferences: PreferenceRecommendation[]): string {
    const parts: string[] = ['\n<user_preferences>'];
    parts.push('用户偏好:');
    preferences.slice(0, CHAT.PREFERENCE_DISPLAY_LIMIT).forEach(pref => {
      parts.push(`- ${JSON.stringify(pref.record.pattern)}`);
    });
    parts.push('</user_preferences>');
    return parts.join('\n');
  }

  /**
   * ✅ 拆分：构建回答指南章节
   */
  private buildGuidelinesSection(): string {
    const parts: string[] = ['\n<guidelines>'];
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

  /**
   * 检索跨会话摘要
   * 
   * @param limit 返回数量
   * @returns 最近的会话摘要（taskType='CHAT'的记忆）
   */
  private async retrieveCrossSessionSummaries(limit: number = 3): Promise<EpisodicMemoryRecord[]> {
    try {
      // 直接通过retrieve方法按taskType过滤，避免全量检索
      const sessionSummaries = await this.episodicMemory.retrieve({
        taskType: 'CHAT_COMMAND',
        limit: limit * 2  // 获取更多以便后续排序
      });
      
      // 按时间戳降序排序，取最近的limit条
      return sessionSummaries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error('[ContextBuilder] Failed to retrieve cross-session summaries:', error);
      return [];
    }
  }
}
