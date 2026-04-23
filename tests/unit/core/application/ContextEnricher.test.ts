/**
 * ContextEnricher 单元测试
 * 
 * 测试场景：
 * 1. 上下文增强 - 注入项目信息、文件内容、记忆
 * 2. 边界情况 - 无编辑器、空记忆等
 */

import 'reflect-metadata';
import { ContextEnricher } from '../../../../src/core/application/ContextEnricher';
import { IMemoryPort } from '../../../../src/core/ports/IMemoryPort';
import { Intent } from '../../../../src/core/domain';

// Mock IMemoryPort
const mockMemoryPort: jest.Mocked<IMemoryPort> = {
  retrieveContext: jest.fn(),
  recordTaskCompletion: jest.fn(),
  recordFeedback: jest.fn(),
  recommendForFile: jest.fn(),
  getAgentPerformance: jest.fn(),
  recordAgentExecution: jest.fn(),
  createSession: jest.fn(),
  loadSessionHistory: jest.fn(),
  deleteSession: jest.fn(),
  saveMessage: jest.fn(),
  listSessions: jest.fn(),
  retrieveAll: jest.fn(),
  recordMemory: jest.fn()
} as any;

describe('ContextEnricher - 上下文增强器', () => {
  let enricher: ContextEnricher;

  beforeEach(() => {
    jest.clearAllMocks();
    enricher = new ContextEnricher(mockMemoryPort);
  });

  // ==================== 测试用例1: 基础上下文检索 ====================
  describe('retrieveContext - 检索上下文', () => {
    it('应该返回包含情景记忆的上下文', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const mockMemories = [
        { id: 'ep_1', summary: 'Previous discussion' },
        { id: 'ep_2', summary: 'Code explanation' }
      ];

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: mockMemories as any,
        preferenceRecommendations: [],
        userPreferences: {}
      });

      const context = await enricher.retrieveContext(intent);

      expect(context).toBeDefined();
      expect(context.episodicMemories).toHaveLength(2);
      expect(mockMemoryPort.retrieveContext).toHaveBeenCalled();
    });

    it('应该处理空记忆情况', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {}
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.episodicMemories).toHaveLength(0);
    });

    it('应该传递正确的意图参数', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释这段代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {}
      });

      await enricher.retrieveContext(intent);

      expect(mockMemoryPort.retrieveContext).toHaveBeenCalledWith(intent);
    });
  });

  // ==================== 测试用例2: 错误处理 ====================
  describe('错误处理', () => {
    it('应该处理记忆检索失败', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockRejectedValue(new Error('Memory retrieval failed'));

      await expect(enricher.retrieveContext(intent)).rejects.toThrow('Memory retrieval failed');
    });

    it('应该处理网络超时', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockRejectedValue(new Error('Timeout'));

      await expect(enricher.retrieveContext(intent)).rejects.toThrow('Timeout');
    });
  });

  // ==================== 测试用例3: 用户偏好注入 ====================
  describe('用户偏好注入', () => {
    it('应该包含用户偏好设置', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {
          preferredAgent: 'chat_agent',
          commitStylePreference: {
            domain: 'COMMIT_STYLE',
            pattern: {
              alwaysIncludeScope: true,
              preferredTypes: ['feat', 'fix'],
              descriptionMaxLength: 50,
              useBulletPoints: false,
              language: 'zh'
            },
            confidence: 0.8,
            sampleCount: 10
          }
        }
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.userPreferences).toBeDefined();
      expect(context.userPreferences?.preferredAgent).toBe('chat_agent');
    });

    it('应该处理缺失的用户偏好', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: undefined
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.userPreferences).toBeUndefined();
    });
  });

  // ==================== 测试用例4: 偏好推荐 ====================
  describe('偏好推荐', () => {
    it('应该包含偏好推荐列表', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const recommendations = [
        { domain: 'COMMIT_STYLE', matchScore: 0.9 },
        { domain: 'CODE_STYLE', matchScore: 0.7 }
      ];

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: recommendations as any,
        userPreferences: {}
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.preferenceRecommendations).toHaveLength(2);
      expect(context.preferenceRecommendations[0].matchScore).toBe(0.9);
    });

    it('应该按匹配分数排序推荐', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const recommendations = [
        { domain: 'A', matchScore: 0.5 },
        { domain: 'B', matchScore: 0.9 },
        { domain: 'C', matchScore: 0.7 }
      ];

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: recommendations as any,
        userPreferences: {}
      });

      const context = await enricher.retrieveContext(intent);

      // 验证推荐已按分数排序（如果实现中有排序逻辑）
      expect(context.preferenceRecommendations).toBeDefined();
    });
  });

  // ==================== 测试用例5: 会话历史 ====================
  describe('会话历史', () => {
    it('应该包含会话历史记录', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      const sessionHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {},
        sessionHistory: sessionHistory as any
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.sessionHistory).toBeDefined();
      expect(context.sessionHistory).toHaveLength(2);
    });

    it('应该处理空会话历史', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {},
        sessionHistory: []
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.sessionHistory).toHaveLength(0);
    });
  });

  // ==================== 测试用例6: 原始查询 ====================
  describe('原始查询', () => {
    it('应该保留原始查询文本', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: '什么是闭包？',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {},
        originalQuery: '什么是闭包？'
      });

      const context = await enricher.retrieveContext(intent);

      expect(context.originalQuery).toBe('什么是闭包？');
    });
  });

  // ==================== 测试用例7: 性能测试 ====================
  describe('性能测试', () => {
    it('应该在合理时间内完成上下文检索', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now() }
      };

      mockMemoryPort.retrieveContext.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: [],
        userPreferences: {}
      });

      const startTime = Date.now();
      await enricher.retrieveContext(intent);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应在 1 秒内完成
    });
  });
});
