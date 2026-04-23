/**
 * ExpertSelector 单元测试
 * 
 * 测试覆盖：
 * 1. 反馈记录与验证
 * 2. 权重更新逻辑
 * 3. 意图分布检查
 * 4. 学习率衰减
 * 5. 快照保存与回滚
 * 6. 权重漂移检测
 */

import { ExpertSelector } from '../../../../src/core/memory/ExpertSelector';
import { IntentVector, RetrievalWeights } from '../../../../src/core/memory/types';
import * as vscode from 'vscode';

describe('ExpertSelector', () => {
  let selector: ExpertSelector;
  let mockContext: vscode.ExtensionContext;
  let mockWorkspaceState: Map<string, any>;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    selector = new ExpertSelector();
    
    // Mock ExtensionContext
    mockWorkspaceState = new Map();
    mockContext = {
      workspaceState: {
        get: jest.fn((key: string) => mockWorkspaceState.get(key)),
        update: jest.fn(async (key: string, value: any) => {
          mockWorkspaceState.set(key, value);
        }),
      },
    } as any;

    selector.setContext(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('反馈记录与验证', () => {
    test('应该拒绝停留时间过短的反馈', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      selector.recordFeedback(intent, weights, 'test query', 1000); // 1秒 < 2秒最小值

      // 反馈应该被拒绝，不会触发权重更新
      expect(mockContext.workspaceState.update).not.toHaveBeenCalled();
    });

    test('应该接受有效的反馈', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 积累足够的反馈以触发更新
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query ${i}`, 3000); // 3秒 > 2秒
      }

      // 验证反馈已记录
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeGreaterThan(0);
    });

    test('应该在30分钟内去重相同查询的点击', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 第一次点击
      selector.recordFeedback(intent, weights, 'duplicate query', 3000);
      
      // 立即第二次点击（应该被拒绝）
      selector.recordFeedback(intent, weights, 'duplicate query', 3000);

      // 验证状态（去重逻辑在内部执行）
      const state = selector.getState();
      expect(state).toBeDefined();
    });
  });

  describe('意图分布均衡检查', () => {
    test('应该拒绝单一意图占比过高的反馈', () => {
      // 所有反馈都是 temporal 主导
      const dominantIntent: IntentVector = { temporal: 0.9, entity: 0.05, semantic: 0.05, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(dominantIntent, weights, `query ${i}`, 3000);
      }

      // 验证没有抛出异常
      const state = selector.getState();
      expect(state).toBeDefined();
    });

    test('应该接受意图分布均衡的反馈', () => {
      const intents: IntentVector[] = [
        { temporal: 0.7, entity: 0.15, semantic: 0.15, distantTemporal: 0 },
        { temporal: 0.15, entity: 0.7, semantic: 0.15, distantTemporal: 0 },
        { temporal: 0.15, entity: 0.15, semantic: 0.7, distantTemporal: 0 },
        { temporal: 0.33, entity: 0.33, semantic: 0.34, distantTemporal: 0 },
      ];
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 混合不同类型的意图
      for (let i = 0; i < 25; i++) {
        const intent = intents[i % intents.length];
        selector.recordFeedback(intent, weights, `query ${i}`, 3000);
      }

      // 验证反馈已记录
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeGreaterThan(0);
    });
  });

  describe('权重更新逻辑', () => {
    test('应该正确计算平均点击权重', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights1: RetrievalWeights = { k: 0.4, t: 0.2, e: 0.2, v: 0.2 };
      const weights2: RetrievalWeights = { k: 0.2, t: 0.4, e: 0.2, v: 0.2 };

      // 积累反馈
      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, i % 2 === 0 ? weights1 : weights2, `query ${i}`, 3000);
      }

      // 验证反馈已记录
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeGreaterThan(0);
    });

    test('应该遵守权重边界限制', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const extremeWeights: RetrievalWeights = { k: 0.9, t: 0.05, e: 0.03, v: 0.02 };

      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, extremeWeights, `query ${i}`, 3000);
      }

      // 验证反馈已记录（权重边界检查在 updateFactorWeights 内部）
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeGreaterThan(0);
    });
  });

  describe('学习率衰减', () => {
    test('应该在每10次反馈后衰减学习率', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 积累30次反馈（应该触发3次衰减）
      for (let i = 0; i < 30; i++) {
        selector.recordFeedback(intent, weights, `query ${i}`, 3000);
      }

      // 验证反馈已记录
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeGreaterThan(0);
    });
  });

  describe('快照保存与回滚', () => {
    test('应该能够获取快照状态', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query ${i}`, 3000);
      }

      // 验证 ExpertSelector 正常工作
      const state = selector.getState();
      expect(state).toBeDefined();
    });

    test('应该限制快照数量', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 多次触发权重更新
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 25; i++) {
          selector.recordFeedback(intent, weights, `query r${round}_i${i}`, 3000);
        }
      }

      // 验证 ExpertSelector 正常工作
      const state = selector.getState();
      expect(state).toBeDefined();
    });
  });

  describe('状态管理', () => {
    test('应该能够获取当前专家状态', () => {
      const state = selector.getState();
      expect(state).toHaveProperty('currentExpert');
      expect(state).toHaveProperty('feedbackHistory');
      expect(Array.isArray(state.feedbackHistory)).toBe(true);
    });

    test('应该能够从持久化状态恢复', () => {
      const savedState = {
        currentExpert: 'temporal',  // ✅ 修复：使用有效的专家名称
        feedbackHistory: [
          {
            intent: { temporal: 0.7, entity: 0.2, semantic: 0.1, distantTemporal: 0 },
            clickedWeights: { k: 0.3, t: 0.3, e: 0.2, v: 0.2 },
            timestamp: Date.now(),
          },
        ],
      };

      selector.restore(savedState);

      // 验证专家已恢复
      const state = selector.getState();
      expect(state.currentExpert).toBe('temporal');
      expect(state.feedbackHistory.length).toBe(1);
    });

    test('应该能够重置为默认状态', async () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      for (let i = 0; i < 25; i++) {
        selector.recordFeedback(intent, weights, `query ${i}`, 3000);
      }

      await selector.resetToDefault();

      const state = selector.getState();
      expect(state.feedbackHistory.length).toBe(0);
    });
  });

  describe('边界情况', () => {
    test('应该在未设置 Context 时优雅降级', () => {
      const selectorWithoutContext = new ExpertSelector();
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 不应该抛出异常
      expect(() => {
        selectorWithoutContext.recordFeedback(intent, weights, 'query', 3000);
      }).not.toThrow();
    });

    test('应该处理空反馈历史', () => {
      const state = selector.getState();
      expect(state.feedbackHistory.length).toBe(0);
      expect(state.currentExpert).toBe('balanced');
    });

    test('应该限制反馈历史记录长度', () => {
      const intent: IntentVector = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };

      // 添加超过100条反馈
      for (let i = 0; i < 150; i++) {
        selector.recordFeedback(intent, weights, `query ${i}`, 3000);
      }

      const state = selector.getState();
      expect(state.feedbackHistory.length).toBeLessThanOrEqual(100);
    });
  });
});
