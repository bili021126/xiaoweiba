/**
 * Intent-Driven Workflow Integration Test - 验证意图分发与记忆联动的全链路
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentDispatcher } from '../../src/core/application/IntentDispatcher';
import { IntentFactory } from '../../src/core/factory/IntentFactory';
import { IMemoryPort } from '../../src/core/ports/IMemoryPort';
import { ILLMPort } from '../../src/core/ports/ILLMPort';
import { IAgentRegistry } from '../../src/core/agents/IAgentRegistry';
import { ChatAgent } from '../../src/agents/ChatAgent';
import { LLMCallOptions, LLMCallResult } from '../../src/core/ports/ILLMPort';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() },
  window: { showInformationMessage: jest.fn() }
}));

describe('Intent-Driven Workflow Integration', () => {
  let dispatcher: IntentDispatcher;
  let mockMemoryPort: Partial<IMemoryPort>;
  let mockLLM: Partial<ILLMPort>;

  beforeEach(() => {
    container.clearInstances();

    // 1. 模拟基础设施
    mockMemoryPort = {
      recordMemory: jest.fn().mockResolvedValue('mem_123'),
      retrieveContext: jest.fn().mockResolvedValue({ memories: [], preferences: [] }),
      search: jest.fn().mockResolvedValue([])
    };
    
    mockLLM = {
      call: jest.fn().mockResolvedValue({ success: true, content: 'Hello! How can I help you today?' } as LLMCallResult)
    };

    // 2. 注册 Mock 依赖
    container.registerInstance('IMemoryPort', mockMemoryPort as IMemoryPort);
    container.registerInstance('ILLMPort', mockLLM as ILLMPort);
    
    // 3. 注册 Agent
    const registry = container.resolve(IAgentRegistry) as IAgentRegistry;
    const chatAgent = container.resolve(ChatAgent);
    registry.register(chatAgent);
    container.registerInstance('IAgentRegistry', registry);

    // 4. 解析被测试对象
    dispatcher = container.resolve(IntentDispatcher);
  });

  it('should process a chat intent and record memory', async () => {
    // 构建意图
    const intent = await IntentFactory.buildChatIntent('Hello, XiaoWeiba');
    
    // 执行分发
    const result = await dispatcher.dispatch(intent);

    // 验证结果
    expect(result).toBeDefined();
    
    // 验证记忆是否被记录（这是集成测试的核心：验证跨组件联动）
    expect(mockMemoryPort.recordMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: 'CHAT',
        summary: expect.stringContaining('Hello')
      })
    );
  });

  it('should handle LLM failure gracefully in integration flow', async () => {
    // 模拟 LLM 故障
    (mockLLM.call as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    const intent = await IntentFactory.buildChatIntent('Test failure');
    const result = await dispatcher.dispatch(intent);

    // 验证系统是否优雅降级或返回错误状态
    expect(result).toBeDefined();
  });
});
