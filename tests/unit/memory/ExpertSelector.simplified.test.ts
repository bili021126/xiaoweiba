/**
 * ExpertSelector 单元测试 - 简化版
 */

import 'reflect-metadata';
import { ExpertSelector } from '../../../src/core/memory/ExpertSelector';

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('ExpertSelector Simplified', () => {
  let selector: ExpertSelector;

  beforeEach(() => {
    selector = new ExpertSelector();
  });

  it('should initialize with default weights', () => {
    const expert = selector.getCurrentExpert();
    expect(expert).toBeDefined();
  });

  it('should record feedback without errors', () => {
    const intent = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
    const weights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
    
    expect(() => {
      selector.recordFeedback(intent, weights, 'query_1', 3000);
    }).not.toThrow();
  });

  it('should handle multiple feedback records', () => {
    const intent = { temporal: 0.5, entity: 0.3, semantic: 0.2, distantTemporal: 0 };
    const weights = { k: 0.3, t: 0.2, e: 0.2, v: 0.3 };
    
    for (let i = 0; i < 10; i++) {
      selector.recordFeedback(intent, weights, `query_${i}`, 3000 + i * 100);
    }
    
    const expert = selector.getCurrentExpert();
    expect(expert).toBeDefined();
  });
});
