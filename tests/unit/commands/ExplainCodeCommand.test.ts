import 'reflect-metadata';
import { container } from 'tsyringe';
import * as vscode from 'vscode';
import { ExplainCodeCommand } from '../../../src/commands/ExplainCodeCommand';
import { LLMTool } from '../../../src/tools/LLMTool';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { AuditLogger } from '../../../src/core/security/AuditLogger';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null,
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
    createWebviewPanel: jest.fn(() => ({
      webview: { html: '' },
      dispose: jest.fn()
    }))
  },
  ViewColumn: {
    Beside: 2
  },
  ProgressLocation: {
    Notification: 15
  }
}));

describe('ExplainCodeCommand', () => {
  let command: ExplainCodeCommand;
  let mockLLMTool: any;
  let mockEpisodicMemory: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    // 清理容器
    container.clearInstances();

    // 创建mock
    mockLLMTool = {
      call: jest.fn()
    };

    mockEpisodicMemory = {
      record: jest.fn().mockResolvedValue('ep_test_123')
    };

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    };

    // 注册mock到容器
    container.registerInstance(LLMTool, mockLLMTool);
    container.registerInstance(EpisodicMemory, mockEpisodicMemory);
    container.registerInstance(AuditLogger, mockAuditLogger);

    // 创建命令实例
    command = new ExplainCodeCommand();

    // 重置VS Code mock
    (vscode.window.activeTextEditor as any) = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    container.clearInstances();
  });

  describe('execute()', () => {
    it('应该在无编辑器时显示警告', async () => {
      // Arrange
      (vscode.window.activeTextEditor as any) = null;

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '请先打开一个文件并选中要解释的代码'
      );
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该在无选中代码时显示警告', async () => {
      // Arrange
      const mockEditor = {
        selection: { isEmpty: true },
        document: {
          getText: jest.fn().mockReturnValue(''),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '请先选中要解释的代码'
      );
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该成功执行代码解释流程', async () => {
      // Arrange
      const selectedCode = 'const x = 42;';
      const mockExplanation = '这是一个变量声明，将42赋值给x。';
      
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue(selectedCode),
          languageId: 'typescript',
          fileName: '/path/to/test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: mockExplanation
      });

      // Act
      await command.execute();

      // Assert
      expect(mockLLMTool.call).toHaveBeenCalled();
      expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
      expect(mockEpisodicMemory.record).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'explain_code',
        'success',
        expect.any(Number),
        expect.objectContaining({
          parameters: expect.objectContaining({
            language: 'typescript'
          })
        })
      );
    });

    it('应该在LLM调用失败时显示错误', async () => {
      // Arrange
      const selectedCode = 'const x = 42;';
      
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue(selectedCode),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: false,
        error: 'API调用失败'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('代码解释失败')
      );
      expect(mockAuditLogger.logError).toHaveBeenCalled();
    });

    it('应该在异常时记录审计日志', async () => {
      // Arrange
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue('const x = 42;'),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockRejectedValue(new Error('网络错误'));

      // Act
      await command.execute();

      // Assert
      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'explain_code',
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('私有方法测试', () => {
    it('应该正确转义HTML特殊字符', () => {
      // Arrange
      const command_any = command as any;
      const input = '<script>alert("XSS")</script>';
      
      // Act
      const output = command_any.escapeHtml(input);
      
      // Assert
      expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('应该生成包含代码和解释的HTML', () => {
      // Arrange
      const command_any = command as any;
      const explanation = '这是代码解释';
      const code = 'const x = 42;';
      const languageId = 'typescript';
      
      // Act
      const html = command_any.generateExplanationHtml(explanation, code, languageId);
      
      // Assert
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('代码解释');
      expect(html).toContain('const x = 42;');
      expect(html).toContain('这是代码解释');
      expect(html).toContain('language-typescript');
    });

    it('应该正确处理多行解释文本', () => {
      // Arrange
      const command_any = command as any;
      const explanation = '第一行\n第二行\n第三行';
      
      // Act
      const html = command_any.generateExplanationHtml(explanation, '', 'js');
      
      // Assert
      expect(html).toContain('第一行<br>第二行<br>第三行');
    });
  });

  describe('情景记忆记录', () => {
    it('应该在成功后记录记忆', async () => {
      // Arrange
      const selectedCode = 'const x = 42;';
      const explanation = '变量声明';
      
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue(selectedCode),
          languageId: 'typescript',
          fileName: '/path/to/test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: explanation
      });

      // Act
      await command.execute();

      // Assert
      expect(mockEpisodicMemory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'CODE_EXPLAIN',
          summary: expect.stringContaining('test.ts'),
          entities: ['ts'],
          outcome: 'SUCCESS',
          modelId: 'deepseek',
          durationMs: expect.any(Number),
          decision: expect.stringContaining('变量声明')
        })
      );
    });

    it('应该在记忆记录失败时不影响主流程', async () => {
      // Arrange
      const selectedCode = 'const x = 42;';
      
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue(selectedCode),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '解释'
      });

      mockEpisodicMemory.record.mockRejectedValue(new Error('数据库错误'));

      // Act & Assert - 不应抛出异常
      await expect(command.execute()).resolves.not.toThrow();
      
      // 验证其他步骤仍正常执行
      expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
    });
  });

  describe('进度提示', () => {
    it('应该显示进度提示', async () => {
      // Arrange
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue('const x = 42;'),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '解释'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: vscode.ProgressLocation.Notification,
          title: '正在解释代码...',
          cancellable: false
        }),
        expect.any(Function)
      );
    });
  });

  describe('Webview创建', () => {
    it('应该创建正确的Webview配置', async () => {
      // Arrange
      const mockEditor = {
        selection: {},
        document: {
          getText: jest.fn().mockReturnValue('const x = 42;'),
          languageId: 'typescript',
          fileName: 'test.ts'
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '解释'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'xiaoweiba.explanation',
        '代码解释 - 小尾巴',
        vscode.ViewColumn.Beside,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });
  });
});
