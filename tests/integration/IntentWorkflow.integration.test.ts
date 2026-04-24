/**
 * Intent-Driven Workflow Integration Test - 验证意图分发与记忆联动的全链路
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentDispatcher } from '../../src/core/application/IntentDispatcher';
import { IntentFactory } from '../../src/core/factory/IntentFactory';
import { ChatAgent } from '../../src/agents/ChatAgent';
import { createMockMemoryPort, createMockLLMPort, createMockAgentRegistry } from '../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() },
  window: { showInformationMessage: jest.fn() }
}));

describe('Intent-Driven Workflow Integration', () => {
  let dispatcher: IntentDispatcher;

  beforeEach(() => {
    container.clearInstances();

    // 1. 使用全局 Mock 工厂
    const mockMemoryPort = createMockMemoryPort();
    const mockLLM = createMockLLMPort();

    // 2. 注册 Mock 依赖
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('ILLMPort', mockLLM);
    
    // 3. 注册 Agent
    const registry = createMockAgentRegistry();
    const chatAgent = container.resolve(ChatAgent);
    registry.register(chatAgent);
    container.registerInstance('IAgentRegistry', registry);

    // 4. 解析被测试对象
    dispatcher = container.resolve(IntentDispatcher);
  });

  it('should process a chat intent and record memory', async () => {
    const mockMemoryPort = createMockMemoryPort();
    container.registerInstance('IMemoryPort', mockMemoryPort);
    
    // 重新解析 Dispatcher 以获取最新的 Mock
    dispatcher = container.resolve(IntentDispatcher);

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
    const mockLLM = createMockLLMPort({ call: jest.fn().mockRejectedValue(new Error('Network error')) });
    container.registerInstance('ILLMPort', mockLLM);
    
    // 重新解析 Dispatcher 以获取最新的 Mock
    dispatcher = container.resolve(IntentDispatcher);

    const intent = await IntentFactory.buildChatIntent('Test failure');
    const result = await dispatcher.dispatch(intent);

    // 验证系统是否优雅降级或返回错误状态
    expect(result).toBeDefined();
  });
});
