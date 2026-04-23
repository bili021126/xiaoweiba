/**
 * Intent工厂 - 从VS Code上下文构建Intent
 * 
 * 职责：
 * 1. 从编辑器状态提取代码上下文
 * 2. 从用户输入提取意图
 * 3. 生成标准化的Intent对象
 */

import * as vscode from 'vscode';
import { Intent, IntentName, CodeContext } from '../../core/domain/Intent';
import { ContextEnricher } from '../application/ContextEnricher'; // ✅ L1: 引入上下文增强器
import { IntentAnalyzer } from '../memory/IntentAnalyzer'; // ✅ L1: 引入意图分析器

export class IntentFactory {
  /**
   * 构建解释代码意图
   */
  static buildExplainCodeIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      throw new Error('没有活动的编辑器');
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    
    if (!selectedCode || selectedCode.trim().length === 0) {
      throw new Error('请先选中要解释的代码');
    }

    // ✅ 修复：构建 enrichedContext，将代码片段注入其中
    const enrichedContext = {
      activeFilePath: editor.document.uri.fsPath,
      activeFileLanguage: editor.document.languageId,
      cursorLine: editor.selection.active.line + 1, // VS Code 行号从 0 开始
      selectedCode: {
        content: selectedCode,
        startLine: selection.start.line + 1,
        endLine: selection.end.line + 1
      },
      timestamp: Date.now()
    };

    return {
      name: 'explain_code',
      userInput: undefined,
      codeContext: this.extractCodeContext(editor, selectedCode),
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId(),
        // ✅ 修复：将选中的代码传递到 enrichedContext，供 PromptComposer 使用
        enrichedContext
      }
    };
  }

  /**
   * 构建生成提交信息意图
   */
  static buildGenerateCommitIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    
    return {
      name: 'generate_commit',
      userInput: undefined,
      codeContext: editor ? this.extractCodeContext(editor) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建聊天意图
   * ✅ P1-04: 增加命令识别逻辑，避免将明确命令误判为普通聊天
   */
  static async buildChatIntent(userInput: string, options?: { sessionId?: string }): Promise<Intent> {
    const editor = vscode.window.activeTextEditor;
    
    // ✅ P1-04: 命令识别 - 优先匹配明确的命令关键词
    const trimmedInput = userInput.trim().toLowerCase();
    
    // 生成提交信息相关命令
    if (trimmedInput.startsWith('/commit') || 
        trimmedInput.includes('生成提交') || 
        trimmedInput.includes('commit message') ||
        trimmedInput.includes('git commit')) {
      console.log('[IntentFactory] Detected commit command, routing to generate_commit agent');
      return this.buildGenerateCommitIntent();
    }
    
    // 解释代码相关命令
    if (trimmedInput.startsWith('/explain') || 
        trimmedInput.includes('解释代码') || 
        trimmedInput.includes('explain code')) {
      console.log('[IntentFactory] Detected explain command, routing to explain_code agent');
      return this.buildExplainCodeIntent();
    }
    
    // 优化SQL相关命令
    if (trimmedInput.startsWith('/sql') || 
        trimmedInput.includes('优化sql') || 
        trimmedInput.includes('optimize sql')) {
      console.log('[IntentFactory] Detected SQL optimize command');
      return this.buildOptimizeSQLIntent();
    }
    
    // 检查命名相关命令
    if (trimmedInput.startsWith('/naming') || 
        trimmedInput.includes('检查命名') || 
        trimmedInput.includes('check naming')) {
      console.log('[IntentFactory] Detected naming check command');
      return this.buildCheckNamingIntent();
    }
    
    // 新建会话命令
    if (trimmedInput.startsWith('/new') || 
        trimmedInput === '新建会话' || 
        trimmedInput.includes('new session')) {
      console.log('[IntentFactory] Detected new session command');
      return this.buildNewSessionIntent();
    }
    
    // ✅ L1: 初始化分析器和增强器
    const intentAnalyzer = new IntentAnalyzer();
    const contextEnricher = new ContextEnricher();
    
    // ✅ L1: 分析意图向量
    const intentVector = intentAnalyzer.analyze(userInput, editor?.document.languageId);
    
    // ✅ L1: 采集丰富上下文
    const enrichedContext = await contextEnricher.capture();
    
    return {
      name: 'chat',
      userInput,
      codeContext: editor ? this.extractCodeContext(editor, undefined, 5000) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        sessionId: options?.sessionId || this.generateSessionId(),
        intentVector, // ✅ L1: 注入意图向量
        complexity: this.assessComplexity(userInput), // ✅ L1: 注入复杂度
        requiresCodeContext: this.needsCodeContext(userInput), // ✅ L1: 注入代码需求标记
        enrichedContext // ✅ L1: 注入增强上下文
      }
    };
  }

  /**
   * 构建行内补全意图
   * 
   * @param prefix 代码前缀
   * @param options 可选参数（language、filePath）
   */
  static buildInlineCompletionIntent(prefix: string, options?: { language?: string; filePath?: string }): Intent {
    return {
      name: 'inline_completion',
      userInput: prefix, // 使用前缀作为用户输入
      codeContext: options ? {
        language: options.language || 'text',
        filePath: options.filePath || '',
        selectedCode: prefix
      } : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'inline_completion',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建检查命名意图
   */
  static buildCheckNamingIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      throw new Error('没有活动的编辑器');
    }

    return {
      name: 'check_naming',
      userInput: undefined,
      codeContext: this.extractCodeContext(editor),
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建代码生成意图
   */
  static buildCodeGenerationIntent(prompt?: string): Intent {
    const editor = vscode.window.activeTextEditor;
    
    return {
      name: 'generate_code',
      userInput: prompt,
      codeContext: editor ? this.extractCodeContext(editor) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建SQL优化意图
   */
  static buildOptimizeSQLIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      throw new Error('没有活动的编辑器');
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);
    
    if (!selectedCode || selectedCode.trim().length === 0) {
      throw new Error('请先选中要优化的SQL代码');
    }

    return {
      name: 'optimize_sql',
      userInput: undefined,
      codeContext: this.extractCodeContext(editor, selectedCode),
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建配置API Key意图
   */
  static buildConfigureApiKeyIntent(): Intent {
    return {
      name: 'configure_api_key',
      userInput: undefined,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建导出记忆意图
   */
  static buildExportMemoryIntent(): Intent {
    return {
      name: 'export_memory',
      userInput: undefined,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建导入记忆意图
   */
  static buildImportMemoryIntent(): Intent {
    return {
      name: 'import_memory',
      userInput: undefined,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建新建会话意图
   */
  static buildNewSessionIntent(): Intent {
    return {
      name: 'new_session',
      userInput: undefined,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * 构建切换会话意图
   */
  static buildSwitchSessionIntent(sessionId: string): Intent {
    return {
      name: 'switch_session',
      userInput: sessionId,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        sessionId
      }
    };
  }

  /**
   * 构建删除会话意图
   */
  static buildDeleteSessionIntent(sessionId: string): Intent {
    return {
      name: 'delete_session',
      userInput: sessionId,
      codeContext: undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        sessionId
      }
    };
  }

  /**
   * 构建代码生成意图
   */
  static buildGenerateCodeIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    let selectedText = '';
    let userPrompt: string | undefined = undefined;

    if (editor) {
      const selection = editor.selection;
      selectedText = editor.document.getText(selection);
      
      // ✅ P1-03: 如果选中的是注释，自动提取内容作为需求
      if (selectedText && this.isComment(selectedText, editor.document.languageId)) {
        userPrompt = this.extractCommentContent(selectedText);
        console.log('[IntentFactory] Extracted comment as prompt:', userPrompt);
      }
    }

    return {
      name: 'generate_code',
      userInput: userPrompt,  // ✅ 预填充提取的需求（如果有）
      codeContext: editor ? this.extractCodeContext(editor, undefined, 5000) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
  }

  /**
   * ✅ P1-03: 判断文本是否为注释
   */
  private static isComment(text: string, languageId: string): boolean {
    const trimmed = text.trim();
    
    // C系语言（JavaScript, TypeScript, Java, Go, Rust, C, C++, C#）
    if (['javascript', 'typescript', 'java', 'go', 'rust', 'c', 'cpp', 'csharp'].includes(languageId)) {
      return trimmed.startsWith('//') || trimmed.startsWith('/*');
    }
    
    // Python
    if (languageId === 'python') {
      return trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''");
    }
    
    // Ruby/Perl
    if (['ruby', 'perl'].includes(languageId)) {
      return trimmed.startsWith('#');
    }
    
    // SQL
    if (languageId === 'sql') {
      return trimmed.startsWith('--') || trimmed.startsWith('/*');
    }
    
    return false;
  }

  /**
   * ✅ P1-03: 提取注释中的实际内容
   */
  private static extractCommentContent(comment: string): string {
    let content = comment.trim();
    
    // 移除单行注释符号 // # --
    content = content.replace(/^[\/\/#-]+\s*/, '');
    
    // 移除多行注释符号 /* */
    content = content.replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '');
    
    // 移除Python三引号
    content = content.replace(/^"""\s*/, '').replace(/\s*"""$/, '');
    content = content.replace(/^'''\s*/, '').replace(/\s*'''$/, '');
    
    // 移除每行开头的 * （多行注释常见格式）
    content = content.split('\n').map(line => line.replace(/^\s*\*\s?/, '')).join('\n').trim();
    
    return content;
  }

  /**
   * 从编辑器提取代码上下文
   */
  private static extractCodeContext(
    editor: vscode.TextEditor,
    selectedCode?: string,
    maxContentLength: number = 10000
  ): CodeContext {
    const document = editor.document;
    const fullContent = document.getText();
    
    return {
      filePath: document.uri.fsPath,
      language: document.languageId,
      selectedCode,
      cursorLine: editor.selection.active.line + 1,
      fullFileContent: fullContent.length > maxContentLength
        ? fullContent.substring(0, maxContentLength)
        : fullContent
    };
  }

  /**
   * 生成会话ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ✅ L1: 辅助方法 - 评估查询复杂度
  private static assessComplexity(input: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = input.split(/\s+/).length;
    if (wordCount < 5) return 'simple';
    if (wordCount < 15) return 'moderate';
    return 'complex';
  }

  // ✅ L1: 辅助方法 - 判断是否需要代码上下文
  private static needsCodeContext(input: string): boolean {
    const codeKeywords = ['代码', '函数', '类', '变量', '解释', '重构', 'bug', '错误', '实现'];
    return codeKeywords.some(keyword => input.includes(keyword));
  }
}
