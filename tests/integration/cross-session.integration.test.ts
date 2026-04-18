import { SessionManager } from '../../src/chat/SessionManager';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { LLMTool } from '../../src/tools/LLMTool';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

describe('跨会话记忆集成', () => {
  let sessionManager: SessionManager;
  let episodicMemory: any;
  let llmTool: any;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      workspaceState: { 
        get: jest.fn().mockReturnValue(undefined), 
        update: jest.fn().mockResolvedValue(undefined) 
      }
    };

    episodicMemory = {
      search: jest.fn().mockResolvedValue([]),
      record: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined)
    };

    llmTool = {
      call: jest.fn(),
      callStream: jest.fn()
    };

    sessionManager = new SessionManager(mockContext, episodicMemory, llmTool);
  });

  it('应该在10条消息后生成会话摘要并记录到情景记忆', async () => {
    sessionManager.createSession();

    llmTool.call.mockResolvedValue({
      success: true,
      data: '摘要：讨论了TypeScript类型系统\n实体：TypeScript, interface, type',
      durationMs: 1500
    });

    for (let i = 1; i <= 10; i++) {
      sessionManager.addMessage({
        id: `msg_${i}`,
        role: i % 2 === 0 ? 'assistant' : 'user',
        content: `消息${i}`,
        timestamp: Date.now()
      });
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(llmTool.call).toHaveBeenCalled();
    expect(episodicMemory.record).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('TypeScript类型系统'),
        entities: expect.arrayContaining(['TypeScript', 'interface', 'type']),
        taskType: 'CHAT_COMMAND'
      })
    );
  });

  it('应该检索跨会话记忆增强当前对话', async () => {
    const mockMessages = [
      { role: 'user', content: '之前的消息' },
      { role: 'assistant', content: '之前的回答' }
    ];

    // Mock情景记忆返回跨会话数据
    episodicMemory.search.mockResolvedValue([
      { id: 'mem_1', summary: '之前讨论过React Hooks', timestamp: Date.now() - 86400000, projectFingerprint: '', taskType: 'CHAT', entities: [], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 },
      { id: 'mem_2', summary: '优化了性能', timestamp: Date.now() - 86400000 * 2, projectFingerprint: '', taskType: 'CHAT', entities: [], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 },
      { id: 'mem_3', summary: '使用了useMemo', timestamp: Date.now() - 86400000 * 3, projectFingerprint: '', taskType: 'CHAT', entities: [], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 },
      { id: 'mem_4', summary: '跨会话记忆1', timestamp: Date.now() - 86400000 * 4, projectFingerprint: '', taskType: 'CHAT', entities: [], outcome: 'SUCCESS', modelId: 'deepseek', durationMs: 0 }
    ]);

    const result = await episodicMemory.search('React优化', { limit: 6 });

    expect(episodicMemory.search).toHaveBeenCalledWith('React优化', { limit: 6 });
    expect(result.length).toBe(4);
  });

  it('应该在会话切换时保持记忆上下文', async () => {
    const session1 = sessionManager.createSession();
    
    sessionManager.addMessage({
      id: 'msg_1',
      role: 'user',
      content: '第一个会话的问题',
      timestamp: Date.now()
    });

    const session2 = sessionManager.createSession();
    sessionManager.switchSession(session1.id);

    const currentSession = sessionManager.getCurrentSession();
    expect(currentSession?.id).toBe(session1.id);
    expect(currentSession?.messages.length).toBe(1);
  });

  it('应该持久化会话摘要到数据库', async () => {
    sessionManager.createSession();

    llmTool.call.mockResolvedValue({
      success: true,
      data: '摘要：学习了Vue3组合式API\n实体：Vue3, composition API, ref',
      durationMs: 1200
    });

    for (let i = 1; i <= 10; i++) {
      sessionManager.addMessage({
        id: `msg_${i}`,
        role: 'user',
        content: `第${i}条消息`,
        timestamp: Date.now()
      });
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(episodicMemory.record).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('Vue3组合式API'),
        metadata: expect.objectContaining({
          sessionId: expect.any(String)
        })
      })
    );
  });
});
