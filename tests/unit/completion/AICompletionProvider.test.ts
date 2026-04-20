/**
 * AICompletionProvider 简化测试 - 仅覆盖关键路径
 */

import 'reflect-metadata';
import { AICompletionProvider } from '../../../src/completion/AICompletionProvider';
import { IntentDispatcher } from '../../../src/core/application/IntentDispatcher';
import { ConfigManager } from '../../../src/storage/ConfigManager';

// Mock vscode
jest.mock('vscode', () => ({
  InlineCompletionItem: jest.fn().mockImplementation((value) => ({ value })),
  Range: jest.fn()
}));

describe('AICompletionProvider - 关键路径', () => {
  let provider: AICompletionProvider;
  let mockIntentDispatcher: jest.Mocked<IntentDispatcher>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockIntentDispatcher = {
      dispatchSync: jest.fn()
    } as any;

    mockConfigManager = {
      getConfig: jest.fn()
    } as any;

    provider = new AICompletionProvider(mockIntentDispatcher, mockConfigManager);
  });

  it('功能禁用时应返回null', async () => {
    mockConfigManager.getConfig.mockReturnValue({
      inlineCompletion: { enabled: false }
    } as any);

    const result = await provider.provideInlineCompletionItems(
      {} as any, {} as any, {} as any, {} as any
    );

    expect(result).toBeNull();
  });

  it('正常路径应调用IntentDispatcher', async () => {
    mockConfigManager.getConfig.mockReturnValue({
      inlineCompletion: {
        enabled: true,
        triggerDelayMs: 0,
        enableCache: false
      }
    } as any);

    const mockDocument = {
      getText: jest.fn().mockReturnValue('console.log('),
      languageId: 'typescript',
      uri: { fsPath: '/test.ts' },
      lineAt: jest.fn().mockReturnValue({ text: 'console.log(' })
    } as any;

    mockIntentDispatcher.dispatchSync.mockResolvedValue({
      success: true,
      data: { completion: '"hello");' }
    });

    const result = await provider.provideInlineCompletionItems(
      mockDocument,
      { line: 0, character: 12 } as any,
      {} as any,
      {} as any
    );

    expect(mockIntentDispatcher.dispatchSync).toHaveBeenCalled();
  });
});
