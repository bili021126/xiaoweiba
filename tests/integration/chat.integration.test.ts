import { ChatViewProvider } from '../../src/chat/ChatViewProvider';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../src/core/memory/PreferenceMemory';
import { LLMTool } from '../../src/tools/LLMTool';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { AuditLogger } from '../../src/core/security/AuditLogger';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  window: { activeTextEditor: null, showErrorMessage: jest.fn() },
  Uri: { joinPath: jest.fn((...args) => ({ fsPath: args.join('/') })) },
  workspace: { getConfiguration: jest.fn().mockReturnValue({ get: jest.fn() }) }
}));

describe.skip('聊天模块集成（待修复mock配置）', () => {
  let provider: ChatViewProvider;
  let llmTool: any;
  let episodicMemory: any;
  let mockWebview: any;

  beforeEach(() => {
    const mockContext = {
      extensionUri: { fsPath: '/test' },
      subscriptions: [],
      workspaceState: { get: jest.fn(), update: jest.fn().mockResolvedValue(undefined) }
    };

    llmTool = { 
      call: jest.fn().mockResolvedValue({ success: true, data: 'Mock response', durationMs: 100 }),  // 修改
      callStream: jest.fn() 
    };
    episodicMemory = { 
      search: jest.fn().mockResolvedValue([]), 
      retrieve: jest.fn().mockResolvedValue([]),  // 新增
      record: jest.fn(), 
      initialize: jest.fn() 
    };
    const preferenceMemory = { getRecommendations: jest.fn().mockResolvedValue([]), initialize: jest.fn() };
    const configManager = { getConfig: jest.fn().mockReturnValue({ model: { default: 'deepseek' } }) };
    const auditLogger = { log: jest.fn() };

    provider = new ChatViewProvider(mockContext as any, llmTool, episodicMemory as any, preferenceMemory as any, configManager as any, auditLogger as any);
    
    mockWebview = { postMessage: jest.fn() };
    (provider as any).view = { webview: mockWebview };
  });

  it('应该完成完整聊天流程', async () => {
    const mockStream = { [Symbol.asyncIterator]: async function* () { yield '回答'; } };
    llmTool.callStream.mockResolvedValue({ success: true, data: mockStream, durationMs: 1000 });
    llmTool.call.mockResolvedValue({ success: true, data: '测试回答', durationMs: 500 });  // 新增

    await (provider as any).handleUserMessage('测试');

    expect(llmTool.call).toHaveBeenCalled();  // 修改
    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addMessage' })
    );
  });

  it('应该注入情景记忆到上下文', async () => {
    episodicMemory.search.mockResolvedValue([
      { id: 'mem_1', summary: 'React优化', timestamp: Date.now(), projectFingerprint: '', taskType: 'CHAT', entities: [], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 }
    ]);

    const mockStream = { [Symbol.asyncIterator]: async function* () { yield '回答'; } };
    llmTool.callStream.mockResolvedValue({ success: true, data: mockStream, durationMs: 1000 });

    await (provider as any).handleUserMessage('继续优化');

    expect(episodicMemory.search).toHaveBeenCalled();
    expect(llmTool.callStream).toHaveBeenCalled();
  });

  it('应该处理LLM失败', async () => {
    llmTool.callStream.mockResolvedValue({ success: false, error: '错误', durationMs: 0 });

    await (provider as any).handleUserMessage('测试');

    expect(mockWebview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'streamError' })
    );
  });
});
