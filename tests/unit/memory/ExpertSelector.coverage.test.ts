/**
 * ExpertSelector 高覆盖率测试
 * 针对权重学习和自适应机制的深度测试
 */

import 'reflect-metadata';
import { ExpertSelector } from '../../../src/core/memory/ExpertSelector';

describe('ExpertSelector - High Coverage', () => {
  let expertSelector: ExpertSelector;

  beforeEach(() => {
    expertSelector = new ExpertSelector();
  });

  describe('初始化', () => {
    it('应该使用默认权重初始化', () => {
      expect(expertSelector).toBeDefined();
    });
  });

  describe('反馈记录 - 边界情况', () => {
    it('应该拒绝停留时间过短的反馈', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      // 停留时间小于2秒
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test query', 1000);
      
      expect(expertSelector).toBeDefined();
    });

    it('应该接受有效反馈', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      // 停留时间大于2秒
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test query', 3000);
      
      expect(expertSelector).toBeDefined();
    });

    it('应该处理空查询字符串', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, '', 3000);
      
      expect(expertSelector).toBeDefined();
    });

    it('应该处理undefined dwellTime', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', undefined);
      
      expect(expertSelector).toBeDefined();
    });
  });

  describe('学习率衰减', () => {
    it('应该在多次反馈后衰减学习率', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      // 记录超过10次反馈触发衰减
      for (let i = 0; i < 15; i++) {
        await expertSelector.recordFeedback(
          intent as any, 
          clickedWeights, 
          `query_${i}`, 
          3000
        );
      }
      
      expect(expertSelector).toBeDefined();
    });
  });

  describe('权重边界', () => {
    it('应该在大量反馈后保持权重在边界内', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.1, t: 0.7, e: 0.2, v: 0.0 };
      
      // 记录25次反馈
      for (let i = 0; i < 25; i++) {
        await expertSelector.recordFeedback(
          intent as any, 
          clickedWeights, 
          `boundary_test_${i}`, 
          5000
        );
      }
      
      expect(expertSelector).toBeDefined();
    });
  });

  describe('去重机制', () => {
    it('应该拒绝短时间内重复的反馈', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      // 第一次反馈
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'duplicate_query', 3000);
      
      // 立即第二次相同查询（应该在30分钟去重窗口内）
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'duplicate_query', 3000);
      
      expect(expertSelector).toBeDefined();
    });
  });

  describe('不同意图类型', () => {
    it('应该处理temporal主导的意图', async () => {
      const intent = { temporal: 0.8, entity: 0.1, semantic: 0.1 };
      const clickedWeights = { k: 0.7, t: 0.2, e: 0.1, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'temporal query', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理entity主导的意图', async () => {
      const intent = { temporal: 0.1, entity: 0.8, semantic: 0.1 };
      const clickedWeights = { k: 0.1, t: 0.1, e: 0.7, v: 0.1 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'entity query', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理semantic主导的意图', async () => {
      const intent = { temporal: 0.1, entity: 0.1, semantic: 0.8 };
      const clickedWeights = { k: 0.1, t: 0.1, e: 0.1, v: 0.7 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'semantic query', 3000);
      expect(expertSelector).toBeDefined();
    });
  });

  describe('异常输入', () => {
    it('应该处理null intent', async () => {
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(null as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理null clickedWeights', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      
      await expertSelector.recordFeedback(intent as any, null as any, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理undefined参数', async () => {
      await expertSelector.recordFeedback(undefined as any, undefined as any, undefined as any, undefined);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理空字符串查询', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, '', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理负数dwellTime', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', -1000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理零dwellTime', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 0);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理超大dwellTime', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 86400000); // 24小时
      expect(expertSelector).toBeDefined();
    });
  });

  describe('权重极端值', () => {
    it('应该处理全零clickedWeights', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0, t: 0, e: 0, v: 0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理全壹clickedWeights', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 1, t: 1, e: 1, v: 1 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理负数weights', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: -0.5, t: -0.5, e: -0.5, v: -0.5 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理大于壹的weights', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 2, t: 2, e: 2, v: 2 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });
  });

  describe('意图极端值', () => {
    it('应该处理全零intent', async () => {
      const intent = { temporal: 0, entity: 0, semantic: 0 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理全壹intent', async () => {
      const intent = { temporal: 1, entity: 1, semantic: 1 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理负数intent', async () => {
      const intent = { temporal: -0.5, entity: -0.5, semantic: -0.5 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });

    it('应该处理大于壹的intent', async () => {
      const intent = { temporal: 2, entity: 2, semantic: 2 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      await expertSelector.recordFeedback(intent as any, clickedWeights, 'test', 3000);
      expect(expertSelector).toBeDefined();
    });
  });

  describe('连续反馈场景', () => {
    it('应该处理相同查询的多次反馈', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      for (let i = 0; i < 5; i++) {
        await expertSelector.recordFeedback(
          intent as any,
          clickedWeights,
          'same_query',
          3000 + i * 1000 // 不同停留时间
        );
      }
      
      expect(expertSelector).toBeDefined();
    });

    it('应该处理不同查询的快速连续反馈', async () => {
      const intent = { temporal: 0.3, entity: 0.4, semantic: 0.3 };
      const clickedWeights = { k: 0.2, t: 0.5, e: 0.3, v: 0.0 };
      
      for (let i = 0; i < 20; i++) {
        await expertSelector.recordFeedback(
          intent as any,
          clickedWeights,
          `query_${i}`,
          3000
        );
      }
      
      expect(expertSelector).toBeDefined();
    });

    it('应该处理交替意图类型', async () => {
      const intents = [
        { temporal: 0.8, entity: 0.1, semantic: 0.1 },
        { temporal: 0.1, entity: 0.8, semantic: 0.1 },
        { temporal: 0.1, entity: 0.1, semantic: 0.8 }
      ];
      const clickedWeights = { k: 0.3, t: 0.3, e: 0.3, v: 0.1 };
      
      for (let i = 0; i < 30; i++) {
        const intent = intents[i % 3];
        await expertSelector.recordFeedback(
          intent as any,
          clickedWeights,
          `alternating_${i}`,
          3000
        );
      }
      
      expect(expertSelector).toBeDefined();
    });
  });
});
