/**
 * CheckNamingAgent 单元测试 - LLM 调用分支覆盖测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { CheckNamingAgent } from '../../../src/agents/CheckNamingAgent';
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

describe('CheckNamingAgent (Branch Coverage)', () => {
  let agent: CheckNamingAgent;
  let mockLLM: any;
  let mockEventBus: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort({
      call: jest.fn().mockResolvedValue({ success: true, text: '符合规范' })
    });
    mockEventBus = createMockEventBus();
    
    container.registerInstance('ILLMPort', mockLLM);
    container.registerInstance('IEventBus', mockEventBus);
    
    agent = container.resolve(CheckNamingAgent);
  });

  it('should return failure when no active editor', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = null;

    const result = await agent.execute({
      intent: { name: 'check_naming' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active editor');
  });

  it('should return failure when selection is empty', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = { selection: { isEmpty: true } };

    const result = await agent.execute({
      intent: { name: 'check_naming' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No selection');
  });

  it('should return failure when selected text is empty', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: { isEmpty: false },
      document: {
        getText: jest.fn().mockReturnValue(''),
        languageId: 'typescript'
      }
    };

    const result = await agent.execute({
      intent: { name: 'check_naming' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty selection');
  });

  it('should call LLM and return success with valid selection', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: { isEmpty: false },
      document: {
        getText: jest.fn().mockReturnValue('myVariable'),
        languageId: 'typescript'
      }
    };

    const result = await agent.execute({
      intent: { name: 'check_naming' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(true);
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM errors gracefully', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: { isEmpty: false },
      document: {
        getText: jest.fn().mockReturnValue('myVariable'),
        languageId: 'typescript'
      }
    };
    
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));

    await expect(agent.execute({
      intent: { name: 'check_naming' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('LLM failed');
  });
});
