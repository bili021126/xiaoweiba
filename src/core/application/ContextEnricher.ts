/**
 * 上下文采集器 - Context Enricher
 *
 * 职责：
 * 1. 采集VS Code编辑器当前状态（文件、光标、选中代码）
 * 2. 将上下文注入到Intent.metadata.enrichedContext
 * 3. 让AI能够回答"在你打开的UserService.java第42行..."
 *
 * 设计原则：
 * - 只采集操作上下文，不记录对话（符合宪法原则一）
 * - 异步采集，不阻塞主流程（符合宪法原则三）
 * - 限制采集大小，避免Token爆炸
 */

import { injectable } from 'tsyringe';
import * as vscode from 'vscode';
import * as path from 'path';
import { Intent } from '../domain/Intent';

/**
 *  enriched上下文 - 编辑器状态的详细信息
 */
export interface EnrichedContext {
  /** 当前激活的文件路径 */
  activeFilePath?: string;

  /** 当前激活文件的语言 */
  activeFileLanguage?: string;

  /** 光标所在行号（从1开始） */
  cursorLine?: number;

  /** 选中的代码片段 */
  selectedCode?: {
    content: string;
    startLine: number;
    endLine: number;
  };

  /** 可见区域的代码（限制大小） */
  visibleCode?: {
    content: string;
    startLine: number;
    endLine: number;
  };

  /** 采集时间戳 */
  timestamp: number;
}

@injectable()
export class ContextEnricher {
  private readonly MAX_CODE_LENGTH = 2000; // 最大代码长度，避免Token爆炸
  private readonly MAX_VISIBLE_LINES = 20; // 最大可见行数

  /**
   * 采集当前编辑器上下文
   * @returns EnrichedContext 或 undefined（如果没有激活编辑器）
   */
  async capture(): Promise<EnrichedContext | undefined> {
    try {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return undefined;
      }

      const document = editor.document;
      const selection = editor.selection;
      const position = editor.selection.active;

      // ✅ 修复 #1：使用相对于工作区的路径，保护用户隐私
      let activeFilePath = document.fileName;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (workspaceFolder) {
        activeFilePath = path.relative(workspaceFolder.uri.fsPath, document.fileName);
      }

      // 采集基本信息
      const enrichedContext: EnrichedContext = {
        activeFilePath,
        activeFileLanguage: document.languageId,
        cursorLine: position.line + 1, // VS Code行号从0开始，转换为从1开始
        timestamp: Date.now()
      };

      // 采集选中代码（如果有）
      if (!selection.isEmpty) {
        const selectedText = document.getText(selection);
        if (selectedText && selectedText.trim().length > 0) {
          enrichedContext.selectedCode = {
            content: this.truncateCode(selectedText),
            startLine: selection.start.line + 1,
            endLine: selection.end.line + 1
          };
        }
      }

      // 采集可见区域代码（如果没有选中代码）
      if (!enrichedContext.selectedCode) {
        const visibleRange = editor.visibleRanges[0];
        if (visibleRange) {
          const visibleText = document.getText(visibleRange);
          if (visibleText && visibleText.trim().length > 0) {
            enrichedContext.visibleCode = {
              content: this.truncateCode(visibleText),
              startLine: visibleRange.start.line + 1,
              endLine: visibleRange.end.line + 1
            };
          }
        }
      }

      return enrichedContext;
    } catch (error) {
      console.error('[ContextEnricher] Failed to capture context:', error);
      return undefined;
    }
  }

  /**
   * 将上下文注入到Intent中
   * @param intent 意图对象
   * @returns 注入后的意图对象
   */
  async enrichIntent(intent: Intent): Promise<Intent> {
    const enrichedContext = await this.capture();

    if (enrichedContext) {
      // 扩展metadata类型以包含enrichedContext
      (intent.metadata as any).enrichedContext = enrichedContext;
    }

    return intent;
  }

  /**
   * 截断过长的代码片段
   * @param code 原始代码
   * @returns 截断后的代码
   */
  private truncateCode(code: string): string {
    if (code.length <= this.MAX_CODE_LENGTH) {
      return code;
    }

    // 截断并添加提示
    const truncated = code.substring(0, this.MAX_CODE_LENGTH);
    const lastNewLine = truncated.lastIndexOf('\n');

    if (lastNewLine > this.MAX_CODE_LENGTH * 0.8) {
      // 如果接近末尾有换行符，截断到整行
      return truncated.substring(0, lastNewLine) + '\n// ... (代码过长，已截断)';
    }

    return truncated + '\n// ... (代码过长，已截断)';
  }

  /**
   * 生成人类可读的上下文描述
   * @param context enriched上下文
   * @returns 描述字符串，例如："在UserService.java第42行"
   */
  formatContextDescription(context: EnrichedContext): string {
    const parts: string[] = [];

    // 文件名
    if (context.activeFilePath) {
      const fileName = context.activeFilePath.split(/[\\/]/).pop() || context.activeFilePath;
      parts.push(`在${fileName}`);
    }

    // 行号
    if (context.cursorLine) {
      parts.push(`第${context.cursorLine}行`);
    }

    // 选中代码范围
    if (context.selectedCode) {
      parts.push(`（选中第${context.selectedCode.startLine}-${context.selectedCode.endLine}行）`);
    }

    return parts.join('');
  }
}
