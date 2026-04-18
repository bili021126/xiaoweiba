/**
 * 测试辅助工具 - Mock工厂
 * 
 * 提供统一的Mock对象创建方法，适配新架构（MemorySystem + EventBus）
 */

import { MemorySystem } from '../../src/core/memory/MemorySystem';
import { EventBus } from '../../src/core/eventbus/EventBus';
import { LLMTool } from '../../src/tools/LLMTool';

/**
 * 创建Mock MemorySystem
 */
export function createMockMemorySystem(overrides?: Partial<MemorySystem>): any {
  return {
    retrieveRelevant: jest.fn().mockResolvedValue({
      episodicMemories: [],
      preferenceRecommendations: []
    }),
    executeAction: jest.fn().mockResolvedValue({ success: true }),
    registerAction: jest.fn(),
    proactiveRecommend: jest.fn(),
    dispose: jest.fn(),
    ...overrides
  };
}

/**
 * 创建Mock EventBus
 */
export function createMockEventBus(overrides?: Partial<EventBus>): any {
  return {
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    once: jest.fn(),
    dispose: jest.fn(),
    ...overrides
  };
}

/**
 * 创建Mock LLMTool
 */
export function createMockLLMTool(overrides?: Partial<LLMTool>): any {
  return {
    call: jest.fn().mockResolvedValue({ success: true, data: 'Mock LLM response' }),
    callStream: jest.fn().mockImplementation(async (options: any, onChunk: (chunk: string) => void) => {
      onChunk('Mock');
      onChunk(' stream');
      onChunk(' response');
      return { success: true, data: 'Mock stream response' };
    }),
    ...overrides
  };
}
