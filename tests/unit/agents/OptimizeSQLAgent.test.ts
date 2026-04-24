/**
 * OptimizeSQLAgent 单元测试 - LLM 调用分支覆盖测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { OptimizeSQLAgent } from '../../../src/agents/OptimizeSQLAgent';
import { createMockLLMPort, createMockEventBus } from '../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null,
    showWarningMessage: jest.fn(),
    withProgress: jest.fn((_: any, callback: any) => callback({ report: jest.fn() }))
  },
  ProgressLocation: {
    Notification: 1
  }
}));

describe('OptimizeSQLAgent (Branch Coverage)', () => {
  let agent: OptimizeSQLAgent;
  let mockLLM: any;
  let mockEventBus: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort({
      call: jest.fn().mockResolvedValue({ 
        success: true, 
        text: 'SELECT * FROM users WHERE id = ? -- 已优化' 
      })
    });
    mockEventBus = createMockEventBus();
    
    container.registerInstance('ILLMPort', mockLLM);
    container.registerInstance('IEventBus', mockEventBus);
    
    agent = container.resolve(OptimizeSQLAgent);
  });

  it('should return failure when no active editor', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = null;

    const result = await agent.execute({
      intent: { name: 'optimize_sql' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active editor');
  });

  it('should return failure when no SQL selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('')
      }
    };

    const result = await agent.execute({
      intent: { name: 'optimize_sql' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No SQL selected');
  });

  it('should optimize SQL successfully', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('SELECT * FROM users')
      }
    };

    const result = await agent.execute({
      intent: { name: 'optimize_sql' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(true);
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM optimization failure', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('SELECT * FROM users')
      }
    };
    
    mockLLM.call.mockResolvedValue({ success: false, error: 'Invalid SQL' });

    await expect(agent.execute({
      intent: { name: 'optimize_sql' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('SQL优化失败');
  });

  it('should handle LLM errors gracefully', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('SELECT * FROM users')
      }
    };
    
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));

    await expect(agent.execute({
      intent: { name: 'optimize_sql' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('LLM failed');
  });
});
