/**
 * ExplainCodeAgent 单元测试 - LLM 调用分支覆盖测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ExplainCodeAgent } from '../../../src/agents/ExplainCodeAgent';
import { createMockLLMPort, createMockMemoryPort, createMockEventBus } from '../../__mocks__/globalMocks';

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

describe('ExplainCodeAgent (Branch Coverage)', () => {
  let agent: ExplainCodeAgent;
  let mockLLM: any;
  let mockMemoryPort: any;
  let mockEventBus: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort({
      call: jest.fn().mockResolvedValue({ 
        success: true, 
        text: '这是一个函数，用于处理数据' 
      })
    });
    mockMemoryPort = createMockMemoryPort();
    mockEventBus = createMockEventBus();
    
    container.registerInstance('ILLMPortPro', mockLLM);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('IEventBus', mockEventBus);
    
    agent = container.resolve(ExplainCodeAgent);
  });

  it('should return failure when no active editor', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = null;

    const result = await agent.execute({
      intent: { name: 'explain_code' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active editor');
  });

  it('should return failure when no code selected', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('')
      }
    };

    const result = await agent.execute({
      intent: { name: 'explain_code' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No code selected');
  });

  it('should explain code successfully', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('const x = 1;'),
        languageId: 'typescript'
      }
    };

    const result = await agent.execute({
      intent: { name: 'explain_code' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(true);
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM explanation failure', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('const x = 1;'),
        languageId: 'typescript'
      }
    };
    
    mockLLM.call.mockResolvedValue({ success: false, error: 'Explanation failed' });

    await expect(agent.execute({
      intent: { name: 'explain_code' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('代码解释失败');
  });

  it('should handle LLM errors gracefully', async () => {
    const vscode = require('vscode');
    vscode.window.activeTextEditor = {
      selection: {},
      document: {
        getText: jest.fn().mockReturnValue('const x = 1;'),
        languageId: 'typescript'
      }
    };
    
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));

    await expect(agent.execute({
      intent: { name: 'explain_code' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('LLM failed');
  });
});
