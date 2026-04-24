/**
 * AgentRunner 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { AgentRunner } from '../../../../src/infrastructure/agent/AgentRunner';
import { createMockEventBus, createMockAgentRegistry, createMockMemoryPort } from '../../../__mocks__/globalMocks';
import { AuditLogger } from '../../../../src/core/security/AuditLogger';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

describe('AgentRunner Simplified', () => {
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

  it('should initialize without errors', () => {
    expect(runner).toBeDefined();
  });
});
