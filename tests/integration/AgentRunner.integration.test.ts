/**
 * AgentRunner Integration Test - 验证任务令牌与审计日志联动
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { AgentRunner } from '../../src/infrastructure/agent/AgentRunner';
import { TaskTokenManager } from '../../src/core/security/TaskTokenManager';
import { AgentSelectedEvent } from '../../src/core/events/DomainEvent';
import { createMockEventBus, createMockAgentRegistry, createMockMemoryPort } from '../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

describe('AgentRunner Integration', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    container.clearInstances();

    const mockEventBus = createMockEventBus();
    const mockRegistry = createMockAgentRegistry();
    const mockMemoryPort = createMockMemoryPort();

    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance('IAgentRegistry', mockRegistry);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    
    const taskTokenManager = new TaskTokenManager();
    container.registerInstance(TaskTokenManager, taskTokenManager);

    runner = container.resolve(AgentRunner);
  });

  it('should revoke token after successful execution', async () => {
    const mockRegistry = container.resolve('IAgentRegistry') as any;
    const token = (container.resolve(TaskTokenManager) as TaskTokenManager).generateToken('test', 'write');
    
    // 模拟 Agent 执行成功
    const mockAgent = { execute: jest.fn().mockResolvedValue({ success: true }) };
    (mockRegistry.getAgent as jest.Mock).mockReturnValue(mockAgent);

    // 模拟发布事件触发 Runner
    const event = new AgentSelectedEvent({} as any, 'test', {} as any);
    (event as any).taskToken = token.tokenId;
    await (runner as any).handleAgentSelected(event);

    // 验证令牌是否被撤销
    expect((container.resolve(TaskTokenManager) as TaskTokenManager).validateToken(token.tokenId, 'write')).toBe(false);
  });

  it('should handle agent execution failure', async () => {
    const mockRegistry = container.resolve('IAgentRegistry') as any;
    const token = (container.resolve(TaskTokenManager) as TaskTokenManager).generateToken('test', 'write');
    
    (mockRegistry.getAgent as jest.Mock).mockReturnValue({
      execute: jest.fn().mockRejectedValue(new Error('Agent failed'))
    });

    const event = new AgentSelectedEvent({} as any, 'test', {} as any);
    (event as any).taskToken = token.tokenId;
    await expect((runner as any).handleAgentSelected(event)).rejects.toThrow();
  });
});
