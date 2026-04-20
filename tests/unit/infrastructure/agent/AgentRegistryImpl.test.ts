/**
 * AgentRegistryImpl 单元测试
 * 
 * 测试场景：
 * 1. 注册和获取Agent
 * 2. 查找支持特定意图的Agent
 * 3. 注销Agent（动态卸载）
 * 4. 清理所有Agent
 */

import 'reflect-metadata';
import { AgentRegistryImpl } from '../../../../src/infrastructure/agent/AgentRegistryImpl';
import { IAgent } from '../../../../src/core/agent/IAgent';
import { Intent } from '../../../../src/core/domain/Intent';

describe('AgentRegistryImpl', () => {
  let registry: AgentRegistryImpl;

  beforeEach(() => {
    registry = new AgentRegistryImpl();
  });

  describe('注册和获取Agent', () => {
    it('应该成功注册Agent', () => {
      const mockAgent: IAgent = {
        id: 'test_agent',
        name: 'Test Agent',
        supportedIntents: ['test_intent'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      expect(() => registry.register(mockAgent)).not.toThrow();
    });

    it('应该能够通过ID获取已注册的Agent', () => {
      const mockAgent: IAgent = {
        id: 'test_agent',
        name: 'Test Agent',
        supportedIntents: ['test_intent'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(mockAgent);
      const retrieved = registry.getAgent('test_agent');

      expect(retrieved).toBe(mockAgent);
    });

    it('获取不存在的Agent应返回undefined', () => {
      const retrieved = registry.getAgent('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('重复注册同一Agent应覆盖旧实例', () => {
      const agent1: IAgent = {
        id: 'test_agent',
        name: 'Agent 1',
        supportedIntents: ['test_intent'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'test_agent',
        name: 'Agent 2',
        supportedIntents: ['test_intent'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent1);
      registry.register(agent2);

      expect(registry.getAgent('test_agent')).toBe(agent2);
    });
  });

  describe('查找支持特定意图的Agent', () => {
    it('应该返回支持指定意图的所有Agent', () => {
      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['explain_code', 'generate_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['generate_code', 'check_naming'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent3: IAgent = {
        id: 'agent3',
        name: 'Agent 3',
        supportedIntents: ['check_naming'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent1);
      registry.register(agent2);
      registry.register(agent3);

      const intent: Intent = {
        name: 'generate_code',
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const candidates = registry.findAgentsForIntent(intent);

      expect(candidates).toHaveLength(2);
      expect(candidates).toContain(agent1);
      expect(candidates).toContain(agent2);
      expect(candidates).not.toContain(agent3);
    });

    it('没有支持的Agent时应返回空数组', () => {
      const agent: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['explain_code'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent);

      const intent: Intent = {
        name: 'generate_code',
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const candidates = registry.findAgentsForIntent(intent);
      expect(candidates).toHaveLength(0);
    });

    it('应该按优先级排序Agent', () => {
      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['chat'],
        getCapabilities: jest.fn().mockReturnValue([
          { name: 'chat', priority: 5, description: 'Low priority' }
        ]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['chat'],
        getCapabilities: jest.fn().mockReturnValue([
          { name: 'chat', priority: 10, description: 'High priority' }
        ]),
        execute: jest.fn()
      };

      registry.register(agent1);
      registry.register(agent2);

      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const candidates = registry.findAgentsForIntent(intent);

      expect(candidates).toHaveLength(2);
      expect(candidates[0]).toBe(agent2); // 高优先级在前
      expect(candidates[1]).toBe(agent1);
    });
  });

  describe('注销Agent（动态卸载）', () => {
    it('应该成功注销已注册的Agent', () => {
      const mockAgent: IAgent = {
        id: 'test_agent',
        name: 'Test Agent',
        supportedIntents: ['test_intent'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(mockAgent);
      const result = registry.unregister('test_agent');

      expect(result).toBe(true);
      expect(registry.getAgent('test_agent')).toBeUndefined();
    });

    it('注销不存在的Agent应返回false', () => {
      const result = registry.unregister('non_existent');
      expect(result).toBe(false);
    });

    it('注销后不应再被findAgentsForIntent找到', () => {
      const agent: IAgent = {
        id: 'test_agent',
        name: 'Test Agent',
        supportedIntents: ['chat'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent);
      registry.unregister('test_agent');

      const intent: Intent = {
        name: 'chat',
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' }
      };

      const candidates = registry.findAgentsForIntent(intent);
      expect(candidates).toHaveLength(0);
    });
  });

  describe('获取所有Agent', () => {
    it('应该返回所有已注册的Agent', () => {
      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['intent_a'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['intent_b'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent1);
      registry.register(agent2);

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(agent1);
      expect(all).toContain(agent2);
    });

    it('没有任何Agent时应返回空数组', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe('清理资源', () => {
    it('dispose应该清空所有Agent', () => {
      const agent1: IAgent = {
        id: 'agent1',
        name: 'Agent 1',
        supportedIntents: ['intent_a'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      const agent2: IAgent = {
        id: 'agent2',
        name: 'Agent 2',
        supportedIntents: ['intent_b'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn()
      };

      registry.register(agent1);
      registry.register(agent2);
      registry.dispose();

      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getAgent('agent1')).toBeUndefined();
      expect(registry.getAgent('agent2')).toBeUndefined();
    });
  });
});
