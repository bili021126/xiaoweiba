/**
 * InlineCompletionAgent 单元测试 - LLM 调用分支覆盖测试
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { InlineCompletionAgent } from '../../../src/agents/InlineCompletionAgent';
import { createMockLLMPort } from '../../__mocks__/globalMocks';

describe('InlineCompletionAgent (Branch Coverage)', () => {
  let agent: InlineCompletionAgent;
  let mockLLM: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockLLM = createMockLLMPort({
      call: jest.fn().mockResolvedValue({ 
        success: true, 
        text: '.map(item => item.id)' 
      })
    });
    
    container.registerInstance('ILLMPort', mockLLM);
    
    agent = container.resolve(InlineCompletionAgent);
  });

  it('should throw error if not initialized', async () => {
    await expect(agent.execute({
      intent: { name: 'inline_completion' } as any,
      memoryContext: {} as any
    })).rejects.toThrow('Agent未初始化');
  });

  it('should return failure when prefix is too short', async () => {
    await agent.initialize();

    const result = await agent.execute({
      intent: { 
        name: 'inline_completion' as any,
        userInput: 'ab'
      } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('代码前缀太短');
  });

  it('should complete code successfully', async () => {
    await agent.initialize();

    const result = await agent.execute({
      intent: { 
        name: 'inline_completion' as any,
        userInput: 'const items = data',
        codeContext: { language: 'typescript' }
      } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(true);
    expect(mockLLM.call).toHaveBeenCalled();
  });

  it('should handle LLM completion failure', async () => {
    await agent.initialize();
    mockLLM.call.mockResolvedValue({ success: false, error: 'Completion failed' });

    const result = await agent.execute({
      intent: { 
        name: 'inline_completion' as any,
        userInput: 'const items = data',
        codeContext: { language: 'typescript' }
      } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Completion failed');
  });

  it('should handle LLM errors gracefully', async () => {
    await agent.initialize();
    mockLLM.call.mockRejectedValue(new Error('LLM failed'));

    const result = await agent.execute({
      intent: { 
        name: 'inline_completion' as any,
        userInput: 'const items = data',
        codeContext: { language: 'typescript' }
      } as any,
      memoryContext: {} as any
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM failed');
  });
});
