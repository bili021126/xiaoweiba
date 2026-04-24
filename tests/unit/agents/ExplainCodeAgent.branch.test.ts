/**
 * ExplainCodeAgent 单元测试 - 补充代码解释分支
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ExplainCodeAgent } from '../../../src/agents/ExplainCodeAgent';
import { createMockLLMPort, createMockMemoryPort } from '../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

describe('ExplainCodeAgent (Branch Coverage)', () => {
  let agent: ExplainCodeAgent;
  let mockLLM: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort();
    const mockMemoryPort = createMockMemoryPort();
    
    container.registerInstance('ILLMPortPro', mockLLM);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    
    agent = container.resolve(ExplainCodeAgent);
  });

  it('should execute explain code intent', async () => {
    const intent = {
      name: 'explain_code' as any,
      codeContext: 'const x = 1;',
      metadata: { timestamp: Date.now() }
    };
    const memoryContext = { memories: [], preferences: [] };
    
    const result = await agent.execute({ intent, memoryContext } as any);
    
    expect(result).toBeDefined();
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle missing code context', async () => {
    const intent = {
      name: 'explain_code' as any,
      metadata: { timestamp: Date.now() }
    };
    const memoryContext = { memories: [], preferences: [] };
    
    await expect(agent.execute({ intent, memoryContext } as any)).rejects.toThrow();
  });
});
