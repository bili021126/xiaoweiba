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

    return {
      name: 'explain_code',
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
   */
  static buildChatIntent(userInput: string, options?: { sessionId?: string }): Intent {
    const editor = vscode.window.activeTextEditor;
    
    return {
      name: 'chat',
      userInput,
      codeContext: editor ? this.extractCodeContext(editor, undefined, 5000) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        sessionId: options?.sessionId || this.generateSessionId()
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
   * 构建代码生成意图
   */
  static buildGenerateCodeIntent(): Intent {
    const editor = vscode.window.activeTextEditor;
    
    return {
      name: 'generate_code',
      userInput: undefined,  // 用户需要在Webview中输入需求
      codeContext: editor ? this.extractCodeContext(editor, undefined, 5000) : undefined,
      metadata: {
        timestamp: Date.now(),
        source: 'command',
        sessionId: this.generateSessionId()
      }
    };
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
}
