/**
 * IntentFactory 单元测试
 * 
 * 测试场景：
 * 1. 所有意图构建方法的正常路径
 * 2. 错误处理（无编辑器、无选中代码）
 * 3. 元数据生成正确性
 */

import 'reflect-metadata';
import { IntentFactory } from '../../../../src/core/factory/IntentFactory';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null
  }
}));

describe('IntentFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.window.activeTextEditor as any) = null;
  });

  describe('buildExplainCodeIntent', () => {
    it('无活动编辑器时应抛出错误', () => {
      expect(() => IntentFactory.buildExplainCodeIntent()).toThrow('没有活动的编辑器');
    });

    it('无选中代码时应抛出错误', () => {
      const mockEditor = {
        selection: { isEmpty: true },
        document: {
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      expect(() => IntentFactory.buildExplainCodeIntent()).toThrow('请先选中要解释的代码');
    });

    it('应成功构建解释代码意图', () => {
      const mockEditor = {
        selection: { 
          active: { line: 10 },
          start: { line: 9 },
          end: { line: 11 }
        },
        document: {
          getText: jest.fn().mockReturnValue('const x = 1;'),
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = IntentFactory.buildExplainCodeIntent();

      expect(intent.name).toBe('explain_code');
      expect(intent.codeContext).toBeDefined();
      expect(intent.codeContext?.selectedCode).toBe('const x = 1;');
      expect(intent.metadata.source).toBe('command');
      expect(intent.metadata.sessionId).toMatch(/^session_\d+_[a-z0-9]{9}$/);
      // ✅ 修复：验证 enrichedContext 是否正确注入
      expect(intent.metadata.enrichedContext).toBeDefined();
      expect(intent.metadata.enrichedContext?.selectedCode).toBeDefined();
      expect(intent.metadata.enrichedContext?.selectedCode?.content).toBe('const x = 1;');
    });
  });

  describe('buildGenerateCommitIntent', () => {
    it('无编辑器时应返回无codeContext的意图', () => {
      const intent = IntentFactory.buildGenerateCommitIntent();

      expect(intent.name).toBe('generate_commit');
      expect(intent.codeContext).toBeUndefined();
      expect(intent.metadata.source).toBe('command');
    });

    it('有编辑器时应包含codeContext', () => {
      const mockEditor = {
        document: {
          getText: jest.fn().mockReturnValue('full content'),
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript'
        },
        selection: { 
          active: { line: 10 },
          start: { line: 10 },
          end: { line: 10 }
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = IntentFactory.buildGenerateCommitIntent();

      expect(intent.name).toBe('generate_commit');
      expect(intent.codeContext).toBeDefined();
      expect(intent.codeContext?.filePath).toBe('/test/file.ts');
    });
  });

  describe('buildChatIntent', () => {
    it('应成功构建聊天意图', async () => {
      const intent = await IntentFactory.buildChatIntent('你好');

      expect(intent.name).toBe('chat');
      expect(intent.userInput).toBe('你好');
      expect(intent.metadata.source).toBe('chat');
    });

    it('应支持自定义sessionId', async () => {
      const intent = await IntentFactory.buildChatIntent('你好', { sessionId: 'custom_session' });

      expect(intent.metadata.sessionId).toBe('custom_session');
    });

    it('有编辑器时应包含codeContext', async () => {
      const mockEditor = {
        document: {
          getText: jest.fn().mockReturnValue('content'),
          uri: { fsPath: '/test/file.ts' },
          languageId: 'javascript'
        },
        selection: { 
          active: { line: 5 },
          start: { line: 5 },
          end: { line: 5 }
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = await IntentFactory.buildChatIntent('解释代码');

      expect(intent.codeContext).toBeDefined();
      expect(intent.codeContext?.language).toBe('javascript');
    });
  });

  describe('buildInlineCompletionIntent', () => {
    it('应成功构建行内补全意图', () => {
      const intent = IntentFactory.buildInlineCompletionIntent('console.log(');

      expect(intent.name).toBe('inline_completion');
      expect(intent.userInput).toBe('console.log(');
      expect(intent.metadata.source).toBe('inline_completion');
    });

    it('应支持可选参数', () => {
      const intent = IntentFactory.buildInlineCompletionIntent('test', {
        language: 'typescript',
        filePath: '/test/file.ts'
      });

      expect(intent.codeContext).toBeDefined();
      expect(intent.codeContext?.language).toBe('typescript');
      expect(intent.codeContext?.filePath).toBe('/test/file.ts');
    });

    it('无选项时应使用默认值', () => {
      const intent = IntentFactory.buildInlineCompletionIntent('test');

      expect(intent.codeContext).toBeUndefined();
    });
  });

  describe('buildCheckNamingIntent', () => {
    it('无活动编辑器时应抛出错误', () => {
      expect(() => IntentFactory.buildCheckNamingIntent()).toThrow('没有活动的编辑器');
    });

    it('应成功构建检查命名意图', () => {
      const mockEditor = {
        document: {
          getText: jest.fn().mockReturnValue('const myVar = 1;'),
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript'
        },
        selection: { active: { line: 0 } }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = IntentFactory.buildCheckNamingIntent();

      expect(intent.name).toBe('check_naming');
      expect(intent.codeContext).toBeDefined();
    });
  });

  describe('buildCodeGenerationIntent', () => {
    it('应支持带prompt的意图', () => {
      const intent = IntentFactory.buildCodeGenerationIntent('创建一个函数');

      expect(intent.name).toBe('generate_code');
      expect(intent.userInput).toBe('创建一个函数');
    });

    it('应支持不带prompt的意图', () => {
      const intent = IntentFactory.buildCodeGenerationIntent();

      expect(intent.name).toBe('generate_code');
      expect(intent.userInput).toBeUndefined();
    });
  });

  describe('buildOptimizeSQLIntent', () => {
    it('无活动编辑器时应抛出错误', () => {
      expect(() => IntentFactory.buildOptimizeSQLIntent()).toThrow('没有活动的编辑器');
    });

    it('无选中SQL代码时应抛出错误', () => {
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      expect(() => IntentFactory.buildOptimizeSQLIntent()).toThrow('请先选中要优化的SQL代码');
    });

    it('应成功构建SQL优化意图', () => {
      const mockEditor = {
        selection: { active: { line: 5 } },
        document: {
          getText: jest.fn().mockReturnValue('SELECT * FROM users'),
          uri: { fsPath: '/test/query.sql' },
          languageId: 'sql'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = IntentFactory.buildOptimizeSQLIntent();

      expect(intent.name).toBe('optimize_sql');
      expect(intent.codeContext?.selectedCode).toBe('SELECT * FROM users');
    });
  });

  describe('配置和记忆管理意图', () => {
    it('buildConfigureApiKeyIntent应返回正确的意图', () => {
      const intent = IntentFactory.buildConfigureApiKeyIntent();

      expect(intent.name).toBe('configure_api_key');
      expect(intent.codeContext).toBeUndefined();
      expect(intent.metadata.source).toBe('command');
    });

    it('buildExportMemoryIntent应返回正确的意图', () => {
      const intent = IntentFactory.buildExportMemoryIntent();

      expect(intent.name).toBe('export_memory');
      expect(intent.metadata.source).toBe('command');
    });

    it('buildImportMemoryIntent应返回正确的意图', () => {
      const intent = IntentFactory.buildImportMemoryIntent();

      expect(intent.name).toBe('import_memory');
      expect(intent.metadata.source).toBe('command');
    });
  });

  describe('会话管理意图', () => {
    it('buildNewSessionIntent应生成新的sessionId', () => {
      const intent = IntentFactory.buildNewSessionIntent();

      expect(intent.name).toBe('new_session');
      expect(intent.metadata.source).toBe('chat');
      expect(intent.metadata.sessionId).toMatch(/^session_\d+_[a-z0-9]{9}$/);
    });

    it('buildSwitchSessionIntent应使用指定的sessionId', () => {
      const intent = IntentFactory.buildSwitchSessionIntent('session_123');

      expect(intent.name).toBe('switch_session');
      expect(intent.userInput).toBe('session_123');
      expect(intent.metadata.sessionId).toBe('session_123');
    });

    it('buildDeleteSessionIntent应使用指定的sessionId', () => {
      const intent = IntentFactory.buildDeleteSessionIntent('session_456');

      expect(intent.name).toBe('delete_session');
      expect(intent.userInput).toBe('session_456');
      expect(intent.metadata.sessionId).toBe('session_456');
    });
  });

  describe('buildGenerateCodeIntent', () => {
    it('无编辑器时应返回无codeContext的意图', () => {
      const intent = IntentFactory.buildGenerateCodeIntent();

      expect(intent.name).toBe('generate_code');
      expect(intent.codeContext).toBeUndefined();
      expect(intent.userInput).toBeUndefined();
    });

    it('有编辑器时应包含截断的codeContext', () => {
      const longContent = 'x'.repeat(15000); // 超过5000限制
      const mockEditor = {
        document: {
          getText: jest.fn().mockReturnValue(longContent),
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript'
        },
        selection: { active: { line: 0 } }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      const intent = IntentFactory.buildGenerateCodeIntent();

      expect(intent.codeContext).toBeDefined();
      expect(intent.codeContext?.fullFileContent?.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('元数据一致性', () => {
    it('所有意图都应包含timestamp', () => {
      const intents = [
        IntentFactory.buildConfigureApiKeyIntent(),
        IntentFactory.buildExportMemoryIntent(),
        IntentFactory.buildImportMemoryIntent(),
        IntentFactory.buildNewSessionIntent()
      ];

      intents.forEach(intent => {
        expect(intent.metadata.timestamp).toBeDefined();
        expect(typeof intent.metadata.timestamp).toBe('number');
      });
    });

    it('sessionId应具有唯一性', () => {
      const intent1 = IntentFactory.buildConfigureApiKeyIntent();
      const intent2 = IntentFactory.buildConfigureApiKeyIntent();

      expect(intent1.metadata.sessionId).not.toBe(intent2.metadata.sessionId);
    });
  });
});
