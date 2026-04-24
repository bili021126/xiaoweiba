/**
 * IntentDispatcher 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentDispatcher } from '../../../../src/core/application/IntentDispatcher';
import { createMockAgentRegistry, createMockMemoryPort, createMockEventBus } from '../../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  window: { showInformationMessage: jest.fn() }
}));

describe('IntentDispatcher Simplified', () => {
  let dispatcher: IntentDispatcher;

  beforeEach(() => {
    container.clearInstances();
    
    const mockRegistry = createMockAgentRegistry();
    const mockMemoryPort = createMockMemoryPort();
    const mockEventBus = createMockEventBus();

    container.registerInstance('IAgentRegistry', mockRegistry);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('IEventBus', mockEventBus);

    dispatcher = container.resolve(IntentDispatcher);
  });

  it('should initialize without errors', () => {
    expect(dispatcher).toBeDefined();
  });
});
