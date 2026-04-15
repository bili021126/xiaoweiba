import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatViewProvider } from '../../../src/chat/ChatViewProvider';
import { ContextBuilder } from '../../../src/chat/ContextBuilder';
import { PromptEngine } from '../../../src/chat/PromptEngine';
import { SessionManager } from '../../../src/chat/SessionManager';
import { LLMTool } from '../../../src/tools/LLMTool';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../../src/core/memory/PreferenceMemory';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn(),
  WebviewView: jest.fn(),
  CancellationToken: jest.fn(),
  window: {
    showErrorMessage: jest.fn()
  },
  languages: {
    registerInlineCompletionItemProvider: jest.fn()
  }
}));

describe('ChatViewProvider - 聊天视图提供者', () => {
  let chatViewProvider: ChatViewProvider;
  let mockContext: any;
  let mockLLMTool: any;
  let mockEpisodicMemory: any;
  let mockPreferenceMemory: any;
  let mockConfigManager: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    // 创建Mock对象
    mockContext = {
      extensionUri: { fsPath: '/test' },
      workspaceState: {
        get: jest.fn(),
        update: jest.fn()
      },
      subscriptions: []
    };

    mockLLMTool = {
      call: jest.fn(),
      callStream: jest.fn()
    };

    mockEpisodicMemory = {
      record: jest.fn(),
      retrieve: jest.fn(),
      search: jest.fn()
    };

    mockPreferenceMemory = {
      getRecommendations: jest.fn(),
      queryPreferences: jest.fn()
    };

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        chat: {
          maxHistoryMessages: 20,
          autoGenerateTitle: true
        }
      })
    };

    mockAuditLogger = {
      log: jest.fn(),
      logError: jest.fn()
    };

    // 创建ChatViewProvider实例
    chatViewProvider = new ChatViewProvider(
      mockContext,
      mockLLMTool,
      mockEpisodicMemory,
      mockPreferenceMemory,
      mockConfigManager,
      mockAuditLogger
    );
  });

  describe('构造函数', () => {
    it('应该正确初始化所有依赖', () => {
      expect(chatViewProvider).toBeDefined();
      expect((chatViewProvider as any).sessionManager).toBeInstanceOf(SessionManager);
      expect((chatViewProvider as any).contextBuilder).toBeInstanceOf(ContextBuilder);
      expect((chatViewProvider as any).promptEngine).toBeInstanceOf(PromptEngine);
    });
  });

  describe('resolveWebviewView - Webview视图解析', () => {
    it('应该正确设置webview并加载会话', async () => {
      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn()
        }
      };

      await chatViewProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

      expect(mockWebviewView.webview.options).toHaveProperty('enableScripts', true);
      expect(mockWebviewView.webview.html).toContain('小尾巴AI助手');
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('应该处理switchSession消息', async () => {
      // 先创建会话
      (chatViewProvider as any).sessionManager.createSession();
      const sessionId = (chatViewProvider as any).sessionManager.getCurrentSession()?.id;

      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          onDidReceiveMessage: jest.fn((cb) => {
            setTimeout(() => cb({ type: 'switchSession', sessionId }), 0);
          }),
          postMessage: jest.fn()
        }
      };

      await chatViewProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
    });

    it('应该处理deleteSession消息', async () => {
      // 创建2个会话，删除其中一个
      (chatViewProvider as any).sessionManager.createSession();
      (chatViewProvider as any).sessionManager.createSession();
      const sessionId = (chatViewProvider as any).sessionManager.getCurrentSession()?.id;

      const mockWebviewView = {
        webview: {
          options: {},
          html: '',
          onDidReceiveMessage: jest.fn((cb) => {
            setTimeout(() => cb({ type: 'deleteSession', sessionId }), 0);
          }),
          postMessage: jest.fn()
        }
      };

      await chatViewProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('handleUserMessage - 处理用户消息', () => {
    it('应该在view未初始化时显示错误', async () => {
      await chatViewProvider.handleUserMessage('测试消息');
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('聊天面板未初始化');
    });

    it('应该contextBuilder失败时发送错误消息', async () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      jest.spyOn((chatViewProvider as any).contextBuilder, 'build').mockRejectedValue(
        new Error('上下文构建失败')
      );

      await chatViewProvider.handleUserMessage('测试消息');

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'errorMessage',
          error: '上下文构建失败'
        })
      );
    });

    it('应该正确处理用户消息并返回AI响应', async () => {
      // Mock view
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      // Mock LLM响应
      mockLLMTool.callStream.mockResolvedValue({
        success: true,
        data: '这是AI的回答'
      });

      // Mock上下文构建
      jest.spyOn((chatViewProvider as any).contextBuilder, 'build').mockResolvedValue({
        messages: [{ role: 'user', content: '测试' }],
        systemPrompt: '系统提示'
      });

      await chatViewProvider.handleUserMessage('测试消息');

      // 验证用户消息已发送
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'addMessage',
          message: expect.objectContaining({
            role: 'user',
            content: '测试消息'
          })
        })
      );

      // 验证流式响应开始
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'startStreaming'
        })
      );

      // 验证审计日志
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'chat_message',
        'success',
        expect.any(Number),
        expect.objectContaining({
          parameters: expect.objectContaining({
            messageLength: 4
          })
        })
      );
    });

    it('应该正确处理LLM调用失败', async () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      mockLLMTool.callStream.mockRejectedValue(new Error('LLM调用失败'));

      jest.spyOn((chatViewProvider as any).contextBuilder, 'build').mockResolvedValue({
        messages: [],
        systemPrompt: ''
      });

      await chatViewProvider.handleUserMessage('测试');

      // 验证错误消息已发送
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamError',
          error: 'LLM调用失败'
        })
      );
    });
  });

  describe('streamResponse - 流式响应', () => {
    it('应该正确处理流式响应', async () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      const assistantMessage = {
        id: 'msg_123',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now()
      };

      // Mock流式调用
      mockLLMTool.callStream.mockImplementation(async (config: any, onChunk: (chunk: string) => void) => {
        onChunk('块1');
        onChunk('块2');
        return { success: true, data: '块1块2' };
      });

      await (chatViewProvider as any).streamResponse(
        [{ role: 'user', content: '测试' }],
        '系统提示',
        assistantMessage
      );

      // 验证流式消息
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamChunk',
          chunk: '块1'
        })
      );

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'endStreaming',
          content: '块1块2'
        })
      );

      expect(assistantMessage.content).toBe('块1块2');
    });

    it('应该LLM调用失败时发送错误消息', async () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      mockLLMTool.callStream.mockRejectedValue(new Error('LLM调用失败'));

      const assistantMessage = {
        id: 'msg_test',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now()
      };

      await (chatViewProvider as any).streamResponse(
        [{ role: 'user', content: '测试' }],
        '系统提示',
        assistantMessage
      );

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamError',
          error: expect.any(String)
        })
      );

      expect(assistantMessage.content).toContain('错误');
    });

    it('应该LLM返回失败时设置错误消息', async () => {
      const mockWebview = {
        postMessage: jest.fn()
      };
      (chatViewProvider as any).view = { webview: mockWebview };

      mockLLMTool.callStream.mockResolvedValue({ success: false, error: 'API错误' });

      const assistantMessage = {
        id: 'msg_test',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now()
      };

      await (chatViewProvider as any).streamResponse(
        [{ role: 'user', content: '测试' }],
        '系统提示',
        assistantMessage
      );

      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streamError',
          error: 'API错误'
        })
      );

      expect(assistantMessage.content).toContain('API错误');
    });
  });

  describe('getHtmlForWebview - Webview HTML生成', () => {
    it('应该生成包含必要CDN的HTML', () => {
      const mockWebview = {
        cspSource: 'vscode-resource:',
        asWebviewUri: jest.fn()
      };

      const html = (chatViewProvider as any).getHtmlForWebview(mockWebview);

      expect(html).toContain('DOMPurify');
      expect(html).toContain('marked');
      expect(html).toContain('highlight.js');
      expect(html).toContain('Content-Security-Policy');
    });

    it('应该配置严格的CSP策略', () => {
      const mockWebview = {
        cspSource: 'vscode-resource:',
        asWebviewUri: jest.fn()
      };

      const html = (chatViewProvider as any).getHtmlForWebview(mockWebview);

      expect(html).toContain("script-src https://cdn.jsdelivr.net");
      // style-src 需要 'unsafe-inline' 以支持动态样式
      expect(html).toContain("style-src");
      expect(html).toContain("'unsafe-inline'");
      // 但 script-src 不应该有 'unsafe-inline'
      expect(html).toMatch(/script-src https:\/\/cdn\.jsdelivr\.net(?!.*'unsafe-inline')/);
    });
  });
});
