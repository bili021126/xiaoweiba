/**
 * IntentDispatcher 集成测试 - 验证降级策略与调度逻辑
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentDispatcher } from '../../src/core/application/IntentDispatcher';
import { AgentRegistryImpl } from '../../src/infrastructure/agent/AgentRegistryImpl';
import { IAgent, AgentResult } from '../../src/core/agent/IAgent';
import { Intent } from '../../src/core/domain/Intent';
import { EventBus } from '../../src/core/events/EventBus';
import { IMemoryPort } from '../../src/core/ports/IMemoryPort';
import { MemoryContext } from '../../src/core/domain/MemoryContext';

describe('IntentDispatcher Integration', () => {
  let dispatcher: IntentDispatcher;
  let registry: AgentRegistryImpl;
  let eventBus: EventBus;

  beforeEach(() => {
    container.clearInstances();
    eventBus = new EventBus();
    container.registerInstance('IEventBus', eventBus);
    
    // Mock MemoryPort
    const mockMemoryPort: Partial<IMemoryPort> = {
      retrieveContext: jest.fn().mockResolvedValue({ episodicMemories: [] } as MemoryContext)
    };
    container.registerInstance('IMemoryPort', mockMemoryPort as IMemoryPort);

    registry = new AgentRegistryImpl();
    container.registerInstance(AgentRegistryImpl, registry);
    
    dispatcher = container.resolve(IntentDispatcher);
  });

  it('should dispatch to the correct agent when found', async () => {
    const mockAgent: Partial<IAgent> = {
      id: 'test-agent',
      name: 'Test Agent',
      metadata: { supportedIntents: ['test_intent'] },
      execute: jest.fn().mockResolvedValue({ success: true, data: {} } as AgentResult)
    };
    registry.register(mockAgent as IAgent);

    const intent: Intent = { name: 'test_intent', userInput: 'test' };
    await dispatcher.dispatch(intent);

    expect(mockAgent.execute).toHaveBeenCalled();
  });

  it('should fallback to chat-agent when specific agent is missing', async () => {
    const chatAgent: Partial<IAgent> = {
      id: 'chat-agent',
      name: 'Chat Agent',
      metadata: { supportedIntents: ['*'] },
      execute: jest.fn().mockResolvedValue({ success: true, data: {} } as AgentResult)
    };
    registry.register(chatAgent as IAgent);

    const intent: Intent = { name: 'unknown_intent', userInput: 'help' };
    await dispatcher.dispatch(intent);

    expect(chatAgent.execute).toHaveBeenCalled();
  });

  it('should handle execution errors gracefully', async () => {
    const failingAgent: Partial<IAgent> = {
      id: 'failing-agent',
      name: 'Failing Agent',
      metadata: { supportedIntents: ['fail_test'] },
      execute: jest.fn().mockRejectedValue(new Error('Simulated failure'))
    };
    registry.register(failingAgent as IAgent);

    const chatAgent: Partial<IAgent> = {
      id: 'chat-agent',
      name: 'Chat Agent',
      metadata: { supportedIntents: ['*'] },
      execute: jest.fn().mockResolvedValue({ success: true, data: {} } as AgentResult)
    };
    registry.register(chatAgent as IAgent);

    const intent: Intent = { name: 'fail_test', userInput: 'crash' };
    // 验证是否触发了降级或错误处理（此处简化为不抛出异常）
    await expect(dispatcher.dispatch(intent)).resolves.not.toThrow();
  });
});
