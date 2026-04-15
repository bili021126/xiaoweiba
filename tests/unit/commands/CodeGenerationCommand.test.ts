import 'reflect-metadata';
import { container } from 'tsyringe';
import * as vscode from 'vscode';
import { CodeGenerationCommand } from '../../../src/commands/CodeGenerationCommand';
import { LLMTool } from '../../../src/tools/LLMTool';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { AuditLogger } from '../../../src/core/security/AuditLogger';

// Mock LLMResponseCache
jest.mock('../../../src/core/cache/LLMResponseCache', () => {
  return {
    LLMResponseCache: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      clear: jest.fn(),
      clearExpired: jest.fn(),
      getStats: jest.fn().mockReturnValue({ size: 0, keys: [] })
    }))
  };
});

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null,
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showTextDocument: jest.fn().mockResolvedValue(undefined),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
    createWebviewPanel: jest.fn(() => ({
      webview: { html: '' },
      dispose: jest.fn()
    }))
  },
  workspace: {
    openTextDocument: jest.fn().mockResolvedValue({
      save: jest.fn().mockResolvedValue(true),
      uri: { fsPath: 'test.txt' }
    })
  },
  env: {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined)
    }
  },
  ViewColumn: {
    Beside: 2
  },
  ProgressLocation: {
    Notification: 15
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path }))
  }
}));

describe('CodeGenerationCommand', () => {
  let command: CodeGenerationCommand;
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
    command = new CodeGenerationCommand(mockEpisodicMemory, mockLLMTool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('应该在无编辑器时显示警告', async () => {
      // Arrange
      (vscode.window.activeTextEditor as any) = null;

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '⚠️ 请先打开一个文件'
      );
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该在用户取消输入时显示信息', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('const x = 42;')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '已取消代码生成'
      );
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该在输入为空时显示信息', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('const x = 42;')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('');

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '已取消代码生成'
      );
    });

    it('应该成功执行代码生成流程', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('const x = 42;')
        },
        selection: {
          active: { line: 0, character: 0 }
        },
        edit: jest.fn().mockResolvedValue(true)
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('创建一个加法函数');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(copy) 复制到剪贴板'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(mockLLMTool.call).toHaveBeenCalled();
      expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
      expect(mockEpisodicMemory.record).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'code_generation',
        'success',
        expect.any(Number),
        expect.objectContaining({
          parameters: expect.any(Object)
        })
      );
    });

    it('应该在LLM调用失败时显示错误', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试需求');

      mockLLMTool.call.mockResolvedValue({
        success: false,
        error: 'API调用失败'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('代码生成失败')
      );
      expect(mockAuditLogger.logError).toHaveBeenCalled();
    });

    it('应该在异常时记录审计日志', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockRejectedValue(new Error('测试错误'));

      // Act
      await command.execute();

      // Assert
      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'code_generation',
        expect.any(Error),
        expect.any(Number)
      );
    });
  });

  describe('私有方法测试', () => {
    describe('extractCodeFromMarkdown', () => {
      it('应该提取指定语言的代码块', () => {
        // Arrange
        const markdown = '```typescript\nconst x = 42;\n```';
        
        // Act
        const result = (command as any).extractCodeFromMarkdown(markdown, 'typescript');
        
        // Assert
        expect(result).toBe('const x = 42;');
      });

      it('应该提取通用代码块', () => {
        // Arrange
        const markdown = '```\nconst x = 42;\n```';
        
        // Act
        const result = (command as any).extractCodeFromMarkdown(markdown, 'typescript');
        
        // Assert
        expect(result).toBe('const x = 42;');
      });

      it('应该在没有代码块时返回原始内容', () => {
        // Arrange
        const markdown = 'const x = 42;';
        
        // Act
        const result = (command as any).extractCodeFromMarkdown(markdown, 'typescript');
        
        // Assert
        expect(result).toBe('const x = 42;');
      });

      it('应该处理多行代码', () => {
        // Arrange
        const markdown = '```python\ndef hello():\n    print("Hello")\n    return True\n```';
        
        // Act
        const result = (command as any).extractCodeFromMarkdown(markdown, 'python');
        
        // Assert
        expect(result).toContain('def hello():');
        expect(result).toContain('print("Hello")');
      });
    });

    describe('getExtensionForLanguage', () => {
      it('应该返回TypeScript的扩展名', () => {
        expect((command as any).getExtensionForLanguage('typescript')).toBe('ts');
      });

      it('应该返回JavaScript的扩展名', () => {
        expect((command as any).getExtensionForLanguage('javascript')).toBe('js');
      });

      it('应该返回Python的扩展名', () => {
        expect((command as any).getExtensionForLanguage('python')).toBe('py');
      });

      it('应该返回Java的扩展名', () => {
        expect((command as any).getExtensionForLanguage('java')).toBe('java');
      });

      it('应该为未知语言返回txt', () => {
        expect((command as any).getExtensionForLanguage('unknown')).toBe('txt');
      });
    });
  });

  describe('情景记忆记录', () => {
    it('应该在成功后记录记忆', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试需求');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(copy) 复制到剪贴板'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(mockEpisodicMemory.record).toHaveBeenCalledWith({
        taskType: 'CODE_GENERATE',
        summary: expect.stringContaining('生成代码'),
        entities: expect.arrayContaining(['code']),
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: expect.any(Number),
        decision: expect.any(String)
      });
    });

    it('应该在记忆记录失败时不影响主流程', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        },
        selection: {
          active: { line: 0, character: 0 }
        },
        edit: jest.fn().mockResolvedValue(true)
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试需求');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(check) 插入到当前位置'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      mockEpisodicMemory.record.mockRejectedValue(new Error('数据库错误'));

      // Act & Assert - 不应抛出异常
      await expect(command.execute()).resolves.not.toThrow();
      
      // 验证其他步骤仍正常执行
      expect(mockEditor.edit).toHaveBeenCalled();
    });
  });

  describe('进度提示', () => {
    it('应该显示进度提示', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(copy) 复制到剪贴板'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.window.withProgress).toHaveBeenCalled();
    });
  });

  describe('操作选项处理', () => {
    it('应该处理插入到当前位置', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        },
        selection: {
          active: { line: 0, character: 0 }
        },
        edit: jest.fn().mockResolvedValue(true)
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(check) 插入到当前位置'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(mockEditor.edit).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('✅ 代码已插入');
    });

    it('应该处理创建新文件', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(new-file) 创建新文件'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('✅ 新文件已创建')
      );
    });

    it('应该处理重新生成', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock)
        .mockResolvedValueOnce('测试')
        .mockResolvedValueOnce(undefined); // 第二次取消
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(refresh) 重新生成'
      });

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(mockLLMTool.call).toHaveBeenCalled();
    });

    it('应该在用户取消选择时不执行操作', async () => {
      // Arrange
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        },
        edit: jest.fn()
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '```typescript\nconst x = 42;\n```'
      });

      // Act
      await command.execute();

      // Assert
      expect(mockEditor.edit).not.toHaveBeenCalled();
    });

    it('应该输入超过500字符时显示验证错误', async () => {
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      
      // Mock showInputBox调用validateInput
      const longInput = 'a'.repeat(501);
      (vscode.window.showInputBox as jest.Mock).mockImplementation(async (options) => {
        // 模拟验证
        const validationResult = options.validateInput(longInput);
        expect(validationResult).toBe('需求不能超过500个字符');
        return null; // 用户取消
      });

      await command.execute();
    });

    it('应该LLM调用失败时显示错误', async () => {
      const mockEditor = {
        document: {
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('')
        },
        selection: {
          active: { line: 0, character: 0 }
        }
      };
      (vscode.window.activeTextEditor as any) = mockEditor;
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue('测试需求');
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: '$(check) 插入到当前位置'
      });

      mockLLMTool.call.mockResolvedValue({
        success: false,
        error: 'LLM调用失败'
      });

      await command.execute();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('代码生成失败')
      );
    });
  });
});
