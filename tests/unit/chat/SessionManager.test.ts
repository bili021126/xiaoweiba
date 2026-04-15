import { SessionManager, ChatMessage } from '../../../src/chat/SessionManager';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { LLMTool } from '../../../src/tools/LLMTool';
import * as vscode from 'vscode';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockContext: jest.Mocked<vscode.ExtensionContext>;
  let mockEpisodicMemory: jest.Mocked<EpisodicMemory>;
  let mockLLMTool: jest.Mocked<LLMTool>;
  let mockWorkspaceState: any;

  beforeEach(() => {
    // Mock workspaceState
    mockWorkspaceState = {
      get: jest.fn().mockReturnValue(undefined),
      update: jest.fn().mockResolvedValue(undefined)
    };

    // Mock ExtensionContext
    mockContext = {
      workspaceState: mockWorkspaceState,
      globalState: {} as any,
      subscriptions: [],
      extensionPath: '',
      storagePath: '',
      globalStoragePath: '',
      logPath: '',
      extensionUri: {} as any,
      environmentVariableCollection: {} as any,
      extensionMode: 1,
      storageUri: undefined,
      globalStorageUri: undefined,
      logUri: undefined,
      asAbsolutePath: jest.fn(),
      secrets: {} as any
    } as any;

    // Mock EpisodicMemory
    mockEpisodicMemory = {
      record: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([]),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock LLMTool
    mockLLMTool = {
      call: jest.fn(),
      callStream: jest.fn()
    } as any;

    // 创建SessionManager实例
    sessionManager = new SessionManager(mockContext, mockEpisodicMemory, mockLLMTool);
  });

  describe('createSession - 创建会话', () => {
    it('应该创建新会话并设置为当前会话', () => {
      const session = sessionManager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_\d+_[a-z0-9]{7}$/);
      expect(session.title).toBe('新会话');
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession?.id).toBe(session.id);
    });

    it('应该在会话数超过限制时删除最旧会话', () => {
      // 创建20个会话（达到上限）
      for (let i = 0; i < 20; i++) {
        sessionManager.createSession();
      }

      // 再创建一个，应该触发删除
      const newSession = sessionManager.createSession();

      const allSessions = sessionManager.getAllSessions();
      expect(allSessions.length).toBe(20);
      expect(allSessions.some(s => s.id === newSession.id)).toBe(true);
    });

    it('应该持久化会话到workspaceState', () => {
      sessionManager.createSession();

      expect(mockWorkspaceState.update).toHaveBeenCalledWith(
        'xiaoweiba.chatSessions',
        expect.any(Array)
      );
      expect(mockWorkspaceState.update).toHaveBeenCalledWith(
        'xiaoweiba.currentSessionId',
        expect.any(String)
      );
    });
  });

  describe('switchSession - 切换会话', () => {
    it('应该成功切换到存在的会话', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      sessionManager.switchSession(session1.id);

      expect(sessionManager.getCurrentSession()?.id).toBe(session1.id);
    });

    it('应该在会话不存在时抛出错误', () => {
      expect(() => {
        sessionManager.switchSession('nonexistent_session');
      }).toThrow('会话不存在: nonexistent_session');
    });

    it('应该持久化切换后的状态', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      sessionManager.switchSession(session1.id);

      expect(mockWorkspaceState.update).toHaveBeenCalledWith(
        'xiaoweiba.currentSessionId',
        session1.id
      );
    });
  });

  describe('deleteSession - 删除会话', () => {
    it('应该删除指定的会话', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      sessionManager.deleteSession(session1.id);

      const allSessions = sessionManager.getAllSessions();
      expect(allSessions.some(s => s.id === session1.id)).toBe(false);
      expect(allSessions.some(s => s.id === session2.id)).toBe(true);
    });

    it('应该在删除当前会话时切换到另一个会话', () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      // 先切换到session2
      sessionManager.switchSession(session2.id);
      expect(sessionManager.getCurrentSession()?.id).toBe(session2.id);

      // 删除session2，应该切换到session1或其他存在的会话
      sessionManager.deleteSession(session2.id);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).not.toBeNull();
      expect(currentSession?.id).not.toBe(session2.id); // 不应该是被删除的会话
    });

    it('应该在删除最后一个会话时自动创建新会话', () => {
      const session = sessionManager.createSession();

      sessionManager.deleteSession(session.id);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).not.toBeNull();
      expect(currentSession?.id).not.toBe(session.id);
    });

    it('应该在会话不存在时抛出错误', () => {
      expect(() => {
        sessionManager.deleteSession('nonexistent_session');
      }).toThrow('会话不存在: nonexistent_session');
    });

    it('应该删除非当前会话时不影响当前会话', () => {
      const session1 = sessionManager.createSession();
      sessionManager.createSession(); // session2，当前会话
      const beforeCount = sessionManager.getAllSessions().length;
      const currentId = sessionManager.getCurrentSession()!.id;

      // 删除session1（非当前）
      sessionManager.deleteSession(session1.id);

      expect(sessionManager.getCurrentSession()!.id).toBe(currentId);
      expect(sessionManager.getAllSessions()).toHaveLength(beforeCount - 1);
    });
  });

  describe('getCurrentSession - 获取当前会话', () => {
    it('应该返回当前活跃的会话', () => {
      const session = sessionManager.createSession();

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession?.id).toBe(session.id);
    });

    it('应该在没有活跃会话时返回null', () => {
      // 模拟没有会话的情况
      (sessionManager as any).currentSessionId = null;

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).toBeNull();
    });
  });

  describe('getAllSessions - 获取所有会话', () => {
    it('应该返回按更新时间降序排列的会话列表', () => {
      // 获取构造函数创建的初始会话
      const initialSession = sessionManager.getCurrentSession();
      
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();
      
      // 手动更新session1的时间戳使其更晚
      (session1 as any).updatedAt = Date.now() + 1000;

      const allSessions = sessionManager.getAllSessions();
      expect(allSessions.length).toBeGreaterThanOrEqual(2);
      expect(allSessions[0].id).toBe(session1.id); // 最新的在前
    });

    it('应该在无会话时返回空数组或仅包含自动创建的会话', () => {
      // 获取所有会话
      let allSessions = sessionManager.getAllSessions();
      
      // 删除所有会话（除了最后一个，删除最后一个会自动创建新的）
      while (allSessions.length > 1) {
        sessionManager.deleteSession(allSessions[0].id);
        allSessions = sessionManager.getAllSessions();
      }

      // 最后至少会有一个会话（自动创建的）
      const finalSessions = sessionManager.getAllSessions();
      expect(finalSessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRecentMessages - 获取最近消息', () => {
    it('应该返回指定数量的最近消息', () => {
      const session = sessionManager.createSession();
      
      // 添加5条消息
      for (let i = 1; i <= 5; i++) {
        sessionManager.addMessage({
          id: `msg_${i}`,
          role: i % 2 === 0 ? 'assistant' : 'user',
          content: `消息${i}`,
          timestamp: Date.now()
        });
      }

      const recentMessages = sessionManager.getRecentMessages(3);
      expect(recentMessages.length).toBe(3);
      expect(recentMessages[0].content).toBe('消息3');
      expect(recentMessages[2].content).toBe('消息5');
    });

    it('应该在无活跃会话时返回空数组', () => {
      (sessionManager as any).currentSessionId = null;

      const recentMessages = sessionManager.getRecentMessages(5);
      expect(recentMessages).toEqual([]);
    });

    it('应该默认返回5条消息', () => {
      const session = sessionManager.createSession();
      
      for (let i = 1; i <= 10; i++) {
        sessionManager.addMessage({
          id: `msg_${i}`,
          role: 'user',
          content: `消息${i}`,
          timestamp: Date.now()
        });
      }

      const recentMessages = sessionManager.getRecentMessages();
      expect(recentMessages.length).toBe(5);
    });
  });

  describe('addMessage - 添加消息', () => {
    it('应该将消息添加到当前会话', () => {
      sessionManager.createSession();

      const message: ChatMessage = {
        id: 'msg_1',
        role: 'user',
        content: '测试消息',
        timestamp: Date.now()
      };

      sessionManager.addMessage(message);

      const session = sessionManager.getCurrentSession();
      expect(session?.messages.length).toBe(1);
      expect(session?.messages[0].content).toBe('测试消息');
    });

    it('应该在第一条用户消息时自动生成标题', () => {
      sessionManager.createSession();

      const message: ChatMessage = {
        id: 'msg_1',
        role: 'user',
        content: '如何优化React性能？',
        timestamp: Date.now()
      };

      sessionManager.addMessage(message);

      const session = sessionManager.getCurrentSession();
      expect(session?.title).toBe('如何优化React性能？');
    });

    it('应该在长消息时截断标题', () => {
      sessionManager.createSession();

      const longMessage = '这是一个非常长的消息，超过了三十个字符的限制，应该被截断';
      const message: ChatMessage = {
        id: 'msg_1',
        role: 'user',
        content: longMessage,
        timestamp: Date.now()
      };

      sessionManager.addMessage(message);

      const session = sessionManager.getCurrentSession();
      expect(session?.title.length).toBeLessThanOrEqual(30);
      expect(session?.title).toBe(longMessage.substring(0, 30));
    });

    it('应该在每10条消息时生成会话摘要', async () => {
      sessionManager.createSession();

      // Mock LLM响应
      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '摘要：讨论了React性能优化\n实体：React, useMemo, useCallback',
        durationMs: 1500
      });

      // 添加10条消息
      for (let i = 1; i <= 10; i++) {
        sessionManager.addMessage({
          id: `msg_${i}`,
          role: i % 2 === 0 ? 'assistant' : 'user',
          content: `消息${i}`,
          timestamp: Date.now()
        });
      }

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLLMTool.call).toHaveBeenCalled();
      expect(mockEpisodicMemory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.stringContaining('React性能优化'),
          entities: expect.arrayContaining(['React', 'useMemo', 'useCallback'])
        })
      );
    });

    it('应该在没有活跃会话时抛出错误', () => {
      (sessionManager as any).currentSessionId = null;

      expect(() => {
        sessionManager.addMessage({
          id: 'msg_1',
          role: 'user',
          content: '测试',
          timestamp: Date.now()
        });
      }).toThrow('没有活跃的会话');
    });

    it('应该更新会话的updatedAt时间戳', () => {
      sessionManager.createSession();
      const session = sessionManager.getCurrentSession();
      const originalUpdateTime = session?.updatedAt;

      // 等待一小段时间
      return new Promise<void>(resolve => {
        setTimeout(() => {
          sessionManager.addMessage({
            id: 'msg_1',
            role: 'user',
            content: '测试',
            timestamp: Date.now()
          });

          const updatedSession = sessionManager.getCurrentSession();
          expect(updatedSession?.updatedAt).toBeGreaterThan(originalUpdateTime || 0);
          resolve();
        }, 10);
      });
    });
  });

  describe('会话持久化', () => {
    it('应该在构造函数中加载已保存的会话', () => {
      const savedSessions = [
        {
          id: 'session_saved_1',
          title: '已保存的会话',
          messages: [],
          createdAt: Date.now() - 10000,
          updatedAt: Date.now() - 5000
        }
      ];

      mockWorkspaceState.get.mockImplementation((key: string) => {
        if (key === 'xiaoweiba.chatSessions') return savedSessions;
        if (key === 'xiaoweiba.currentSessionId') return 'session_saved_1';
        return undefined;
      });

      const newManager = new SessionManager(mockContext, mockEpisodicMemory, mockLLMTool);
      const currentSession = newManager.getCurrentSession();

      expect(currentSession?.id).toBe('session_saved_1');
      expect(currentSession?.title).toBe('已保存的会话');
    });

    it('应该在当前会话不存在时使用最新的会话', () => {
      const savedSessions = [
        {
          id: 'session_old',
          title: '旧会话',
          messages: [],
          createdAt: Date.now() - 20000,
          updatedAt: Date.now() - 10000
        },
        {
          id: 'session_new',
          title: '新会话',
          messages: [],
          createdAt: Date.now() - 10000,
          updatedAt: Date.now() - 5000
        }
      ];

      mockWorkspaceState.get.mockImplementation((key: string) => {
        if (key === 'xiaoweiba.chatSessions') return savedSessions;
        if (key === 'xiaoweiba.currentSessionId') return 'deleted_session';
        return undefined;
      });

      const newManager = new SessionManager(mockContext, mockEpisodicMemory, mockLLMTool);
      const currentSession = newManager.getCurrentSession();

      expect(currentSession?.id).toBe('session_new'); // 应该选择最新的
    });

    it('应该在无历史会话时创建新会话', () => {
      mockWorkspaceState.get.mockReturnValue(undefined);

      const newManager = new SessionManager(mockContext, mockEpisodicMemory, mockLLMTool);
      const currentSession = newManager.getCurrentSession();

      expect(currentSession).not.toBeNull();
      expect(currentSession?.title).toBe('新会话');
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空消息内容作为标题', () => {
      sessionManager.createSession();

      const message: ChatMessage = {
        id: 'msg_1',
        role: 'user',
        content: '   ', // 只有空格
        timestamp: Date.now()
      };

      sessionManager.addMessage(message);

      const session = sessionManager.getCurrentSession();
      expect(session?.title).toBe('新会话'); // 回退到默认标题
    });

    it('应该正确处理助手消息不触发生成标题', () => {
      sessionManager.createSession();

      const message: ChatMessage = {
        id: 'msg_1',
        role: 'assistant',
        content: '这是助手的回复',
        timestamp: Date.now()
      };

      sessionManager.addMessage(message);

      const session = sessionManager.getCurrentSession();
      expect(session?.title).toBe('新会话'); // 不应该改变
    });

    it('应该LLM调用失败时不影响正常功能', async () => {
      sessionManager.createSession();
    
      mockLLMTool.call.mockResolvedValue({ success: false, error: 'LLM调用失败', durationMs: 0 });
    
      // 添加10条消息触发摘要生成
      for (let i = 1; i <= 10; i++) {
        sessionManager.addMessage({
          id: `msg_${i}`,
          role: 'user',
          content: `消息${i}`,
          timestamp: Date.now()
        });
      }
    
      // 不应该抛出异常
      const session = sessionManager.getCurrentSession();
      expect(session).toBeDefined();
      expect(session?.messages.length).toBe(10);
    });

    it('应该在依赖未初始化时跳过摘要生成', async () => {
      // 创建不带依赖的SessionManager
      const managerWithoutDeps = new SessionManager(mockContext);
      managerWithoutDeps.createSession();

      // 添加10条消息
      for (let i = 1; i <= 10; i++) {
        managerWithoutDeps.addMessage({
          id: `msg_${i}`,
          role: 'user',
          content: `消息${i}`,
          timestamp: Date.now()
        });
      }

      // 等待异步操作
      await new Promise(resolve => setTimeout(resolve, 100));

      // 不应该调用LLM
      expect(mockLLMTool.call).not.toHaveBeenCalled();
    });
  });
});
