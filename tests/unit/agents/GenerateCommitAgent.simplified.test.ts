/**
 * GenerateCommitAgent 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { GenerateCommitAgent } from '../../../src/agents/GenerateCommitAgent';
import { createMockLLMPort, createMockMemoryPort, createMockEventBus } from '../../__mocks__/globalMocks';
import { TaskTokenManager } from '../../../src/core/security/TaskTokenManager';
import { CommitStyleLearner } from '../../../src/core/memory/CommitStyleLearner';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() },
  scm: { inputBox: { value: '' } }
}));

describe('GenerateCommitAgent Simplified', () => {
  let agent: GenerateCommitAgent;

  beforeEach(() => {
    container.clearInstances();
    
    const mockLLM = createMockLLMPort({ call: jest.fn().mockResolvedValue({ success: true, text: 'feat: test' }) });
    const mockMemory = createMockMemoryPort();
    const mockEventBus = createMockEventBus();
    const mockTaskTokenManager = new TaskTokenManager();
    const mockStyleLearner = { learn: jest.fn(), getStyle: jest.fn() };

    container.registerInstance('ILLMPortPro', mockLLM);
    container.registerInstance('IMemoryPort', mockMemory);
    container.registerInstance('IEventBus', mockEventBus);
    container.registerInstance(TaskTokenManager, mockTaskTokenManager);
    container.registerInstance(CommitStyleLearner, mockStyleLearner as any);
    
    agent = container.resolve(GenerateCommitAgent);
  });

  it('should initialize without errors', () => {
    expect(agent).toBeDefined();
  });

  it('should execute and generate commit message', async () => {
    const result = await agent.execute({ 
      intent: { name: 'generate_commit' as any }, 
      memoryContext: { memories: [], preferences: [] } 
    } as any);
    
    expect(result).toBeDefined();
  });
});
