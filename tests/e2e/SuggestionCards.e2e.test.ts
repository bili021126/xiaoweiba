/**
 * 推荐操作卡片 E2E 测试 - 验证前端渲染与后端消息联动
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatViewProvider } from '../../src/chat/ChatViewProvider';
import { IEventBus } from '../../src/core/ports/IEventBus';
import { IntentDispatcher } from '../../src/core/application/IntentDispatcher';
import { IMemoryPort } from '../../src/core/ports/IMemoryPort';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: {
      document: {
        fileName: '/test/path/file.ts',
        languageId: 'typescript'
      }
    }
  },
  ExtensionContext: jest.fn()
}));

describe('Suggestion Cards E2E Tests', () => {
  let provider: ChatViewProvider;
  let mockEventBus: Partial<IEventBus>;
  let mockDispatcher: Partial<IntentDispatcher>;
  let mockMemoryPort: Partial<IMemoryPort>;
  let mockContext: Partial<vscode.ExtensionContext>;

  beforeEach(() => {
    container.clearInstances();

    mockEventBus = { subscribe: jest.fn(), publish: jest.fn() };
    mockDispatcher = { dispatch: jest.fn() };
    mockMemoryPort = { retrieveContext: jest.fn() };
    mockContext = { 
      workspaceState: { get: jest.fn(), update: jest.fn() },
      extensionUri: { fsPath: '/test' }
    } as any;

    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance(IntentDispatcher, mockDispatcher as IntentDispatcher);
    container.registerInstance('IMemoryPort', mockMemoryPort as IMemoryPort);
    container.registerInstance('extensionContext', mockContext);

    provider = container.resolve(ChatViewProvider);
  });

  it('should generate suggestions for TypeScript files', async () => {
    // 模拟 Webview 消息发送
    const mockWebview = {
      postMessage: jest.fn()
    };

    (provider as any).view = { webview: mockWebview };
    
    await (provider as any).updateSuggestionCards();

    expect(mockWebview.postMessage).toHaveBeenCalledWith({
      type: 'updateSuggestions',
      suggestions: expect.arrayContaining([
        expect.objectContaining({ intent: 'generate_test' }),
        expect.objectContaining({ intent: 'explain_code' })
      ])
    });
  });

  it('should not generate suggestions when no editor is open', async () => {
    (vscode.window as any).activeTextEditor = null;
    const mockWebview = { postMessage: jest.fn() };
    (provider as any).view = { webview: mockWebview };

    await (provider as any).updateSuggestionCards();

    expect(mockWebview.postMessage).not.toHaveBeenCalled();
  });
});
