/**
 * SessionCompressor E2E测试
 * 
 * 测试场景：
 * 1. 短会话不触发压缩
 * 2. 长会话触发压缩并生成摘要
 * 3. 压缩后保留最近消息
 * 4. LLM失败时降级为简单摘要
 * 
 * E2E测试特点：
 * - 模拟真实用户多轮对话场景
 * - 验证端到端数据流完整性
 * - 使用真实SessionCompressor实现
 */

import 'reflect-metadata';
import { SessionCompressor, SessionSummary } from '../../src/core/application/SessionCompressor';
import { ILLMPort } from '../../src/core/ports/ILLMPort';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { container } from 'tsyringe';

describe('SessionCompressor E2E测试', () => {
  let sessionCompressor: SessionCompressor;
  let mockLLMPort: jest.Mocked<ILLMPort>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    // 创建Mock依赖
    mockLLMPort = {
      call: jest.fn(),
      callStream: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelId: jest.fn().mockReturnValue('test-model'),
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

  describe('场景1: 短会话不触发压缩', () => {
    it('应该直接返回原始会话(少于阈值)', async () => {
      const shortHistory = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
        { role: 'user', content: '解释一下这段代码' }
      ];

      const result = await sessionCompressor.compressIfNeeded(shortHistory);

      expect(result.compressed).toBe(false);
      expect(result.originalMessageCount).toBe(3);
      expect(result.compressedMessageCount).toBe(3);
      expect(result.compressionRatio).toBe(1.0);
      expect(result.summary).toBe('');
      expect(result.compressedHistory).toEqual(shortHistory);
    });

    it('应该在等于阈值时不触发压缩', async () => {
      const thresholdHistory = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      const result = await sessionCompressor.compressIfNeeded(thresholdHistory);

      expect(result.compressed).toBe(false);
      expect(result.originalMessageCount).toBe(10);
      expect(result.compressionRatio).toBe(1.0);
    });
  });

  describe('场景2: 长会话触发压缩', () => {
    it('应该压缩超过阈值的会话', async () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `这是第 ${i + 1} 条消息的内容`
      }));

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.originalMessageCount).toBe(15);
      expect(result.compressedMessageCount).toBeLessThan(15);
      expect(result.compressionRatio).toBeLessThan(1.0);
      expect(result.compressedHistory.length).toBeGreaterThan(0);
    });

    it('应该保留最近的N条消息', async () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息内容 ${i + 1}`
      }));

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      // 默认配置保留最近5条
      const recentMessages = longHistory.slice(-5);
      
      // 验证最近消息在压缩后的历史中
      expect(result.compressedHistory).toEqual(
        expect.arrayContaining(recentMessages)
      );
    });

    it('应该计算正确的压缩率', async () => {
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      const expectedRatio = result.compressedMessageCount / result.originalMessageCount;
      expect(result.compressionRatio).toBeCloseTo(expectedRatio, 2);
      expect(result.compressionRatio).toBeLessThan(1.0);
    });
  });

  describe('场景3: LLM摘要生成', () => {
    it('应该使用LLM生成会话摘要', async () => {
      const longHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: i % 2 === 0 
          ? `用户问题 ${i / 2 + 1}: 如何实现功能X?`
          : `助手回答 ${Math.floor(i / 2) + 1}: 可以通过方法Y实现`
      }));

      // Mock LLM成功返回
      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '用户询问了多个功能实现问题，助手提供了技术方案建议。',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toContain('用户询问');
      expect(mockLLMPort.call).toHaveBeenCalledTimes(1);
      
      // 验证调用参数
      const callArgs = mockLLMPort.call.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages.length).toBe(2); // system + user
    });

    it('应该在LLM失败时使用降级摘要', async () => {
      const longHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      // Mock LLM失败
      mockLLMPort.call.mockRejectedValueOnce(new Error('LLM服务不可用'));

      const result = await sessionCompressor.compressIfNeeded(longHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
      // 降级摘要应该包含统计信息
      expect(result.summary).toMatch(/用户提出了\d+个问题/);
    });

    it('应该在LLM返回空时使用降级摘要', async () => {
      const longHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      // Mock LLM返回空
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

  describe('场景4: shouldCompress判断逻辑', () => {
    it('应该正确判断需要压缩的会话', () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: 'user',
        content: `消息 ${i + 1}`
      }));

      expect(sessionCompressor.shouldCompress(longHistory)).toBe(true);
    });

    it('应该正确判断不需要压缩的会话', () => {
      const shortHistory = Array.from({ length: 5 }, (_, i) => ({
        role: 'user',
        content: `消息 ${i + 1}`
      }));

      expect(sessionCompressor.shouldCompress(shortHistory)).toBe(false);
    });

    it('应该在边界值时返回false', () => {
      const boundaryHistory = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `消息 ${i + 1}`
      }));

      expect(sessionCompressor.shouldCompress(boundaryHistory)).toBe(false);
    });
  });

  describe('场景5: 边界情况处理', () => {
    it('应该正确处理空会话', async () => {
      const emptyHistory: Array<{ role: string; content: string }> = [];

      const result = await sessionCompressor.compressIfNeeded(emptyHistory);

      expect(result.compressed).toBe(false);
      expect(result.originalMessageCount).toBe(0);
      expect(result.compressedMessageCount).toBe(0);
      expect(result.compressionRatio).toBe(1.0);
    });

    it('应该正确处理只有system消息的会话', async () => {
      const systemOnlyHistory = [
        { role: 'system', content: '你是一个助手' },
        { role: 'system', content: '请帮助用户' }
      ];

      const result = await sessionCompressor.compressIfNeeded(systemOnlyHistory);

      expect(result.compressed).toBe(false);
    });

    it('应该正确处理超长会话', async () => {
      const veryLongHistory = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1} 的详细内容`.repeat(10)
      }));

      const result = await sessionCompressor.compressIfNeeded(veryLongHistory);

      expect(result.compressed).toBe(true);
      expect(result.originalMessageCount).toBe(100);
      expect(result.compressedMessageCount).toBeLessThan(100);
    });
  });

  describe('场景6: 集成验证 - 完整对话流程', () => {
    it('应该与真实对话场景协同工作', async () => {
      // 模拟真实的代码解释对话
      const conversationHistory = [
        { role: 'user', content: '帮我解释一下这段Python代码' },
        { role: 'assistant', content: '好的，请提供代码...' },
        { role: 'user', content: 'def hello(): print("world")' },
        { role: 'assistant', content: '这是一个简单的函数...' },
        { role: 'user', content: '能优化一下吗？' },
        { role: 'assistant', content: '可以添加类型注解...' },
        { role: 'user', content: '谢谢！' },
        { role: 'assistant', content: '不客气！' },
        { role: 'user', content: '还有其他建议吗？' },
        { role: 'assistant', content: '可以考虑添加文档字符串...' },
        { role: 'user', content: '好的，我明白了' },
        { role: 'assistant', content: '很高兴能帮助到你！' }
      ];

      // Mock LLM返回
      mockLLMPort.call.mockResolvedValueOnce({
        success: true,
        text: '用户请求解释和优化Python代码，助手提供了详细的解释和改进建议，包括类型注解和文档字符串。',
        usage: { promptTokens: 150, completionTokens: 80, totalTokens: 150+80 }
      });

      const result = await sessionCompressor.compressIfNeeded(conversationHistory);

      expect(result.compressed).toBe(true);
      expect(result.summary).toContain('Python代码');
      expect(result.compressedHistory.some(msg => 
        msg.content.includes('会话摘要')
      )).toBe(true);
      
      // 验证压缩后仍然包含最近的对话
      expect(result.compressedHistory.some(msg => 
        msg.content.includes('明白了')
      )).toBe(true);
    });

    it('应该在多次压缩时保持一致性', async () => {
      const baseHistory = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `第${i + 1}轮对话`
      }));

      mockLLMPort.call.mockResolvedValue({
        success: true,
        text: '历史对话摘要',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      const result1 = await sessionCompressor.compressIfNeeded(baseHistory);
      const result2 = await sessionCompressor.compressIfNeeded(baseHistory);

      expect(result1.compressed).toBe(result2.compressed);
      expect(result1.compressedMessageCount).toBe(result2.compressedMessageCount);
    });
  });

  describe('场景7: 性能验证', () => {
    it('应该在合理时间内完成压缩', async () => {
      const longHistory = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `消息 ${i + 1}`
      }));

      mockLLMPort.call.mockResolvedValue({
        success: true,
        text: '摘要',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 100+50 }
      });

      const startTime = Date.now();
      await sessionCompressor.compressIfNeeded(longHistory);
      const endTime = Date.now();

      // 压缩应该在1秒内完成（不包括LLM调用时间）
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
