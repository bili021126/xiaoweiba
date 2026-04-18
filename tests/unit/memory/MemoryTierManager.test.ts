import { MemoryTierManager, MemoryTier } from '../../../src/core/memory/MemoryTierManager';

describe('MemoryTierManager - 记忆层级管理', () => {
  let tierManager: MemoryTierManager;

  beforeEach(() => {
    tierManager = new MemoryTierManager();
  });

  describe('determineTier() - 层级判断', () => {
    it('应该将当前时间的记忆标记为SHORT_TERM', () => {
      const now = Date.now();
      const tier = tierManager.determineTier(now);
      expect(tier).toBe('SHORT_TERM');
    });

    it('应该将3天前的记忆标记为SHORT_TERM', () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const tier = tierManager.determineTier(threeDaysAgo);
      expect(tier).toBe('SHORT_TERM');
    });

    it('应该将7天前的记忆标记为SHORT_TERM（包含边界）', () => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const tier = tierManager.determineTier(sevenDaysAgo);
      expect(tier).toBe('SHORT_TERM'); // >= 阈值为SHORT_TERM
    });

    it('应该将30天前的记忆标记为LONG_TERM', () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const tier = tierManager.determineTier(thirtyDaysAgo);
      expect(tier).toBe('LONG_TERM');
    });

    it('边界情况：正好7天阈值应该是LONG_TERM', () => {
      const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const tier = tierManager.determineTier(threshold - 1); // 稍微超过阈值
      expect(tier).toBe('LONG_TERM');
    });
  });

  describe('getShortTermCutoff() - 获取截止时间', () => {
    it('应该返回7天前的时间戳', () => {
      const cutoff = tierManager.getShortTermCutoff();
      const expectedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      // 允许1秒误差（由于执行时间）
      expect(Math.abs(cutoff - expectedCutoff)).toBeLessThan(1000);
    });

    it('自定义配置后应该返回正确的截止时间', () => {
      const customManager = new MemoryTierManager({ shortTermDays: 14 });
      const cutoff = customManager.getShortTermCutoff();
      const expectedCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      
      expect(Math.abs(cutoff - expectedCutoff)).toBeLessThan(1000);
    });
  });

  describe('配置管理', () => {
    it('应该使用默认配置（7天）', () => {
      const config = tierManager.getConfig();
      expect(config.shortTermDays).toBe(7);
    });

    it('应该支持自定义配置', () => {
      const customManager = new MemoryTierManager({ shortTermDays: 14 });
      const config = customManager.getConfig();
      expect(config.shortTermDays).toBe(14);
    });

    it('应该支持动态更新配置', () => {
      tierManager.updateConfig({ shortTermDays: 30 });
      const config = tierManager.getConfig();
      expect(config.shortTermDays).toBe(30);
    });

    it('更新配置后应该影响层级判断', () => {
      // 创建10天前的时间戳
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      
      // 默认配置（7天）下应该是LONG_TERM
      expect(tierManager.determineTier(tenDaysAgo)).toBe('LONG_TERM');
      
      // 更新为14天后应该是SHORT_TERM
      tierManager.updateConfig({ shortTermDays: 14 });
      expect(tierManager.determineTier(tenDaysAgo)).toBe('SHORT_TERM');
    });

    it('getConfig应该返回副本，避免外部修改', () => {
      const config1 = tierManager.getConfig();
      config1.shortTermDays = 999; // 修改副本
      
      const config2 = tierManager.getConfig();
      expect(config2.shortTermDays).toBe(7); // 原配置不受影响
    });
  });

  describe('边界情况', () => {
    it('应该处理负数时间戳', () => {
      const negativeTimestamp = -1000;
      const tier = tierManager.determineTier(negativeTimestamp);
      expect(tier).toBe('LONG_TERM');
    });

    it('应该处理未来时间戳', () => {
      const futureTimestamp = Date.now() + 1000000;
      const tier = tierManager.determineTier(futureTimestamp);
      expect(tier).toBe('SHORT_TERM');
    });

    it('应该处理0时间戳', () => {
      const tier = tierManager.determineTier(0);
      expect(tier).toBe('LONG_TERM');
    });
  });

  describe('配置验证', () => {
    it('应该接受部分配置更新', () => {
      tierManager.updateConfig({ shortTermDays: 21 });
      const config = tierManager.getConfig();
      expect(config.shortTermDays).toBe(21);
    });

    it('空配置更新不应该改变现有配置', () => {
      const originalConfig = tierManager.getConfig();
      tierManager.updateConfig({});
      const newConfig = tierManager.getConfig();
      expect(newConfig).toEqual(originalConfig);
    });
  });
});
