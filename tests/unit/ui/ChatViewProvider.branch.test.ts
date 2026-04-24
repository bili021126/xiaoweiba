/**
 * ChatViewProvider 单元测试 - 补充 UI 交互分支
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatViewProvider } from '../../../src/chat/ChatViewProvider';
import { createMockEventBus, createMockMemoryPort } from '../../__mocks__/globalMocks';
import { IntentDispatcher } from '../../../src/core/application/IntentDispatcher';
import { createMockAgentRegistry } from '../../__mocks__/globalMocks';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  WebviewView: jest.fn().mockImplementation(() => ({
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn()
    }
  })),
  Uri: {
    file: jest.fn().mockReturnValue({ fsPath: '/mock/path' })
  },
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('ChatViewProvider (Branch Coverage)', () => {
  let provider: ChatViewProvider;
  let mockEventBus: any;
  let mockMemoryPort: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockEventBus = createMockEventBus();
    mockMemoryPort = createMockMemoryPort();
    const mockRegistry = createMockAgentRegistry();
    
    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('IAgentRegistry', mockRegistry);
    
    const intentDispatcher = container.resolve(IntentDispatcher);
    container.registerInstance(IntentDispatcher, intentDispatcher);
    
    const context = {
      extensionUri: vscode.Uri.file('/mock'),
      subscriptions: []
    } as any;
    container.registerInstance('extensionContext', context);
    
    provider = container.resolve(ChatViewProvider);
  });

  it('should resolve webview view successfully', async () => {
    const webviewView = new (vscode as any).WebviewView();
    
    await provider.resolveWebviewView(webviewView, {} as any, {} as any);
    
    expect(webviewView.webview.html).toBeDefined();
  });

  it('should handle incoming messages from webview', async () => {
    const webviewView = new (vscode as any).WebviewView();
    await provider.resolveWebviewView(webviewView, {} as any, {} as any);
    
    // 模拟接收消息
    const messageHandler = (webviewView.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
    await messageHandler({ type: 'chat_message', content: 'Hello' });
    
    expect(mockEventBus.publish).toHaveBeenCalled();
  });
});
