/**
 * ChatViewProvider 单元测试 - 验证推荐卡片与会话管理逻辑
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatViewProvider } from '../../../src/chat/ChatViewProvider';
import { IEventBus } from '../../../src/core/ports/IEventBus';
import { IntentDispatcher } from '../../../src/core/application/IntentDispatcher';
import { IMemoryPort } from '../../../src/core/ports/IMemoryPort';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  window: { activeTextEditor: null },
  ExtensionContext: jest.fn()
}));

describe('ChatViewProvider Unit Tests', () => {
  let provider: ChatViewProvider;
  let mockContext: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockContext = { 
      workspaceState: { get: jest.fn(), update: jest.fn() },
      extensionUri: { fsPath: '/test' }
    };

    const mockEventBus = { subscribe: jest.fn(), publish: jest.fn() };
    const mockDispatcher = { dispatch: jest.fn() };
    const mockMemoryPort = { retrieveContext: jest.fn() };

    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance(IntentDispatcher, mockDispatcher as unknown as IntentDispatcher);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('extensionContext', mockContext);

    provider = container.resolve(ChatViewProvider);
  });

  it('should handle new session creation', async () => {
    (provider as any).currentSessionId = undefined;
    await (provider as any).handleNewSession();
    expect((provider as any).currentSessionId).toBeDefined();
  });

  it('should not generate suggestions when no editor is open', async () => {
    const mockWebview = { postMessage: jest.fn() };
    (provider as any).view = { webview: mockWebview };
    
    await (provider as any).updateSuggestionCards();
    expect(mockWebview.postMessage).not.toHaveBeenCalled();
  });
});
