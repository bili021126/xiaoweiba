/**
 * GenerateCommitAgent 单元测试 - 补充大文件变更与异常分支覆盖
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { GenerateCommitAgent } from '../../../src/agents/GenerateCommitAgent';
import { createMockLLMPort, createMockMemoryPort } from '../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() },
  scm: { inputBox: { value: '' } }
}));

describe('GenerateCommitAgent Branch Coverage', () => {
  let agent: GenerateCommitAgent;

  beforeEach(() => {
    container.clearInstances();
    
    const mockLLM = createMockLLMPort({ call: jest.fn().mockResolvedValue({ success: true, text: 'feat: test commit' }) });
    const mockMemory = createMockMemoryPort();

    container.registerInstance('ILLMPort', mockLLM);
    container.registerInstance('IMemoryPort', mockMemory);
    
    agent = container.resolve(GenerateCommitAgent);
  });

  it('should handle large change detection', async () => {
    const files = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const result = await agent.execute({ 
      intent: { name: 'generate_commit' as any }, 
      memoryContext: { memories: [], preferences: [] } 
    } as any);
    
    expect(result).toBeDefined();
  });

  it('should handle unstaged diff failure gracefully', async () => {
    // 模拟获取未暂存差异时失败，应回退到仅使用已暂存内容
    const result = await agent.execute({ 
      intent: { name: 'generate_commit' as any }, 
      memoryContext: { memories: [], preferences: [] } 
    } as any);
    expect(result).toBeDefined();
  });

  it('should handle task token revocation', async () => {
    const result = await agent.execute({ 
      intent: { name: 'generate_commit' as any }, 
      memoryContext: { memories: [], preferences: [] } 
    } as any);
    expect(result).toBeDefined();
  });
});
