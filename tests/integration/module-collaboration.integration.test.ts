import { ChatViewProvider } from '../../src/chat/ChatViewProvider';
import { AICompletionProvider } from '../../src/completion/AICompletionProvider';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../src/core/memory/PreferenceMemory';
import { LLMTool } from '../../src/tools/LLMTool';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { AuditLogger } from '../../src/core/security/AuditLogger';

jest.mock('vscode', () => ({
  window: { activeTextEditor: null },
  Uri: { joinPath: jest.fn((...args) => ({ fsPath: args.join('/') })) },
  workspace: { getConfiguration: jest.fn().mockReturnValue({ get: jest.fn() }) },
  InlineCompletionItem: jest.fn(),
  Range: jest.fn(),
  Position: jest.fn()
}));

describe('模块协同测试', () => {
  let llmTool: any;
  let episodicMemory: any;
  let preferenceMemory: any;
  let configManager: any;
  let auditLogger: any;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      extensionUri: { fsPath: '/test' },
      subscriptions: [],
      workspaceState: { get: jest.fn(), update: jest.fn().mockResolvedValue(undefined) }
    };

    llmTool = { call: jest.fn(), callStream: jest.fn() };
    episodicMemory = { search: jest.fn().mockResolvedValue([]), record: jest.fn().mockResolvedValue(undefined), initialize: jest.fn() };
    preferenceMemory = { getRecommendations: jest.fn().mockResolvedValue([]), initialize: jest.fn() };
    configManager = { getConfig: jest.fn().mockReturnValue({ model: { default: 'deepseek' }, inlineCompletion: { enabled: true, triggerDelay: 300, minPrefixLength: 5 } }) };
    auditLogger = { log: jest.fn() };
  });

  it('应该完成聊天+记忆记录+偏好匹配的完整闭环', async () => {
    const chatProvider = new ChatViewProvider(
      mockContext as any, llmTool, episodicMemory as any, preferenceMemory as any, configManager as any, auditLogger as any
    );

    const mockWebview = { postMessage: jest.fn() };
    (chatProvider as any).view = { webview: mockWebview };

    // Mock情景记忆返回
    episodicMemory.search.mockResolvedValue([
      { id: 'mem_1', summary: '之前优化过React组件', timestamp: Date.now(), projectFingerprint: '', taskType: 'CHAT', entities: ['React'], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 }
    ]);

    // Mock偏好匹配
    preferenceMemory.getRecommendations.mockResolvedValue([
      { record: { pattern: { style: 'functional' } } }
    ]);

    const mockStream = { [Symbol.asyncIterator]: async function* () { yield '基于之前的React优化经验...'; } };
    llmTool.callStream.mockResolvedValue({ success: true, data: mockStream, durationMs: 1500 });

    await (chatProvider as any).handleUserMessage('继续优化React组件');

    // 验证记忆被检索
    expect(episodicMemory.search).toHaveBeenCalled();
    // 验证偏好被注入
    expect(preferenceMemory.getRecommendations).toHaveBeenCalled();
    // 验证LLM被调用
    expect(llmTool.callStream).toHaveBeenCalled();
  });

  it('应该完成补全+缓存+审计的协同', async () => {
    const completionProvider = new AICompletionProvider(llmTool as any, configManager as any);

    const mockDocument = {
      getText: jest.fn().mockReturnValue('const sum = add('),
      languageId: 'typescript',
      uri: { fsPath: '/test/file.ts' }
    };
    const mockPosition = { line: 0, character: 16 };
    const mockContext = { triggerKind: 0 };
    const mockToken = { isCancellationRequested: false };

    llmTool.call.mockResolvedValue({ success: true, data: '1, 2);', durationMs: 500 });

    // 第一次调用
    await completionProvider.provideInlineCompletionItems(
      mockDocument as any, mockPosition as any, mockContext as any, mockToken as any
    );

    // 第二次相同请求应命中缓存
    await completionProvider.provideInlineCompletionItems(
      mockDocument as any, mockPosition as any, mockContext as any, mockToken as any
    );

    expect(llmTool.call).toHaveBeenCalledTimes(1);
  });

  it('应该在聊天失败时不影响补全功能', async () => {
    const chatProvider = new ChatViewProvider(
      mockContext as any, llmTool, episodicMemory as any, preferenceMemory as any, configManager as any, auditLogger as any
    );
    const completionProvider = new AICompletionProvider(llmTool as any, configManager as any);

    const mockWebview = { postMessage: jest.fn() };
    (chatProvider as any).view = { webview: mockWebview };

    // 聊天失败
    llmTool.callStream.mockResolvedValue({ success: false, error: '网络错误', durationMs: 0 });
    await (chatProvider as any).handleUserMessage('测试');

    // 补全仍应正常工作
    llmTool.call.mockResolvedValue({ success: true, data: ';', durationMs: 500 });
    const mockDocument = { getText: jest.fn().mockReturnValue('const x'), languageId: 'typescript', uri: { fsPath: '/test.ts' } };
    const result = await completionProvider.provideInlineCompletionItems(
      mockDocument as any, { line: 0, character: 7 } as any, { triggerKind: 0 } as any, { isCancellationRequested: false } as any
    );

    expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'streamError' }));
    expect(result).not.toBeNull();
  });

  it('应该共享LLM调用审计日志', async () => {
    const chatProvider = new ChatViewProvider(
      mockContext as any, llmTool, episodicMemory as any, preferenceMemory as any, configManager as any, auditLogger as any
    );
    const mockWebview = { postMessage: jest.fn() };
    (chatProvider as any).view = { webview: mockWebview };

    const mockStream = { [Symbol.asyncIterator]: async function* () { yield '回答'; } };
    llmTool.callStream.mockResolvedValue({ success: true, data: mockStream, durationMs: 1000 });

    await (chatProvider as any).handleUserMessage('测试');

    expect(auditLogger.log).toHaveBeenCalledWith(
      'chat_message',
      'success',
      expect.any(Number),
      expect.objectContaining({
        parameters: expect.objectContaining({
          messageLength: expect.any(Number)
        })
      })
    );
  });
});
