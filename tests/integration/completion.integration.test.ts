import { AICompletionProvider } from '../../src/completion/AICompletionProvider';
import { LLMTool } from '../../src/tools/LLMTool';
import { ConfigManager } from '../../src/storage/ConfigManager';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  InlineCompletionItem: jest.fn(),
  Range: jest.fn(),
  Position: jest.fn()
}));

describe('补全模块集成', () => {
  let provider: AICompletionProvider;
  let llmTool: any;
  let configManager: any;

  beforeEach(() => {
    llmTool = { call: jest.fn() };
    configManager = { 
      getConfig: jest.fn().mockReturnValue({
        inlineCompletion: { enabled: true, triggerDelay: 300, minPrefixLength: 5 },
        model: { default: 'deepseek' }
      })
    };

    provider = new AICompletionProvider(llmTool as any, configManager as any);
  });

  it('应该完成完整补全流程', async () => {
    const mockDocument = {
      getText: jest.fn().mockReturnValue('const result = add(1, '),
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' }
    };
    const mockPosition = { line: 0, character: 20 };
    const mockContext = { triggerKind: 0 };
    const mockToken = { isCancellationRequested: false };

    llmTool.call.mockResolvedValue({ success: true, data: '2);', durationMs: 500 });

    const result = await provider.provideInlineCompletionItems(
      mockDocument as any,
      mockPosition as any,
      mockContext as any,
      mockToken as any
    );

    expect(llmTool.call).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });

  it('应该使用缓存加速重复补全', async () => {
    const mockDocument = {
      getText: jest.fn().mockReturnValue('const x = 1'),
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' }
    };
    const mockPosition = { line: 0, character: 11 };
    const mockContext = { triggerKind: 0 };
    const mockToken = { isCancellationRequested: false };

    llmTool.call.mockResolvedValue({ success: true, data: ';', durationMs: 500 });

    // 第一次调用
    await provider.provideInlineCompletionItems(
      mockDocument as any,
      mockPosition as any,
      mockContext as any,
      mockToken as any
    );

    // 第二次相同请求应命中缓存
    await provider.provideInlineCompletionItems(
      mockDocument as any,
      mockPosition as any,
      mockContext as any,
      mockToken as any
    );

    expect(llmTool.call).toHaveBeenCalledTimes(1);
  });

  it('应该处理LLM失败', async () => {
    const mockDocument = {
      getText: jest.fn().mockReturnValue('const y = '),
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' }
    };
    const mockPosition = { line: 0, character: 10 };
    const mockContext = { triggerKind: 0 };
    const mockToken = { isCancellationRequested: false };

    llmTool.call.mockResolvedValue({ success: false, error: '错误', durationMs: 0 });

    const result = await provider.provideInlineCompletionItems(
      mockDocument as any,
      mockPosition as any,
      mockContext as any,
      mockToken as any
    );

    expect(result).toBeNull();
  });

  it('应该在取消时中断', async () => {
    const mockDocument = {
      getText: jest.fn().mockReturnValue('const z = '),
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' }
    };
    const mockPosition = { line: 0, character: 10 };
    const mockContext = { triggerKind: 0 };
    const mockToken = { isCancellationRequested: true };

    const result = await provider.provideInlineCompletionItems(
      mockDocument as any,
      mockPosition as any,
      mockContext as any,
      mockToken as any
    );

    expect(result).toBeNull();
    expect(llmTool.call).not.toHaveBeenCalled();
  });
});
