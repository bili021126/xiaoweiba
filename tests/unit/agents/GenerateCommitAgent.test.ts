/**
 * GenerateCommitAgent 单元测试 - LLM 调用分支覆盖测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { GenerateCommitAgent } from '../../../src/agents/GenerateCommitAgent';
import { createMockLLMPort, createMockMemoryPort, createMockEventBus } from '../../__mocks__/globalMocks';
import { TaskTokenManager } from '../../../src/core/security/TaskTokenManager';
import { CommitStyleLearner } from '../../../src/core/memory/CommitStyleLearner';

jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: null
  },
  window: {
    showWarningMessage: jest.fn(),
    withProgress: jest.fn((_: any, callback: any) => callback({ report: jest.fn() }))
  },
  ProgressLocation: {
    Notification: 1
  }
}));

describe('GenerateCommitAgent (Branch Coverage)', () => {
  let agent: GenerateCommitAgent;
  let mockLLM: any;
  let mockMemoryPort: any;
  let mockEventBus: any;
  let mockTaskTokenManager: any;
  let mockStyleLearner: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort({
      call: jest.fn().mockResolvedValue({ 
        success: true, 
        text: 'feat: add new feature' 
      })
    });
    mockMemoryPort = createMockMemoryPort();
    mockEventBus = createMockEventBus();
    mockTaskTokenManager = new TaskTokenManager();
    mockStyleLearner = { learn: jest.fn(), getStyle: jest.fn() };
    
    container.registerInstance('ILLMPortPro', mockLLM);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance(TaskTokenManager, mockTaskTokenManager);
    container.registerInstance(CommitStyleLearner, mockStyleLearner as any);
    
    agent = container.resolve(GenerateCommitAgent);
  });

  it('should return failure when no workspace', async () => {
    const vscode = require('vscode');
    vscode.workspace.workspaceFolders = null;

    const result = await agent.execute({
      intent: { name: 'generate_commit' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No workspace');
  });

  it('should generate commit message successfully', async () => {
    const vscode = require('vscode');
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    vscode.window.showWarningMessage.mockResolvedValue(undefined);
    
    // Mock child_process exec
    jest.mock('child_process', () => ({
      exec: jest.fn((_: any, callback: any) => callback(null, { stdout: 'diff content' }))
    }));

    const result = await agent.execute({
      intent: { name: 'generate_commit' } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(true);
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM generation failure', async () => {
    const vscode = require('vscode');
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    vscode.window.showWarningMessage.mockResolvedValue(undefined);
    
    mockLLM.call.mockResolvedValue({ success: false, error: 'Generation failed' });

    await expect(agent.execute({
      intent: { name: 'generate_commit' } as any,
      memoryContext: {} as any
    })).rejects.toThrow();
  });

  it('should handle LLM errors gracefully', async () => {
    const vscode = require('vscode');
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    vscode.window.showWarningMessage.mockResolvedValue(undefined);
    
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));

    await expect(agent.execute({
      intent: { name: 'generate_commit' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('LLM failed');
  });
});
