/**
 * L1集成E2E测试 - ContextEnricher + SessionCompressor 与系统集成
 * 
 * 测试场景：
 * 1. Intent创建 -> ContextEnricher注入 -> 完整Intent流转
 * 2. 长会话 -> SessionCompressor压缩 -> 压缩后历史传递
 * 3. 完整用户交互流程：打开文件 -> 选中代码 -> 询问 -> 上下文注入 -> 会话压缩
 * 
 * L1集成测试特点：
 * - 测试多个组件的协同工作
 * - 验证数据在组件间的正确传递
 * - 使用真实组件实现（除外部依赖外）
 */

import 'reflect-metadata';
import { ContextEnricher, EnrichedContext } from '../../src/core/application/ContextEnricher';
import { SessionCompressor, SessionSummary } from '../../src/core/application/SessionCompressor';
import { IntentFactory } from '../../src/core/factory/IntentFactory';
import { Intent } from '../../src/core/domain/Intent';
import { ILLMPort } from '../../src/core/ports/ILLMPort';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { container } from 'tsyringe';

describe('L1集成E2E测试', () => {
  let contextEnricher: ContextEnricher;
  let sessionCompressor: SessionCompressor;
  let mockLLMPort: jest.Mocked<ILLMPort>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    // 初始化组件
    contextEnricher = new ContextEnricher();

    // 创建Mock依赖
    mockLLMPort = {
      call: jest.fn(),
      callStream: jest.fn(),
      getModelId: jest.fn().mockReturnValue('test-model'),
      isAvailable: jest.fn().mockResolvedValue(true),
      dispose: jest.fn()
    };

    mockConfigManager = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      resetConfig: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined)
    } as any;

    // 注入依赖
    container.registerInstance('ILLMPort', mockLLMPort);
    container.registerInstance(ConfigManager, mockConfigManager);

    sessionCompressor = new SessionCompressor(mockLLMPort, mockConfigManager);
  });

  afterEach(() => {
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('场景1: Intent完整流转 - 从创建到上下文注入', () => {
    it('应该完成完整的Intent生命周期', async () => {
      // 1. 创建Intent
      const intent = IntentFactory.buildChatIntent('解释这段代码');
      
      expect(intent.name).toBe('chat');
      expect(intent.userInput).toBe('解释这段代码');
      expect(intent.metadata.source).toBe('chat');

      // 2. 通过ContextEnricher注入上下文
      const enrichedIntent = await contextEnricher.enrichIntent(intent);

      // 3. 验证Intent结构完整性
      expect(enrichedIntent.name).toBe('chat');
      expect(enrichedIntent.userInput).toBe('解释这段代码');
      expect(enrichedIntent.metadata).toBeDefined();
      expect(enrichedIntent.metadata.timestamp).toBeGreaterThan(0);

      // 4. 如果有激活编辑器，验证enrichedContext被注入
      if ((enrichedIntent.metadata as any).enrichedContext) {
        const ctx = (enrichedIntent.metadata as any).enrichedContext;
        expect(ctx.timestamp).toBeGreaterThan(0);
      }
    });

    it('应该在Intent中保留原始元数据', async () => {
      const originalIntent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: {
          timestamp: Date.now(),
          source: 'command',
          sessionId: 'test-session-123',
        }
      };

      const enrichedIntent = await contextEnricher.enrichIntent(originalIntent);

      // 验证原始元数据未被覆盖
      expect(enrichedIntent.metadata.sessionId).toBe('test-session-123');
    });
  });

  describe('场景2: 会话压缩与Intent流转集成', () => {
    it('应该压缩长会话并生成摘要', async () => {
      // 模拟长对话历史
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `第${i + 1}轮对话内容`
      }));

      // Mock LLM返回摘要
      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '用户和助手进行了多轮代码相关讨论',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 200+100 }
      });

      // 执行压缩
      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toContain('代码相关讨论');
      expect(result.compressedHistory.length).toBeLessThan(longHistory.length);
      
      // 验证压缩后的历史包含摘要
      expect(result.compressedHistory[0].role).toBe('system');
      expect(result.compressedHistory[0].content).toContain('会话摘要');
    });

    it('应该在压缩后保留足够的上下文用于后续Intent', async () => {
      const conversationHistory = [
        { role: 'user', content: '如何排序数组？' },
        { role: 'assistant', content: '可以使用sort方法...' },
        { role: 'user', content: '时间复杂度是多少？' },
        { role: 'assistant', content: '平均O(n log n)...' },
        { role: 'user', content: '有更好的方法吗？' },
        { role: 'assistant', content: '取决于具体场景...' },
        { role: 'user', content: '能写个例子吗？' },
        { role: 'assistant', content: '当然，这是一个示例...' },
        { role: 'user', content: '谢谢！' },
        { role: 'assistant', content: '不客气！' },
        { role: 'user', content: '还有其他优化建议吗？' },
        { role: 'assistant', content: '可以考虑并行排序...' }
      ];

      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '用户询问数组排序方法、时间复杂度和优化建议，助手提供了详细解答和代码示例。',
        usage: { promptTokens: 180, completionTokens: 90, totalTokens: 180+90 }
      });

      const result = await sessionCompressor.compressIfNeeded(conversationHistory);

      // 验证压缩后仍然有足够的上下文
      expect(result.compressedHistory.length).toBeGreaterThan(0);
      
      // 最近的消息应该被保留
      const lastUserMessage = conversationHistory[conversationHistory.length - 2];
      expect(result.compressedHistory.some(msg => 
        msg.content === lastUserMessage.content
      )).toBe(true);
    });
  });

  describe('场景3: 完整用户交互流程', () => {
    it('应该模拟真实的代码解释场景', async () => {
      // 步骤1: 用户打开文件并选中代码（模拟ContextEnricher捕获）
      const mockContext: EnrichedContext = {
        activeFilePath: '/project/src/services/UserService.ts',
        activeFileLanguage: 'typescript',
        cursorLine: 42,
        selectedCode: {
          content: 'export class UserService {\n  constructor() {}\n}',
          startLine: 40,
          endLine: 45
        },
        timestamp: Date.now()
      };

      // 步骤2: 用户发起询问
      const intent = IntentFactory.buildChatIntent('解释这段代码的作用');
      
      // 步骤3: 手动注入模拟的上下文（因为测试环境没有激活编辑器）
      (intent.metadata as any).enrichedContext = mockContext;

      // 验证Intent包含完整上下文
      expect((intent.metadata as any).enrichedContext.activeFilePath).toContain('UserService.ts');
      expect((intent.metadata as any).enrichedContext.cursorLine).toBe(42);
      expect((intent.metadata as any).enrichedContext.selectedCode).toBeDefined();

      // 步骤4: 格式化上下文描述（用于Prompt构建）
      const contextDescription = contextEnricher.formatContextDescription(mockContext);
      expect(contextDescription).toContain('UserService.ts');
      expect(contextDescription).toContain('第42行');
      expect(contextDescription).toContain('选中第40-45行');
    });

    it('应该处理多轮对话后的会话压缩', async () => {
      // 模拟15轮对话历史
      const conversationHistory = [
        { role: 'user', content: '帮我看看这个函数有什么问题' },
        { role: 'assistant', content: '这个函数存在内存泄漏风险...' },
        { role: 'user', content: '怎么修复？' },
        { role: 'assistant', content: '需要添加清理逻辑...' },
        { role: 'user', content: '能给我代码示例吗？' },
        { role: 'assistant', content: '当然，这是修复后的代码...' },
        { role: 'user', content: '这样性能会受影响吗？' },
        { role: 'assistant', content: '影响很小，可以忽略...' },
        { role: 'user', content: '有其他优化建议吗？' },
        { role: 'assistant', content: '可以考虑使用对象池...' },
        { role: 'user', content: '好的，我试试' },
        { role: 'assistant', content: '有问题随时问我！' },
        { role: 'user', content: '这个方法线程安全吗？' },
        { role: 'assistant', content: '当前实现不是线程安全的...' },
        { role: 'user', content: '怎么改造成线程安全的？' },
        { role: 'assistant', content: '可以添加互斥锁或使用原子操作...' }
      ];

      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '用户咨询函数内存泄漏问题并获得修复方案，随后讨论了性能优化和线程安全性改造方案。',
        usage: { promptTokens: 250, completionTokens: 120, totalTokens: 250+120 }
      });

      // 执行压缩
      const compressionResult = await sessionCompressor.compressIfNeeded(conversationHistory);

      expect(compressionResult.compressed).toBe(true);
      expect(compressionResult.summary).toContain('内存泄漏');
      expect(compressionResult.summary).toContain('线程安全');
      
      // 压缩后的历史应该可以用于下一轮对话
      expect(compressionResult.compressedHistory.length).toBeLessThan(conversationHistory.length);
      expect(compressionResult.compressedHistory.length).toBeGreaterThan(0);
    });
  });

  describe('场景4: 错误处理与降级', () => {
    it('应该在ContextEnricher失败时不影响Intent流转', async () => {
      const intent = IntentFactory.buildChatIntent('你好');
      
      // 即使没有激活编辑器（capture返回undefined），Intent也应该正常
      const enrichedIntent = await contextEnricher.enrichIntent(intent);
      
      expect(enrichedIntent.name).toBe('chat');
      expect(enrichedIntent.userInput).toBe('你好');
      // Intent的其他字段不应该受影响
      expect(enrichedIntent.metadata.timestamp).toBeGreaterThan(0);
    });

    it('应该在SessionCompressor LLM失败时使用降级策略', async () => {
      const longHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      // Mock LLM失败
      mockLLMPort.call.mockRejectedValueOnce(new Error('网络错误'));

      // 应该降级为简单摘要，而不是抛出异常
      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      // 降级摘要应该包含统计信息
      expect(result.summary).toMatch(/用户提出了\d+个问题/);
    });

    it('应该在LLM返回空结果时使用降级策略', async () => {
      const longHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      mockLLMPort.call.mockResolvedValueOnce({
        success: false,
        text: '',
        usage: { promptTokens: 100, completionTokens: 0, totalTokens: 100+0 }
      });

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });

  describe('场景5: 数据一致性验证', () => {
    it('应该在多次操作中保持数据一致性', async () => {
      const intent1 = IntentFactory.buildChatIntent('第一个问题');
      const intent2 = IntentFactory.buildChatIntent('第二个问题');

      const enriched1 = await contextEnricher.enrichIntent(intent1);
      const enriched2 = await contextEnricher.enrichIntent(intent2);

      // 两个Intent应该独立，互不影响
      expect(enriched1.userInput).toBe('第一个问题');
      expect(enriched2.userInput).toBe('第二个问题');
      
      // 时间戳应该不同
      expect(enriched2.metadata.timestamp).toBeGreaterThanOrEqual(enriched1.metadata.timestamp);
    });

    it('应该在会话压缩后保持消息顺序', async () => {
      const history = [
        { role: 'user', content: '问题1' },
        { role: 'assistant', content: '回答1' },
        { role: 'user', content: '问题2' },
        { role: 'assistant', content: '回答2' },
        { role: 'user', content: '问题3' },
        { role: 'assistant', content: '回答3' },
        { role: 'user', content: '问题4' },
        { role: 'assistant', content: '回答4' },
        { role: 'user', content: '问题5' },
        { role: 'assistant', content: '回答5' },
        { role: 'user', content: '问题6' },
        { role: 'assistant', content: '回答6' }
      ];

      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '历史摘要',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      const result = await sessionCompressor.compressIfNeeded(history);

      // 验证最近消息的顺序保持不变
      const recentMessages = history.slice(-5);
      const compressedRecent = result.compressedHistory.slice(-5);
      
      expect(compressedRecent).toEqual(recentMessages);
    });
  });

  describe('场景6: 边界情况集成测试', () => {
    it('应该正确处理空Intent', async () => {
      const emptyIntent: Intent = {
        name: 'chat',
        userInput: '',
        metadata: {
          timestamp: Date.now(),
          source: 'chat'
        }
      };

      const enriched = await contextEnricher.enrichIntent(emptyIntent);
      
      expect(enriched.userInput).toBe('');
      expect(enriched.metadata).toBeDefined();
    });

    it('应该正确处理只有system消息的会话', async () => {
      const systemOnlyHistory = [
        { role: 'system', content: '你是一个AI助手' },
        { role: 'system', content: '请帮助用户解决问题' }
      ];

      const result = await sessionCompressor.compressIfNeeded(systemOnlyHistory);

      expect(result.compressed).toBe(false);
      expect(result.compressedHistory).toEqual(systemOnlyHistory);
    });

    it('应该正确处理混合角色的会话', async () => {
      const mixedHistory = [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '用户消息1' },
        { role: 'assistant', content: '助手回复1' },
        { role: 'user', content: '用户消息2' },
        { role: 'assistant', content: '助手回复2' },
        { role: 'user', content: '用户消息3' },
        { role: 'assistant', content: '助手回复3' },
        { role: 'user', content: '用户消息4' },
        { role: 'assistant', content: '助手回复4' },
        { role: 'user', content: '用户消息5' },
        { role: 'assistant', content: '助手回复5' },
        { role: 'user', content: '用户消息6' },
        { role: 'assistant', content: '助手回复6' }
      ];

      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '混合对话摘要',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      const result = await sessionCompressor.compressIfNeeded(mixedHistory);

      expect(result.compressed).toBe(true);
      // system消息应该在压缩后被保留或替换为摘要
      expect(result.compressedHistory[0].role).toBe('system');
    });
  });

  describe('场景7: 性能集成测试', () => {
    it('应该在合理时间内完成完整流程', async () => {
      const startTime = Date.now();

      // 1. 创建Intent
      const intent = IntentFactory.buildChatIntent('测试性能');
      
      // 2. 注入上下文
      await contextEnricher.enrichIntent(intent);
      
      // 3. 压缩会话
      const history = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '摘要',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      await sessionCompressor.compressIfNeeded(history);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 整个流程应该在合理时间内完成（不包括实际LLM调用）
      expect(duration).toBeLessThan(2000);
    });
  });
});
