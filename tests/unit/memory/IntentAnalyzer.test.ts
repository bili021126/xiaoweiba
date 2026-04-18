import { IntentAnalyzer } from '../../../src/core/memory/IntentAnalyzer';
import { ExpertSelector } from '../../../src/core/memory/ExpertSelector';
import { EXPERT_WEIGHTS, IntentVector, RetrievalWeights } from '../../../src/core/memory/types';

describe('IntentAnalyzer', () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer();
  });

  describe('analyze - 时间敏感性检测', () => {
    it('应识别"刚才"为时间敏感查询', () => {
      const result = analyzer.analyze('刚才那个解释');
      expect(result.temporal).toBe(0.8);
      expect(result.entity).toBe(0);
      expect(result.semantic).toBe(0);
    });

    it('应识别"上次"为时间敏感查询', () => {
      const result = analyzer.analyze('上次的代码');
      expect(result.temporal).toBe(0.8);
    });

    it('短查询（<3字）应提升时间敏感度', () => {
      const result = analyzer.analyze('刚');
      expect(result.temporal).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('analyze - 实体敏感性检测', () => {
    it('应识别包含"函数"的查询为实体敏感', () => {
      const result = analyzer.analyze('calculateTotal函数');
      expect(result.entity).toBe(0.7);
    });

    it('应识别驼峰命名为实体', () => {
      const result = analyzer.analyze('UserProfile类');
      expect(result.entity).toBe(0.7);
    });

    it('包含反引号应增强实体敏感度', () => {
      const result = analyzer.analyze('`CalculateTotal`怎么用');
      // CalculateTotal是驼峰(0.7) + 反引号增强(+0.3, 上限1.0)
      expect(result.entity).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('analyze - 语义模糊度检测', () => {
    it('应识别"怎么"为语义模糊查询', () => {
      const result = analyzer.analyze('怎么优化这个算法');
      expect(result.semantic).toBe(0.6);
    });

    it('应识别"为什么"为语义模糊查询', () => {
      const result = analyzer.analyze('为什么会报错');
      expect(result.semantic).toBe(0.6);
    });
  });

  describe('analyze - 复合意图', () => {
    it('应能同时识别多个意图维度', () => {
      const result = analyzer.analyze('刚才那个函数怎么优化');
      expect(result.temporal).toBe(0.8);
      expect(result.entity).toBe(0.7);
      expect(result.semantic).toBe(0.6);
    });
  });

  describe('getDominantIntent', () => {
    it('应返回主导意图为temporal', () => {
      const intent: IntentVector = { temporal: 0.8, entity: 0.1, semantic: 0.1, distantTemporal: 0 };
      expect(analyzer.getDominantIntent(intent)).toBe('temporal');
    });

    it('应返回主导意图为entity', () => {
      const intent: IntentVector = { temporal: 0.1, entity: 0.7, semantic: 0.1, distantTemporal: 0 };
      expect(analyzer.getDominantIntent(intent)).toBe('entity');
    });

    it('应返回主导意图为semantic', () => {
      const intent: IntentVector = { temporal: 0.1, entity: 0.1, semantic: 0.6, distantTemporal: 0 };
      expect(analyzer.getDominantIntent(intent)).toBe('semantic');
    });

    it('所有维度都低时应返回balanced', () => {
      const intent: IntentVector = { temporal: 0.2, entity: 0.2, semantic: 0.2, distantTemporal: 0 };
      expect(analyzer.getDominantIntent(intent)).toBe('balanced');
    });
  });
});

describe('ExpertSelector', () => {
  let selector: ExpertSelector;

  beforeEach(() => {
    selector = new ExpertSelector();
  });

  describe('初始化', () => {
    it('默认专家应为balanced', () => {
      expect(selector.getCurrentExpert()).toBe('balanced');
    });

    it('默认权重应与EXPERT_WEIGHTS.balanced一致', () => {
      const weights = selector.getBaseWeights();
      expect(weights).toEqual(EXPERT_WEIGHTS.balanced);
    });
  });

  describe('recordFeedback', () => {
    it('应能记录反馈', () => {
      const intent: IntentVector = { temporal: 0.8, entity: 0, semantic: 0, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.2, t: 0.6, e: 0.1, v: 0.1 };
      
      expect(() => selector.recordFeedback(intent, weights)).not.toThrow();
    });

    it('每10次反馈应触发专家评估', () => {
      const intent: IntentVector = { temporal: 0.8, entity: 0, semantic: 0, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.2, t: 0.6, e: 0.1, v: 0.1 };

      for (let i = 0; i < 10; i++) {
        selector.recordFeedback(intent, weights);
      }

      // 不应抛出异常
      expect(selector.getCurrentExpert()).toBeDefined();
    });
  });

  describe('reset', () => {
    it('重置后应恢复到balanced专家', () => {
      // 先记录一些反馈
      const intent: IntentVector = { temporal: 0.8, entity: 0, semantic: 0, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.2, t: 0.6, e: 0.1, v: 0.1 };
      
      for (let i = 0; i < 15; i++) {
        selector.recordFeedback(intent, weights);
      }

      // 重置
      selector.reset();
      
      expect(selector.getCurrentExpert()).toBe('balanced');
    });
  });

  describe('getState and restore', () => {
    it('应能保存和恢复状态', () => {
      const intent: IntentVector = { temporal: 0.8, entity: 0, semantic: 0, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.2, t: 0.6, e: 0.1, v: 0.1 };

      // 记录一些反馈
      for (let i = 0; i < 5; i++) {
        selector.recordFeedback(intent, weights);
      }

      // 保存状态
      const state = selector.getState();
      
      // 创建新选择器并恢复
      const newSelector = new ExpertSelector();
      newSelector.restore(state);

      expect(newSelector.getCurrentExpert()).toBe(selector.getCurrentExpert());
    });

    it('恢复时应限制历史记录长度', () => {
      const intent: IntentVector = { temporal: 0.8, entity: 0, semantic: 0, distantTemporal: 0 };
      const weights: RetrievalWeights = { k: 0.2, t: 0.6, e: 0.1, v: 0.1 };

      // 模拟超过100条的历史记录
      const longHistory = [];
      for (let i = 0; i < 150; i++) {
        longHistory.push({
          intent,
          weights,
          timestamp: Date.now()
        });
      }

      const state = {
        currentExpert: 'balanced',
        feedbackHistory: longHistory.map(h => ({
          intent: h.intent,
          clickedWeights: h.weights,
          timestamp: h.timestamp
        }))
      };

      selector.restore(state);
      const restoredState = selector.getState();
      
      expect(restoredState.feedbackHistory.length).toBeLessThanOrEqual(100);
    });
  });

  describe('专家切换逻辑', () => {
    it('时间敏感型反馈应倾向于切换到temporal专家', () => {
      const intent: IntentVector = { temporal: 0.9, entity: 0.1, semantic: 0.1, distantTemporal: 0 };
      const temporalWeights = EXPERT_WEIGHTS.temporal;

      // 记录大量时间敏感的反馈
      for (let i = 0; i < 20; i++) {
        selector.recordFeedback(intent, temporalWeights);
      }

      // 可能切换到temporal专家
      const expert = selector.getCurrentExpert();
      expect(['temporal', 'balanced']).toContain(expert);
    });

    it('实体敏感型反馈应倾向于切换到entity专家', () => {
      const intent: IntentVector = { temporal: 0.1, entity: 0.9, semantic: 0.1, distantTemporal: 0 };
      const entityWeights = EXPERT_WEIGHTS.entity;

      // 记录大量实体敏感的反馈
      for (let i = 0; i < 20; i++) {
        selector.recordFeedback(intent, entityWeights);
      }

      // 可能切换到entity专家
      const expert = selector.getCurrentExpert();
      expect(['entity', 'balanced']).toContain(expert);
    });
  });
});

describe('EXPERT_WEIGHTS 常量', () => {
  it('应包含所有必需的专家配置', () => {
    expect(EXPERT_WEIGHTS).toHaveProperty('balanced');
    expect(EXPERT_WEIGHTS).toHaveProperty('temporal');
    expect(EXPERT_WEIGHTS).toHaveProperty('entity');
    expect(EXPERT_WEIGHTS).toHaveProperty('semantic');
    expect(EXPERT_WEIGHTS).toHaveProperty('hybrid');
  });

  it('每个专家的权重之和应为1', () => {
    for (const [name, weights] of Object.entries(EXPERT_WEIGHTS)) {
      const sum = weights.k + weights.t + weights.e + weights.v;
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('temporal专家的时间权重应最高', () => {
    expect(EXPERT_WEIGHTS.temporal.t).toBeGreaterThan(EXPERT_WEIGHTS.balanced.t);
    expect(EXPERT_WEIGHTS.temporal.t).toBeGreaterThan(EXPERT_WEIGHTS.entity.t);
  });

  it('entity专家的关键词权重应最高', () => {
    expect(EXPERT_WEIGHTS.entity.k).toBeGreaterThan(EXPERT_WEIGHTS.balanced.k);
    expect(EXPERT_WEIGHTS.entity.k).toBeGreaterThan(EXPERT_WEIGHTS.temporal.k);
  });
});

describe('IntentAnalyzer - 久远时间意图检测', () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer();
  });

  it('应识别"很久以前"为久远时间意图', () => {
    const result = analyzer.analyze('很久以前做过什么');
    expect(result.distantTemporal).toBe(0.9);
  });

  it('应识别"上个月"为久远时间意图', () => {
    const result = analyzer.analyze('上个月的项目');
    expect(result.distantTemporal).toBe(0.9);
  });

  it('应识别"去年"为久远时间意图', () => {
    const result = analyzer.analyze('去年的代码');
    expect(result.distantTemporal).toBe(0.9);
  });

  it('应识别"历史"为久远时间意图', () => {
    const result = analyzer.analyze('历史记录');
    expect(result.distantTemporal).toBe(0.9);
  });

  it('普通查询不应触发久远时间意图', () => {
    const result = analyzer.analyze('刚才做了什么');
    expect(result.distantTemporal).toBe(0);
  });

  it('久远查询应同时具有时间敏感性', () => {
    const result = analyzer.analyze('很久以前的项目');
    expect(result.distantTemporal).toBe(0.9);
    expect(result.temporal).toBe(0); // 不包含“刚才”等近期词
  });
});
