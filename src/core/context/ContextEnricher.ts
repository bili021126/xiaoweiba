/**
 * 上下文增强器 - 负责采集编辑器状态并生成结构化上下文
 * 
 * 设计原则：单一职责
 * - 专注于从 VS Code API 提取信息，不涉及业务逻辑
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface EnrichedContext {
  filePath: string;
  fileName: string;
  language: string;
  workspaceRoot?: string;
  cursorPosition?: { line: number; character: number };
  selectedCode?: string;
  selectedRange?: { start: number; end: number };
  fullFileContent?: string;
  projectTechStack?: string[];
}

export class ContextEnricher {
  /**
   * 从 VS Code 编辑器提取丰富的上下文信息
   */
  static async enrichFromEditor(): Promise<EnrichedContext | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);

    return {
      filePath: document.fileName,
      fileName: path.basename(document.fileName),
      language: document.languageId,
      workspaceRoot: this.getWorkspaceRoot(document.uri),
      cursorPosition: {
        line: selection.active.line + 1,  // 1-based for human readability
        character: selection.active.character
      },
      selectedCode: selectedText || undefined,
      selectedRange: selectedText ? {
        start: selection.start.line + 1,
        end: selection.end.line + 1
      } : undefined,
      fullFileContent: document.getText().substring(0, 10000),  // Limit to 10KB to avoid context overflow
      projectTechStack: this.detectTechStack(document.uri)
    };
  }

  private static getWorkspaceRoot(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
  }

  private static detectTechStack(uri: vscode.Uri): string[] {
    const techs: string[] = [];
    const root = this.getWorkspaceRoot(uri);
    if (!root) return techs;

    // Simple heuristic detection based on file existence
    const fs = require('fs');
    const join = require('path').join;

    if (fs.existsSync(join(root, 'package.json'))) {
      techs.push('nodejs');
      try {
        const pkg = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf-8'));
        if (pkg.dependencies?.react || pkg.devDependencies?.react) techs.push('react');
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) techs.push('vue');
      } catch {}
    }
    if (fs.existsSync(join(root, 'requirements.txt')) || fs.existsSync(join(root, 'setup.py'))) {
      techs.push('python');
    }
    if (fs.existsSync(join(root, 'pom.xml')) || fs.existsSync(join(root, 'build.gradle'))) {
      techs.push('java');
    }
    if (fs.existsSync(join(root, 'go.mod'))) {
      techs.push('golang');
    }

    return techs;
  }
}
