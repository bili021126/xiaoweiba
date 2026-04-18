import 'reflect-metadata';
import { AICompletionProvider } from '../../../src/completion/AICompletionProvider';
import { LLMTool } from '../../../src/tools/LLMTool';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  InlineCompletionItem: jest.fn().mockImplementation((text) => ({ text })),
  Range: jest.fn(),
  Position: jest.fn()
}));

describe('AICompletionProvider - AI代码补全提供器', () => {
  let provider: AICompletionProvider;
  let mockLLMTool: any;
  let mockConfigManager: any;

  beforeEach(() => {
    // 创建Mock对象
    mockLLMTool = {
      call: jest.fn()
    };

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        inlineCompletion: {
          enabled: true,
          triggerDelayMs: 300,
          maxTokens: 50,
          enableCache: true,
          cacheTTLSeconds: 5
        }
      })
    };

    provider = new AICompletionProvider(mockLLMTool, mockConfigManager);
  });

  describe('provideInlineCompletionItems - 提供补全项', () => {
    it('应该在功能禁用时返回null', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        inlineCompletion: {
          enabled: false
        }
      });

      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      expect(result).toBeNull();
    });

    it('应该在触发间隔内返回null', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      // 第一次调用
      mockLLMTool.call.mockResolvedValue({ success: true, data: '1;' });
      await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      // 立即第二次调用（未到达触发间隔）
      const result = await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      expect(result).toBeNull();
    });

    it('应该在前缀太短时返回null', async () => {
      const mockDocument = createMockDocument('x', 'typescript');
      const mockPosition = createMockPosition(0, 1);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      expect(result).toBeNull();
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该正确调用LLM并返回补全结果', async () => {
      const code = 'const x = ';
      const mockDocument = createMockDocument(code, 'typescript');
      const mockPosition = createMockPosition(0, code.length);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '42;'
      });

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      // 验证LLM被调用
      expect(mockLLMTool.call).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('typescript')
          })
        ]),
        maxTokens: 50,
        temperature: 0.2
      }));

      // 验证返回结果
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      if (Array.isArray(result)) {
        expect((result[0] as any).text).toBe('42;');
      }
    });

    it('应该在LLM调用失败时返回null', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      mockLLMTool.call.mockRejectedValue(new Error('LLM调用失败'));

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      expect(result).toBeNull();
    });

    it('应该在取消令牌触发时返回null', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken(true); // 已取消

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      expect(result).toBeNull();
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });

    it('应该在缓存命中时直接返回', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      // 第一次调用，填充缓存
      mockLLMTool.call.mockResolvedValue({ success: true, data: '1;' });
      await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      // 等待触发延迟
      await new Promise(resolve => setTimeout(resolve, 350));

      // 第二次调用，应该命中缓存
      mockLLMTool.call.mockClear();
      const result = await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(mockLLMTool.call).not.toHaveBeenCalled(); // 未调用LLM
    });

    it('应该LLM返回空时返回null', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken(false);

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '   '
      });

      const result = await provider.provideInlineCompletionItems(
        mockDocument,
        mockPosition,
        mockContext,
        mockToken
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanMarkdown - Markdown清理', () => {
    it('应该移除代码块标记', () => {
      const input = '```typescript\nconst x = 1;\n```';
      const output = (provider as any).cleanMarkdown(input);
      
      expect(output).toBe('const x = 1;');
    });

    it('应该移除行内代码标记', () => {
      const input = '使用 `console.log()` 输出';
      const output = (provider as any).cleanMarkdown(input);
      
      expect(output).toBe('使用 console.log() 输出');
    });

    it('应该处理多行代码块', () => {
      const input = '```javascript\nfunction test() {\n  return 1;\n}\n```';
      const output = (provider as any).cleanMarkdown(input);
      
      expect(output).toContain('function test()');
      expect(output).not.toContain('```');
    });

    it('应该保留普通文本', () => {
      const input = 'const x = 1;';
      const output = (provider as any).cleanMarkdown(input);
      
      expect(output).toBe('const x = 1;');
    });
  });

  describe('缓存机制', () => {
    it('应该在TTL过期后清除缓存', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      // 第一次调用，填充缓存
      mockLLMTool.call.mockResolvedValue({ success: true, data: '1;' });
      await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      // 等待缓存过期（TTL=5秒）+ 触发延迟
      await new Promise(resolve => setTimeout(resolve, 5350));

      // 第二次调用，缓存已过期
      mockLLMTool.call.mockResolvedValue({ success: true, data: '2;' });
      const result = await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect((result[0] as any).text).toBe('2;'); // 新值
      }
    });

    it('应该在缓存满时删除最旧的条目', async () => {
      // 设置最大缓存为2以便测试
      (provider as any).MAX_CACHE_SIZE = 2;

      const mockToken = createMockCancellationToken();
      const mockContext = {} as vscode.InlineCompletionContext;

      // 填充缓存
      for (let i = 0; i < 3; i++) {
        const mockDocument = createMockDocument(`const x${i} = `, 'typescript');
        const mockPosition = createMockPosition(0, 10);
        
        mockLLMTool.call.mockResolvedValue({ success: true, data: `${i};` });
        
        await provider.provideInlineCompletionItems(
          mockDocument, mockPosition, mockContext, mockToken
        );

        // 等待触发延迟
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      // 缓存大小不应超过限制
      expect((provider as any).cache.size).toBeLessThanOrEqual(2);
    });
  });

  describe('clearCache - 清空缓存', () => {
    it('应该清空所有缓存', async () => {
      const mockDocument = createMockDocument('const x = ', 'typescript');
      const mockPosition = createMockPosition(0, 9);
      const mockContext = {} as vscode.InlineCompletionContext;
      const mockToken = createMockCancellationToken();

      // 填充缓存
      mockLLMTool.call.mockResolvedValue({ success: true, data: '1;' });
      await provider.provideInlineCompletionItems(
        mockDocument, mockPosition, mockContext, mockToken
      );

      expect((provider as any).cache.size).toBeGreaterThan(0);

      // 清空缓存
      provider.clearCache();

      expect((provider as any).cache.size).toBe(0);
    });
  });
});

// 辅助函数
function createMockDocument(content: string, languageId: string): vscode.TextDocument {
  return {
    uri: { fsPath: '/test/file.ts' },
    languageId,
    getText: jest.fn().mockReturnValue(content),
    lineAt: jest.fn().mockReturnValue({ text: content }),
    offsetAt: jest.fn().mockReturnValue(content.length)
  } as any;
}

function createMockPosition(line: number, character: number): vscode.Position {
  return {
    line,
    character
  } as any;
}

function createMockCancellationToken(isCancelled: boolean = false): vscode.CancellationToken {
  return {
    isCancellationRequested: isCancelled,
    onCancellationRequested: jest.fn()
  } as any;
}
