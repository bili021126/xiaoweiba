/**
 * AgentRunner 单元测试 - 补充异常分支覆盖
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { AgentRunner } from '../../../../src/infrastructure/agent/AgentRunner';
import { createMockEventBus, createMockAgentRegistry, createMockMemoryPort } from '../../../__mocks__/globalMocks';
import { AuditLogger } from '../../../../src/core/security/AuditLogger';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

// Mock console.error to suppress logs in tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('AgentRunner Branch Coverage', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    container.clearInstances();
    
    const mockEventBus = createMockEventBus();
    const mockRegistry = createMockAgentRegistry();
    const mockMemoryPort = createMockMemoryPort();
    const mockAuditLogger = { log: jest.fn() };

    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance('IAgentRegistry', mockRegistry);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance(AuditLogger, mockAuditLogger as any);

    runner = container.resolve(AgentRunner);
  });

  it('should handle agent not found gracefully', async () => {
    const mockRegistry = container.resolve('IAgentRegistry') as any;
    mockRegistry.getAgent.mockReturnValue(null);

    // 模拟发布事件
    const event = { agentId: 'non_existent', intent: {} } as any;
    await (runner as any).handleAgentSelected(event);

    expect(mockRegistry.getAgent).toHaveBeenCalledWith('non_existent');
  });

  it('should handle execution error and publish failure event', async () => {
    const mockEventBus = container.resolve('IEventBus') as any;
    const mockRegistry = container.resolve('IAgentRegistry') as any;
    
    mockRegistry.getAgent.mockReturnValue({
      execute: jest.fn().mockRejectedValue(new Error('Execution failed'))
    });

    const event = { agentId: 'test', intent: {} } as any;
    await (runner as any).handleAgentSelected(event);

    expect(mockEventBus.publish).toHaveBeenCalled();
  });
});
