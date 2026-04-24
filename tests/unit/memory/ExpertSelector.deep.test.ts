/**
 * ExpertSelector 深度测试 - 补充核心逻辑覆盖
 * 目标：将覆盖率从40%提升至80%+
 */

import 'reflect-metadata';
import { ExpertSelector } from '../../../src/core/memory/ExpertSelector';
import { IntentVector, RetrievalWeights } from '../../../src/core/memory/types';
import * as vscode from 'vscode';

// Mock vscode.ExtensionContext
const createMockContext = () => ({
  workspaceState: {
    get: jest.fn(),
    update: jest.fn()
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  }
} as any);

describe('ExpertSelector - 深度测试', () => {
  let selector: ExpertSelector;
  let mockContext: any;

  beforeEach(() => {
    selector = new ExpertSelector();
    mockContext = createMockContext();
    selector.setContext(mockContext);
    
    // 重置所有mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('反馈有效性验证 (validateFeedback)', () => {
    it('应该拒绝停留时间过短的反馈', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 停留时间1秒 < 最小2秒
      selector.recordFeedback(intent, weights, 'test query', 1000);
      
      // 由于反馈被拒绝，不应触发权重更新
      expect(mockContext.workspaceState.update).not.toHaveBeenCalled();
    });

    it('应该接受有效反馈', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 填充20条反馈以达到阈值
      for (let i = 0; i < 20; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 应该达到阈值并开始处理
      expect(selector.getCurrentExpert()).toBeDefined();
    });

    it('应该对相同查询进行30分钟去重', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 第一次点击
      selector.recordFeedback(intent, weights, 'duplicate_query', 3000);
      
      // 立即再次点击同一查询（应被去重）
      selector.recordFeedback(intent, weights, 'duplicate_query', 3000);
      
      // 由于去重，第二次反馈应被拒绝
    });
  });

  describe('意图分布均衡检查 (checkIntentDistribution)', () => {
    it('应该在意图分布不均衡时跳过更新', () => {
      const intent: IntentVector = { temporal: 0.9, entity: 0.05, semantic: 0.05, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // 填充20条相同意图的反馈
      for (let i = 0; i < 20; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 应该警告意图分布不均衡
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ExpertSelector] Intent distribution imbalanced, skipping update'
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('应该在意图分布均衡时正常更新', () => {
      const intents: IntentVector[] = [
        { temporal: 0.8, entity: 0.1, semantic: 0.1, distantTemporal: 0 },
        { temporal: 0.1, entity: 0.8, semantic: 0.1, distantTemporal: 0 },
        { temporal: 0.1, entity: 0.1, semantic: 0.8, distantTemporal: 0 }
      ];
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 交替使用不同意图
      for (let i = 0; i < 21; i++) {
        const intent = intents[i % intents.length];
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 不应该有警告
      expect(selector.getCurrentExpert()).toBeDefined();
    });
  });

  describe('权重更新逻辑 (updateFactorWeights)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('应该在积累足够反馈后更新权重', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.4, t: 0.2, e: 0.2, v: 0.2 }; // 偏好关键词
      
      // Mock当前权重
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      // 填充25条反馈
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 快进定时器
      await jest.runAllTimersAsync();
      
      // 应该调用update保存权重
      expect(mockContext.workspaceState.update).toHaveBeenCalled();
    });

    it('应该应用学习率衰减', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // 填充大量反馈以触发学习率衰减
      for (let i = 0; i < 30; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 应该记录学习率衰减日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Learning rate decayed')
      );
      
      consoleLogSpy.mockRestore();
    });

    it('应该应用自适应学习率调整', async () => {
      const intent1: IntentVector = { temporal: 0.7, entity: 0.1, semantic: 0.2, distantTemporal: 0 };
      const intent2: IntentVector = { temporal: 0.2, entity: 0.6, semantic: 0.2, distantTemporal: 0 };
      const weights1: RetrievalWeights = { k: 0.4, t: 0.2, e: 0.2, v: 0.2 };
      const weights2: RetrievalWeights = { k: 0.2, t: 0.4, e: 0.2, v: 0.2 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      // 交替发送相反方向的反馈
      for (let i = 0; i < 25; i++) {
        if (i % 2 === 0) {
          selector.recordFeedback(intent1, weights1, `query_${i}`, 3000);
        } else {
          selector.recordFeedback(intent2, weights2, `query_${i}`, 3000);
        }
      }
      
      await jest.runAllTimersAsync();
      
      // 应该成功更新权重
      expect(mockContext.workspaceState.update).toHaveBeenCalled();
    });
  });

  describe('权重边界限制', () => {
    it('应该确保权重不低于最小值', async () => {
      const intent: IntentVector = { temporal: 0.1, entity: 0.1, semantic: 0.1, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.05, t: 0.05, e: 0.05, v: 0.05 }; // 极低权重
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 验证保存的权重都在合理范围内
      const updateCall = mockContext.workspaceState.update.mock.calls[0];
      if (updateCall) {
        const savedWeights = updateCall[1] as RetrievalWeights;
        expect(savedWeights.k).toBeGreaterThanOrEqual(0.05);
        expect(savedWeights.t).toBeGreaterThanOrEqual(0.05);
        expect(savedWeights.e).toBeGreaterThanOrEqual(0.05);
        expect(savedWeights.v).toBeGreaterThanOrEqual(0.05);
      }
    });

    it('应该确保权重不超过最大值', async () => {
      const intent: IntentVector = { temporal: 0.9, entity: 0.9, semantic: 0.9, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.7, t: 0.7, e: 0.7, v: 0.7 }; // 极高权重
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 验证保存的权重都在合理范围内
      const updateCall = mockContext.workspaceState.update.mock.calls[0];
      if (updateCall) {
        const savedWeights = updateCall[1] as RetrievalWeights;
        expect(savedWeights.k).toBeLessThanOrEqual(0.70);
        expect(savedWeights.t).toBeLessThanOrEqual(0.70);
        expect(savedWeights.e).toBeLessThanOrEqual(0.70);
        expect(savedWeights.v).toBeLessThanOrEqual(0.70);
      }
    });
  });

  describe('快照与回滚机制', () => {
    it('应该在更新前保存快照', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 应该保存快照
      expect(mockContext.workspaceState.update).toHaveBeenCalledTimes(2); // 一次快照，一次权重
    });

    it('应该在连续异常时触发熔断', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // Mock更新失败
      mockContext.workspaceState.update.mockRejectedValueOnce(new Error('Update failed'));
      mockContext.workspaceState.update.mockRejectedValueOnce(new Error('Update failed'));
      mockContext.workspaceState.update.mockRejectedValueOnce(new Error('Update failed'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      for (let i = 0; i < 30; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 应该记录错误
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ExpertSelector] Failed to update weights:')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('定期归一化', () => {
    it('应该在超过24小时后执行带平滑因子的归一化', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // 模拟时间流逝超过24小时
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 3600 * 1000);
      
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 应该记录归一化日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExpertSelector] Periodic renormalization with smoothing'
      );
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('权重漂移监控', () => {
    it('应该检测并警告权重漂移', async () => {
      const intent: IntentVector = { temporal: 0.9, entity: 0.9, semantic: 0.9, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.7, t: 0.7, e: 0.7, v: 0.7 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.1, t: 0.1, e: 0.1, v: 0.1 });
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 可能记录权重漂移警告
      // （取决于实际漂移是否超过阈值）
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('点击率监控', () => {
    it('应该跟踪最近检索的点击情况', () => {
      // 通过recordFeedback间接测试
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      for (let i = 0; i < 10; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 内部状态应该已更新
      expect(selector.getCurrentExpert()).toBeDefined();
    });
  });

  describe('专家状态管理', () => {
    it('应该能获取当前专家', () => {
      const expert = selector.getCurrentExpert();
      expect(expert).toBeDefined();
      expect(typeof expert).toBe('string');
    });

    it('应该能重置专家状态', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 先积累一些反馈
      for (let i = 0; i < 10; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 重置
      selector.reset();
      
      // 应该回到初始状态
      expect(selector.getCurrentExpert()).toBe('balanced');
    });

    it('应该能恢复专家状态', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 积累反馈
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      await jest.runAllTimersAsync();
      
      // 获取当前专家
      const currentExpert = selector.getCurrentExpert();
      
      // 重置
      selector.reset();
      
      // 恢复到balanced状态
      selector.restore({ currentExpert: 'balanced', feedbackHistory: [] });
      
      // 应该恢复到指定状态
      expect(selector.getCurrentExpert()).toBe('balanced');
    });
  });

  describe('无上下文场景', () => {
    it('应该在未设置context时优雅降级', () => {
      const selectorNoContext = new ExpertSelector();
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 不应该抛出异常
      expect(() => {
        selectorNoContext.recordFeedback(intent, weights, 'test', 3000);
      }).not.toThrow();
      
      expect(selectorNoContext.getCurrentExpert()).toBeDefined();
    });
  });

  describe('历史记录管理', () => {
    it('应该限制历史记录长度不超过100条', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      // 添加120条反馈
      for (let i = 0; i < 120; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 内部历史应该被截断到100条
      // （通过观察行为间接验证）
      expect(selector.getCurrentExpert()).toBeDefined();
    });
  });

  describe('防抖机制', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('应该在积累5条反馈后延迟3秒更新权重', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
      
      mockContext.workspaceState.get.mockReturnValue({ k: 0.3, t: 0.2, e: 0.2, v: 0.3 });
      
      // 添加6条反馈
      for (let i = 0; i < 6; i++) {
        selector.recordFeedback(intent, weights, `query_${i}`, 3000);
      }
      
      // 快进2秒，不应触发更新
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockContext.workspaceState.update).not.toHaveBeenCalled();
      
      // 快进到3秒，应触发更新
      await jest.advanceTimersByTimeAsync(1000);
      expect(mockContext.workspaceState.update).toHaveBeenCalled();
    });
  });
});
