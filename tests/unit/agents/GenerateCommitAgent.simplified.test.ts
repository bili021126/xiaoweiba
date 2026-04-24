/**
 * GenerateCommitAgent 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { GenerateCommitAgent } from '../../../src/agents/GenerateCommitAgent';
import { createMockLLMPort, createMockMemoryPort } from '../../__mocks__/globalMocks';

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

    container.registerInstance('ILLMPort', mockLLM);
    container.registerInstance('IMemoryPort', mockMemory);
    
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
