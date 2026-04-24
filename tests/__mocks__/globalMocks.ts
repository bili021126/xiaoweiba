/**
 * 全局 Mock 配置 - 统一管理核心端口与基础设施的 Mock 实现
 * 
 * 使用方式：
 * import { createMockMemoryPort, createMockLLMPort } from '../../__mocks__/globalMocks';
 */

import { IMemoryPort } from '../../src/core/ports/IMemoryPort';
import { ILLMPort, LLMCallResult } from '../../src/core/ports/ILLMPort';
import { IEventBus } from '../../src/core/ports/IEventBus';
import { IAgentRegistry } from '../../src/core/ports/IAgentRegistry';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { ProjectFingerprint } from '../../src/utils/ProjectFingerprint';

/**
 * 创建默认的 MemoryPort Mock
 */
export const createMockMemoryPort = (overrides?: Partial<IMemoryPort>): jest.Mocked<IMemoryPort> => {
  return {
    recordMemory: jest.fn().mockResolvedValue('mem_mock_id'),
    retrieveContext: jest.fn().mockResolvedValue({ memories: [], preferences: [] }),
    search: jest.fn().mockResolvedValue([]),
    retrieveAll: jest.fn().mockResolvedValue([]),
    recordFeedback: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({ totalMemories: 0, totalPreferences: 0 }),
    ...overrides
  } as any;
};

/**
 * 创建默认的 LLMPort Mock
 */
export const createMockLLMPort = (overrides?: Partial<ILLMPort>): jest.Mocked<ILLMPort> => {
  const defaultResponse: LLMCallResult = {
    success: true,
    text: 'Mocked LLM response',
    modelId: 'deepseek-v4-flash',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  };

  return {
    call: jest.fn().mockResolvedValue(defaultResponse),
    stream: jest.fn(),
    ...overrides
  } as any;
};

/**
 * 创建默认的 EventBus Mock
 */
export const createMockEventBus = (overrides?: Partial<IEventBus>): jest.Mocked<IEventBus> => {
  return {
    publish: jest.fn(),
    subscribe: jest.fn().mockReturnValue(() => {}), // 返回 unsubscribe 函数
    ...overrides
  } as any;
};

/**
 * 创建默认的 AgentRegistry Mock
 */
export const createMockAgentRegistry = (overrides?: Partial<IAgentRegistry>): jest.Mocked<IAgentRegistry> => {
  return {
    register: jest.fn(),
    getAgent: jest.fn(),
    listAgents: jest.fn().mockReturnValue([]),
    ...overrides
  } as any;
};

/**
 * 创建默认的 DatabaseManager Mock
 */
export const createMockDatabaseManager = (overrides?: Partial<DatabaseManager>): jest.Mocked<DatabaseManager> => {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockReturnValue([]),
    run: jest.fn().mockResolvedValue({ changes: 0 }),
    export: jest.fn().mockReturnValue(new Uint8Array()),
    close: jest.fn(),
    ...overrides
  } as any;
};

/**
 * 创建默认的 ProjectFingerprint Mock
 */
export const createMockProjectFingerprint = (overrides?: Partial<ProjectFingerprint>): jest.Mocked<ProjectFingerprint> => {
  return {
    getFingerprint: jest.fn().mockResolvedValue('fp_mock_1234567890abcdef'),
    ...overrides
  } as any;
};

/**
 * 辅助函数：快速注册一组 Mock 到 tsyringe 容器
 */
export const registerGlobalMocks = (container: any) => {
  container.registerInstance('IMemoryPort', createMockMemoryPort());
  container.registerInstance('ILLMPort', createMockLLMPort());
  container.registerInstance('IEventBus', createMockEventBus());
  container.registerInstance('IAgentRegistry', createMockAgentRegistry());
  container.registerInstance(DatabaseManager, createMockDatabaseManager());
  container.registerInstance(ProjectFingerprint, createMockProjectFingerprint());
};
