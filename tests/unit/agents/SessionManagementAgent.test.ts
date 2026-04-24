/**
 * SessionManagementAgent 单元测试 - 纯逻辑测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { SessionManagementAgent } from '../../../src/agents/SessionManagementAgent';
import { createMockMemoryPort, createMockEventBus } from '../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showQuickPick: jest.fn()
  }
}));

describe('SessionManagementAgent (Pure Logic)', () => {
  let agent: SessionManagementAgent;
  let mockMemoryPort: any;
  let mockEventBus: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockMemoryPort = createMockMemoryPort();
    mockEventBus = createMockEventBus();
    
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('IEventBus', mockEventBus);
    
    agent = container.resolve(SessionManagementAgent);
  });

  it('should throw error if not initialized', async () => {
    await expect(agent.execute({
      intent: { name: 'new_session' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('Agent未初始化');
  });

  it('should handle new session successfully', async () => {
    await agent.initialize();
    
    const vscode = require('vscode');
    vscode.window.showInformationMessage.mockResolvedValue(undefined);
    
    const result = await agent.execute({
      intent: { name: 'new_session' } as any,
      memoryContext: {} as any
    });
    
    expect(result.success).toBe(true);
    expect(mockMemoryPort.recordMemory).toHaveBeenCalled();
  });

  it('should handle switch session with valid ID', async () => {
    await agent.initialize();
    
    const vscode = require('vscode');
    vscode.window.showQuickPick.mockResolvedValue({ label: 'Session 1', description: 'session_123' });
    
    const mockSessions = [
      { id: 'session_123', title: 'Session 1' }
    ];
    mockMemoryPort.retrieveAll.mockResolvedValue(mockSessions);
    
    const result = await agent.execute({
      intent: { name: 'switch_session' } as any,
      memoryContext: {} as any
    });
    
    expect(result.success).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'session.switched',
      expect.objectContaining({ sessionId: 'session_123' })
    );
  });

  it('should handle delete session', async () => {
    await agent.initialize();
    
    const vscode = require('vscode');
    vscode.window.showQuickPick.mockResolvedValue({ label: 'Session 1', description: 'session_to_delete' });
    vscode.window.showInformationMessage.mockResolvedValue('删除');
    
    const mockSessions = [
      { id: 'session_to_delete', title: 'Session 1' }
    ];
    mockMemoryPort.retrieveAll.mockResolvedValue(mockSessions);
    
    const result = await agent.execute({
      intent: { name: 'delete_session' } as any,
      memoryContext: {} as any
    });
    
    expect(result.success).toBe(true);
  });
});
