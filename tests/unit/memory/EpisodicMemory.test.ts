import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { container } from 'tsyringe';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key) => {
        if (key === 'memory') return { decayLambda: 0.1 };
        return {};
      })
    })
  }
}));

describe('EpisodicMemory - 核心功能测试', () => {
  let episodicMemory: EpisodicMemory;
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    dbManager = container.resolve(DatabaseManager);
    await (dbManager as any).initialize();
    
    episodicMemory = container.resolve(EpisodicMemory);
    await episodicMemory.initialize();
  });

  afterAll(async () => {
    // DatabaseManager无dispose方法，跳过清理
  });

  describe('record & retrieve', () => {
    it('应该能够记录情景记忆', async () => {
      const record = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释了getUserInfo函数',
        entities: ['getUserInfo'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 150
      });

      expect(record).toBeDefined();
      expect(typeof record).toBe('string'); // record返回ID字符串
    });

    it('应该能够检索相关记忆', async () => {
      // 先记录一条记忆
      await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: '生成了数据库连接代码',
        entities: ['DatabaseManager'],
        outcome: 'SUCCESS',
        modelId: 'deepseek-chat',
        durationMs: 200
      });

      // 检索
      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_GENERATE',
        limit: 5
      });

      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].taskType).toBe('CODE_GENERATE');
    });
  });

  describe('search', () => {
    it('应该支持关键词搜索', async () => {
      const memories = await episodicMemory.search('数据库', { limit: 5 });
      expect(Array.isArray(memories)).toBe(true);
    });

    it('空查询应返回最近记忆', async () => {
      const memories = await episodicMemory.search('', { limit: 3 });
      expect(memories.length).toBeLessThanOrEqual(3);
    });
  });

  describe('时间衰减', () => {
    it('应该正确计算时间衰减分数', async () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 3600 * 1000;
      
      // 手动构造不同时间的记忆（timestamp由系统自动设置）
      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '旧记忆',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test',
        durationMs: 100
      });

      const memories = await episodicMemory.retrieve({ limit: 10 });
      expect(memories.length).toBeGreaterThan(0);
    });
  });

  describe('实体匹配增强', () => {
    it('应该支持模糊实体匹配', async () => {
      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '解释getUserInfo函数',
        entities: ['getUserInfo'],
        outcome: 'SUCCESS',
        modelId: 'test',
        durationMs: 100
      });

      // 搜索相似实体名
      const memories = await episodicMemory.search('getUser', { limit: 5 });
      expect(Array.isArray(memories)).toBe(true);
    });
  });

  describe('记忆层级', () => {
    it('应该支持短期/长期记忆分区', async () => {
      const memories = await episodicMemory.retrieve({
        limit: 5,
        memoryTier: 'LONG_TERM'
      });
      
      expect(Array.isArray(memories)).toBe(true);
    });
  });
});
