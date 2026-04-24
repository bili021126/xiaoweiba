/**
 * IntentDispatcher 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentDispatcher } from '../../../../src/core/application/IntentDispatcher';
import { createMockAgentRegistry, createMockMemoryPort, createMockEventBus } from '../../../__mocks__/globalMocks';

import { IntentFactory } from '../../../../src/core/factory/IntentFactory';

jest.mock('vscode', () => ({
  window: { showInformationMessage: jest.fn() }
}));

// Mock console.error to suppress logs in tests
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

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

  it('should dispatch a chat intent successfully', async () => {
    const intent = await IntentFactory.buildChatIntent('Hello');
    const result = await dispatcher.dispatch(intent);
    
    expect(result).toBeDefined();
  });

  it('should handle unknown intent gracefully', async () => {
    const intent = await IntentFactory.buildChatIntent('Test');
    intent.name = 'unknown_intent' as any;
    
    const result = await dispatcher.dispatch(intent);
    expect(result).toBeDefined();
  });
});
