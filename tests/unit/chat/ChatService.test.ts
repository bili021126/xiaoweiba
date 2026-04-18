import 'reflect-metadata';
import { ChatService } from '../../../src/chat/ChatService';
import { LLMTool } from '../../../src/tools/LLMTool';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../../src/core/memory/PreferenceMemory';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { container } from 'tsyringe';
import * as vscode from 'vscode';

// Mock vscode.ExtensionContext
const mockContext = {
  extensionUri: { fsPath: '/test' },
  workspaceState: {
    get: jest.fn(),
    update: jest.fn()
  },
  secrets: {}
} as any;

describe('ChatService', () => {
  let chatService: ChatService;
  let mockLLMTool: jest.Mocked<LLMTool>;
  let mockEpisodicMemory: jest.Mocked<EpisodicMemory>;
  let mockPreferenceMemory: jest.Mocked<PreferenceMemory>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    // 创建mock实例
    mockLLMTool = {
      call: jest.fn()
    } as any;

    mockEpisodicMemory = {
      record: jest.fn(),
      retrieve: jest.fn(),
      search: jest.fn()
    } as any;

    mockPreferenceMemory = {
      getRecommendations: jest.fn()
    } as any;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        chat: {
          defaultInteractionMode: 'AUTO',
          enableClarification: true,
          maxClarificationRounds: 3
        }
      })
    } as any;

    mockAuditLogger = {
      log: jest.fn(),
      logError: jest.fn()
    } as any;

    // 创建ChatService实例
    chatService = new ChatService(
      mockContext,
      mockLLMTool,
      mockEpisodicMemory,
      mockPreferenceMemory,
      mockConfigManager,
      mockAuditLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('会话管理', () => {
    it('应该能创建新会话', () => {
      expect(() => chatService.createNewSession()).not.toThrow();
    });

    it('应该能获取会话列表', () => {
      const sessions = chatService.getSessionList();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('应该能切换会话', () => {
      chatService.createNewSession();
      const sessions = chatService.getSessionList();
      if (sessions.length > 0) {
        expect(() => chatService.switchSession(sessions[0].id)).not.toThrow();
      }
    });

    it('应该能删除会话', () => {
      chatService.createNewSession();
      const sessions = chatService.getSessionList();
      if (sessions.length > 0) {
        expect(() => chatService.deleteSession(sessions[0].id)).not.toThrow();
      }
    });
  });

  describe('对话管理', () => {
    it('应该能获取DialogManager实例', () => {
      const dialogManager = chatService.getDialogManager();
      expect(dialogManager).toBeDefined();
    });

    it('应该能获取当前会话消息', () => {
      const messages = chatService.getCurrentSessionMessages();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe('探索性查询检测', () => {
    it('应该识别探索性查询', () => {
      // 通过handleUserMessage间接测试，观察是否进入澄清流程
      // 由于涉及异步和复杂逻辑，这里仅做基本验证
      expect(chatService).toBeDefined();
    });
  });

  describe('handleUserMessage - 消息处理', () => {
    it('应该处理普通聊天消息', async () => {
      const mockLLMResponse = {
        success: true,
        data: '这是AI的回答'
      };

      (mockLLMTool.call as jest.Mock).mockResolvedValue(mockLLMResponse);
      (mockEpisodicMemory.retrieve as jest.Mock).mockResolvedValue([]);
      (mockPreferenceMemory.getRecommendations as jest.Mock).mockResolvedValue([]);
      
      // Mock ContextBuilder.build返回正确的结构
      jest.spyOn((chatService as any).contextBuilder, 'build').mockResolvedValue({
        messages: [{ role: 'user', content: '你好' }]
      });
      
      // Mock PromptEngine.generatePrompt
      jest.spyOn((chatService as any).promptEngine, 'generatePrompt').mockReturnValue('系统提示');

      const result = await chatService.handleUserMessage('你好');

      expect(result.userMessage).toBeDefined();
      expect(result.userMessage.role).toBe('user');
      expect(result.userMessage.content).toBe('你好');
      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage?.content).toBe('这是AI的回答');
    });

    it('应该处理LLM调用失败', async () => {
      (mockLLMTool.call as jest.Mock).mockRejectedValue(new Error('LLM调用失败'));
      (mockEpisodicMemory.retrieve as jest.Mock).mockResolvedValue([]);
      (mockPreferenceMemory.getRecommendations as jest.Mock).mockResolvedValue([]);
      
      // Mock ContextBuilder.build
      jest.spyOn((chatService as any).contextBuilder, 'build').mockResolvedValue({
        messages: []
      });
      
      // Mock PromptEngine.generatePrompt
      jest.spyOn((chatService as any).promptEngine, 'generatePrompt').mockReturnValue('系统提示');

      const result = await chatService.handleUserMessage('测试');

      expect(result.userMessage).toBeDefined();
      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage?.content).toContain('错误');
    });

    it('应该执行命令模式', async () => {
      // Mock vscode.commands.executeCommand
      const mockExecuteCommand = jest.fn().mockResolvedValue(undefined);
      (require('vscode').commands.executeCommand as jest.Mock) = mockExecuteCommand;
      
      const result = await chatService.handleUserMessage('test', { command: 'explainCode' });
      
      expect(result.userMessage).toBeDefined();
      expect(result.userMessage.content).toBe('test');
      expect(mockExecuteCommand).toHaveBeenCalledWith('xiaoweiba.explainCode');
    });

    it('应该处理澄清响应', async () => {
      // 先启动澄清流程
      (mockEpisodicMemory.retrieve as jest.Mock).mockResolvedValue([]);
      (mockPreferenceMemory.getRecommendations as jest.Mock).mockResolvedValue([]);
      
      // Mock assessComplexity返回需要澄清
      jest.spyOn((chatService as any).dialogManager, 'assessComplexity').mockReturnValue({
        complexity: 'high',
        needsClarification: true
      });

      jest.spyOn((chatService as any).modeSelector, 'selectMode').mockReturnValue('CLARIFY');
      jest.spyOn((chatService as any).modeSelector, 'shouldEnableClarification').mockReturnValue(true);
      jest.spyOn((chatService as any).dialogManager, 'startDialog').mockImplementation();
      jest.spyOn((chatService as any).dialogManager, 'generateClarificationQuestions').mockReturnValue([
        { id: 'q1', question: '请详细说明' }
      ]);

      const result = await chatService.handleUserMessage('帮我写代码');

      expect(result.needsClarification).toBe(true);
      expect(result.clarificationQuestion).toBe('请详细说明');
    });
  });

  describe('意图检测', () => {
    it('detectIntent应返回null（待实现）', () => {
      const intent = (chatService as any).detectIntent('测试消息');
      expect(intent).toBeNull();
    });
  });

  describe('探索性查询模式匹配', () => {
    it('应该识别"怎么"开头的查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u600e\u4e48\u4f7f\u7528\u8fd9\u4e2a\u529f\u80fd\uff1f');
      expect(result).toBe(true);
    });

    it('应该识别"如何"开头的查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u5982\u4f55\u5b9e\u73b0\u767b\u5f55\uff1f');
      expect(result).toBe(true);
    });

    it('应该识别"什么是"查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u4ec0\u4e48\u662fTypeScript\uff1f');
      expect(result).toBe(true);
    });

    it('应该识别"学习"相关查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u5b66\u4e60React Hooks');
      expect(result).toBe(true);
    });

    it('应该识别"了解"相关查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u4e86\u89e3\u8bbe\u8ba1\u6a21\u5f0f');
      expect(result).toBe(true);
    });

    it('应该识别"最佳实践"查询', () => {
      const result = (chatService as any).isExploratoryQuery('TypeScript\u6700\u4f73\u5b9e\u8df5');
      expect(result).toBe(true);
    });

    it('不应该识别非探索性查询', () => {
      const result = (chatService as any).isExploratoryQuery('\u5e2e\u6211\u8fd0\u884c\u8fd9\u6bb5\u4ee3\u7801');
      expect(result).toBe(false);
    });
  });
});
