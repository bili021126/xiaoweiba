import 'reflect-metadata';
import { ContextBuilder } from '../../../src/chat/ContextBuilder';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { PreferenceMemory } from '../../../src/core/memory/PreferenceMemory';
import { SessionManager } from '../../../src/chat/SessionManager';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null
  },
  Range: jest.fn(),
  Position: jest.fn()
}));

describe('ContextBuilder - 上下文构建器', () => {
  let contextBuilder: ContextBuilder;
  let mockEpisodicMemory: any;
  let mockPreferenceMemory: any;
  let mockSessionManager: any;

  beforeEach(() => {
    // 创建Mock对象
    mockEpisodicMemory = {
      search: jest.fn()
    };

    mockPreferenceMemory = {
      getRecommendations: jest.fn()
    };

    mockSessionManager = {
      getRecentMessages: jest.fn()
    };

    contextBuilder = new ContextBuilder(
      mockEpisodicMemory,
      mockPreferenceMemory,
      mockSessionManager
    );
  });

  describe('build - 构建上下文', () => {
    it('应该正确收集所有上下文信息', async () => {
      const userMessage = '如何优化这段代码？';
      
      // Mock会话历史
      mockSessionManager.getRecentMessages.mockReturnValue([
        { role: 'user', content: '之前的消息' },
        { role: 'assistant', content: '之前的回答' }
      ]);

      // Mock情景记忆 - 需要至少4条才能触发跨会话分割
      mockEpisodicMemory.search.mockResolvedValue([
        { id: 'mem_1', summary: '相关记忆1', timestamp: Date.now() - 86400000 },
        { id: 'mem_2', summary: '相关记忆2', timestamp: Date.now() - 86400000 * 2 },
        { id: 'mem_3', summary: '相关记忆3', timestamp: Date.now() - 86400000 * 3 },
        { id: 'mem_4', summary: '跨会话记忆1', timestamp: Date.now() - 86400000 * 4 },
        { id: 'mem_5', summary: '跨会话记忆2', timestamp: Date.now() - 86400000 * 5 }
      ]);

      // Mock偏好记忆
      mockPreferenceMemory.getRecommendations.mockResolvedValue([
        { record: { pattern: { style: 'functional' } } }
      ]);

      const result = await contextBuilder.build({
        userMessage,
        enableCrossSession: true
      });

      expect(result.systemPrompt).toContain('relevant_memories');
      expect(result.systemPrompt).toContain('cross_session_memories');
      expect(result.systemPrompt).toContain('user_preferences');
      expect(result.messages).toHaveLength(3); // 2条历史 + 1条当前
    });

    it('应该在跨会话禁用时不检索跨会话记忆', async () => {
      mockSessionManager.getRecentMessages.mockReturnValue([]);
      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);

      await contextBuilder.build({
        userMessage: '测试',
        enableCrossSession: false
      });

      // 只调用一次search（相关记忆）
      expect(mockEpisodicMemory.search).toHaveBeenCalledTimes(1);
    });

    it('应该在跨会话启用时检索两次记忆', async () => {
      // Mock返回足够多的记忆以触发跨会话分割
      mockSessionManager.getRecentMessages.mockReturnValue([]);
      mockEpisodicMemory.search.mockResolvedValue([
        { id: 'mem_1', summary: '记忆1', timestamp: Date.now() },
        { id: 'mem_2', summary: '记忆2', timestamp: Date.now() },
        { id: 'mem_3', summary: '记忆3', timestamp: Date.now() },
        { id: 'mem_4', summary: '记忆4', timestamp: Date.now() },
        { id: 'mem_5', summary: '记忆5', timestamp: Date.now() }
      ]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);

      await contextBuilder.build({
        userMessage: '测试',
        enableCrossSession: true
      });

      // search只调用一次，但limit参数为6（enableCrossSession=true）
      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('测试', { limit: 6 });
    });
  });

  describe('编辑器上下文收集', () => {
    it('应该包含文件路径和语言信息', async () => {
      const mockEditor = {
        document: {
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue('const x = 1;')
        },
        selection: {
          isEmpty: true,
          active: { line: 0 }
        }
      };
      (vscode.window as any).activeTextEditor = mockEditor;

      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);
      mockSessionManager.getRecentMessages.mockReturnValue([]);

      const result = await contextBuilder.build({
        userMessage: '测试',
        includeSelectedCode: false
      });

      expect(result.systemPrompt).toContain('<editor_context>');
      expect(result.systemPrompt).toContain('/test/file.ts');
      expect(result.systemPrompt).toContain('typescript');
    });

    it('应该包含选中代码', async () => {
      const selectedCode = 'function test() { return 1; }';
      const mockEditor = {
        document: {
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue(selectedCode)
        },
        selection: {
          isEmpty: false,
          active: { line: 0 }
        }
      };
      (vscode.window as any).activeTextEditor = mockEditor;

      // Mock getText返回选中代码
      mockEditor.document.getText = jest.fn().mockReturnValue(selectedCode);

      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);
      mockSessionManager.getRecentMessages.mockReturnValue([]);

      const result = await contextBuilder.build({
        userMessage: '测试',
        includeSelectedCode: true
      });

      expect(result.systemPrompt).toContain('选中代码');
      expect(result.systemPrompt).toContain(selectedCode);
    });

    it('应该在大文件时不包含完整文件内容', async () => {
      const largeContent = 'x'.repeat(15000); // 超过10KB
      const mockEditor = {
        document: {
          uri: { fsPath: '/test/file.ts' },
          languageId: 'typescript',
          getText: jest.fn().mockReturnValue(largeContent)
        },
        selection: {
          isEmpty: true,
          active: { line: 0 }
        }
      };
      (vscode.window as any).activeTextEditor = mockEditor;

      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);
      mockSessionManager.getRecentMessages.mockReturnValue([]);

      const result = await contextBuilder.build({
        userMessage: '测试',
        includeSelectedCode: false
      });

      // 大文件不应包含在上下文中
      expect(result.systemPrompt).not.toContain(largeContent);
    });
  });

  describe('边界条件', () => {
    it('应该在没有编辑器时正常处理', async () => {
      (vscode.window as any).activeTextEditor = null;

      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);
      mockSessionManager.getRecentMessages.mockReturnValue([]);

      const result = await contextBuilder.build({
        userMessage: '测试'
      });

      expect(result).toBeDefined();
      expect(result.systemPrompt).not.toContain('<editor_context>');
    });

    it('应该处理空的用户消息', async () => {
      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);
      mockSessionManager.getRecentMessages.mockReturnValue([]);

      const result = await contextBuilder.build({
        userMessage: ''
      });

      expect(result).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('');
    });

    it('应该使用默认的maxHistoryMessages', async () => {
      mockSessionManager.getRecentMessages.mockReturnValue([]);
      mockEpisodicMemory.search.mockResolvedValue([]);
      mockPreferenceMemory.getRecommendations.mockResolvedValue([]);

      await contextBuilder.build({
        userMessage: '测试'
        // 不传maxHistoryMessages
      });

      expect(mockSessionManager.getRecentMessages).toHaveBeenCalledWith(5);
    });
  });
});
