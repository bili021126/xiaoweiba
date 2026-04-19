/**
 * IntentDispatcher 三层降级策略测试
 * 
 * 测试场景：
 * 1. 正常路径：找到候选Agent并选择最佳Agent
 * 2. 降级策略1：无候选Agent时使用默认ChatAgent
 * 3. 降级策略2：无默认Agent时抛出错误
 * 4. 边界情况：评分算法正确性验证
 */

import 'reflect-metadata';
import { IntentDispatcher } from '../../../../src/core/application/IntentDispatcher';
import { IMemoryPort } from '../../../../src/core/ports/IMemoryPort';
import { IAgentRegistry } from '../../../../src/core/ports/IAgentRegistry';
import { IEventBus } from '../../../../src/core/ports/IEventBus';
import { Intent, MemoryContext } from '../../../../src/core/domain';
import { IAgent } from '../../../../src/core/agent/IAgent';
import {
  IntentReceivedEvent,
  AgentSelectedEvent,
  IntentDispatchedEvent,
  IntentDispatchFailedEvent
} from '../../../../src/core/events/DomainEvent';

// Mock依赖
const mockMemoryPort: jest.Mocked<IMemoryPort> = {
  retrieveContext: jest.fn(),
  recordTaskCompletion: jest.fn(),
  recordFeedback: jest.fn(),
  recommendForFile: jest.fn(),
  getAgentPerformance: jest.fn(),
  recordAgentExecution: jest.fn()
};

const mockAgentRegistry: jest.Mocked<IAgentRegistry> = {
  register: jest.fn(),
  findAgentsForIntent: jest.fn(),
  getAll: jest.fn(),
  getAgent: jest.fn()
};

const mockEventBus: jest.Mocked<IEventBus> = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  registerRequestHandler: jest.fn(),
  request: jest.fn(),
  dispose: jest.fn()
};

describe('IntentDispatcher - 三层降级策略', () => {
  let dispatcher: IntentDispatcher;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatcher = new IntentDispatcher(mockMemoryPort, mockAgentRegistry, mockEventBus);
  });

  // ==================== 测试用例1: 正常路径 ====================
  describe('正常路径：找到候选Agent并选择最佳Agent', () => {
    it('应该发布IntentReceivedEvent、AgentSelectedEvent和IntentDispatchedEvent', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释这段代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const mockAgent: IAgent = {
        id: 'explain_agent',
        name: 'Explain Agent',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);
      mockMemoryPort.getAgentPerformance.mockResolvedValue({
        totalAttempts: 10,
        successCount: 8,
        avgDurationMs: 2000
      });

      await dispatcher.dispatch(intent);

      // 验证事件发布顺序
      expect(mockEventBus.publish).toHaveBeenCalledTimes(3);
      expect(mockEventBus.publish).toHaveBeenNthCalledWith(1, expect.any(IntentReceivedEvent));
      expect(mockEventBus.publish).toHaveBeenNthCalledWith(2, expect.any(AgentSelectedEvent));
      expect(mockEventBus.publish).toHaveBeenNthCalledWith(3, expect.any(IntentDispatchedEvent));
    });

    it('单个候选Agent时应直接返回，无需评分', async () => {
      const intent: Intent = {
        name: 'generate_commit',
        userInput: '生成提交信息',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const mockAgent: IAgent = {
        id: 'commit_agent',
        name: 'Commit Agent',
        supportedIntents: ['generate_commit'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      await dispatcher.dispatch(intent);

      // 单候选不应调用getAgentPerformance
      expect(mockMemoryPort.getAgentPerformance).not.toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(AgentSelectedEvent));
    });
  });

  // ==================== 测试用例2: 降级策略1 ====================
  describe('降级策略1：无候选Agent时使用默认ChatAgent', () => {
    it('应该回退到chat_agent并成功调度', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: '未知意图',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const defaultAgent: IAgent = {
        id: 'chat_agent',
        name: 'Chat Agent',
        supportedIntents: ['chat'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      // 无候选Agent
      mockAgentRegistry.findAgentsForIntent.mockReturnValue([]);
      mockAgentRegistry.getAll.mockReturnValue([defaultAgent]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      await dispatcher.dispatch(intent);

      // 验证使用了默认Agent
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'chat_agent'
        })
      );
    });

    it('如果没有chat_agent但存在其他Agent，应继续尝试其他Agent', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: '未知意图',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const otherAgent: IAgent = {
        id: 'other_agent',
        name: 'Other Agent',
        supportedIntents: ['other'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([]);
      mockAgentRegistry.getAll.mockReturnValue([otherAgent]); // 没有chat_agent
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      // 应该抛出错误（降级策略2）
      await expect(dispatcher.dispatch(intent)).rejects.toThrow(
        'No agent found for intent: chat and no fallback available'
      );
    });
  });

  // ==================== 测试用例3: 降级策略2 ====================
  describe('降级策略2：无默认Agent时抛出错误', () => {
    it('应该发布IntentDispatchFailedEvent并抛出错误', async () => {
      const intent: Intent = {
        name: 'chat',
        userInput: '未知意图',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([]);
      mockAgentRegistry.getAll.mockReturnValue([]); // 无任何Agent

      await expect(dispatcher.dispatch(intent)).rejects.toThrow(
        'No agent found for intent: chat and no fallback available'
      );

      // 验证发布了失败事件
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(IntentDispatchFailedEvent));
    });
  });

  // ==================== 测试用例4: 评分算法验证 ====================
  describe('Agent选择算法：Wilson下限评分', () => {
    it('应该选择综合评分最高的Agent', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([agent1, agent2]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      // Agent1: 高成功率 + 快速度
      mockMemoryPort.getAgentPerformance
        .mockResolvedValueOnce({ totalAttempts: 100, successCount: 95, avgDurationMs: 1500 })
        // Agent2: 低成功率 + 慢速度
        .mockResolvedValueOnce({ totalAttempts: 50, successCount: 30, avgDurationMs: 4000 });

      await dispatcher.dispatch(intent);

      // 验证选择了agent1（评分更高）
      const selectedEvent = mockEventBus.publish.mock.calls.find(
        (call: any[]) => call[0] instanceof AgentSelectedEvent
      ) as [AgentSelectedEvent];
      expect(selectedEvent![0].agentId).toBe('agent1');
    });

    it('小样本时应使用Wilson下限而非简单成功率', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([agent1, agent2]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      // Agent1: 1/1 = 100% 成功率，但样本太少，Wilson下限应较低
      mockMemoryPort.getAgentPerformance
        .mockResolvedValueOnce({ totalAttempts: 1, successCount: 1, avgDurationMs: 2000 })
        // Agent2: 90/100 = 90% 成功率，样本充足，Wilson下限应较高
        .mockResolvedValueOnce({ totalAttempts: 100, successCount: 90, avgDurationMs: 2000 });

      await dispatcher.dispatch(intent);

      // 验证选择了agent2（虽然成功率略低，但样本充足更可靠）
      const selectedEvent = mockEventBus.publish.mock.calls.find(
        (call: any[]) => call[0] instanceof AgentSelectedEvent
      ) as [AgentSelectedEvent];
      expect(selectedEvent![0].agentId).toBe('agent2');
    });

    it('用户偏好应提供额外加分', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([agent1, agent2]);
      
      // 用户偏好agent2
      mockMemoryPort.retrieveContext.mockResolvedValue({
        userPreferences: { preferredAgent: 'agent2' }
      } as MemoryContext);

      // 两者性能相同
      mockMemoryPort.getAgentPerformance
        .mockResolvedValue({ totalAttempts: 50, successCount: 45, avgDurationMs: 2000 });

      await dispatcher.dispatch(intent);

      // 验证选择了有偏好的agent2
      const selectedEvent = mockEventBus.publish.mock.calls.find(
        (call: any[]) => call[0] instanceof AgentSelectedEvent
      ) as [AgentSelectedEvent];
      expect(selectedEvent![0].agentId).toBe('agent2');
    });
  });

  // ==================== 测试用例5: 同步调度方法 ====================
  describe('dispatchSync：低延迟同步调度', () => {
    it('应该直接执行Agent并返回结果', async () => {
      const intent: Intent = {
        name: 'inline_completion',
        userInput: 'console.log(',
        metadata: { timestamp: Date.now(), source: 'inline_completion' }
      };

      const mockAgent: IAgent = {
        id: 'completion_agent',
        name: 'Completion Agent',
        supportedIntents: ['inline_completion'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ completion: 'console.log("hello");' })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      const result = await dispatcher.dispatchSync(intent);

      expect(result).toEqual({ completion: 'console.log("hello");' });
      expect(mockAgent.execute).toHaveBeenCalled();
      // 同步调度不应发布事件
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('无候选Agent时应抛出错误', async () => {
      const intent: Intent = {
        name: 'inline_completion',
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'inline_completion' }
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([]);

      await expect(dispatcher.dispatchSync(intent)).rejects.toThrow(
        'No agent found for intent: inline_completion'
      );
    });
  });

  // ==================== 测试用例6: 边界情况 ====================
  describe('边界情况处理', () => {
    it('记忆检索失败不应阻断调度流程', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const mockAgent: IAgent = {
        id: 'explain_agent',
        name: 'Explain Agent',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
      mockMemoryPort.retrieveContext.mockRejectedValue(new Error('Memory retrieval failed'));

      await expect(dispatcher.dispatch(intent)).rejects.toThrow('Memory retrieval failed');
      
      // 验证发布了失败事件
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(IntentDispatchFailedEvent));
    });

    it('Agent执行失败应在AgentRunner中处理，不影响调度器', async () => {
      const intent: Intent = {
        name: 'explain_code',
        userInput: '解释代码',
        metadata: { timestamp: Date.now(), source: 'command' }
      };

      const mockAgent: IAgent = {
        id: 'explain_agent',
        name: 'Explain Agent',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: false, error: 'Execution failed' })
      };

      mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
      mockMemoryPort.retrieveContext.mockResolvedValue({} as MemoryContext);

      // 调度器只负责选择Agent，不关心执行结果
      await expect(dispatcher.dispatch(intent)).resolves.not.toThrow();
      
      // 验证正常发布了选定事件
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(AgentSelectedEvent));
    });
  });
});
