/**
 * ChatAgent 单元测试 - 补充核心执行分支
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { ChatAgent } from '../../../src/agents/ChatAgent';
import { createMockLLMPort, createMockMemoryPort } from '../../__mocks__/globalMocks';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn() }
}));

describe('ChatAgent (Branch Coverage)', () => {
  let agent: ChatAgent;
  let mockLLM: any;
  let mockMemoryPort: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort();
    mockMemoryPort = createMockMemoryPort();
    
    container.registerInstance('ILLMPortPro', mockLLM);
    container.registerInstance('IMemoryPort', mockMemoryPort);
    
    agent = container.resolve(ChatAgent);
  });

  it('should execute chat intent successfully', async () => {
    await agent.initialize();
    
    const intent = {
      name: 'chat' as any,
      userInput: 'Hello',
      metadata: { timestamp: Date.now() }
    };
    const memoryContext = { memories: [], preferences: [] };
    
    const result = await agent.execute({ intent, memoryContext } as any);
    
    expect(result).toBeDefined();
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM errors gracefully', async () => {
    await agent.initialize();
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));
    
    const intent = {
      name: 'chat' as any,
      userInput: 'Hello',
      metadata: { timestamp: Date.now() }
    };
    const memoryContext = { memories: [], preferences: [] };
    
    await expect(agent.execute({ intent, memoryContext } as any)).rejects.toThrow('LLM failed');
  });

  it('should include memory context in prompt', async () => {
    await agent.initialize();
    
    const intent = {
      name: 'chat' as any,
      userInput: 'Test',
      metadata: { timestamp: Date.now() }
    };
    const memoryContext = { 
      memories: [{ id: 'mem1', summary: 'Previous chat' }], 
      preferences: [] 
    };
    
    await agent.execute({ intent, memoryContext } as any);
    
    expect(mockLLM.call).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Previous chat')
          })
        ])
      })
    );
  });
});
