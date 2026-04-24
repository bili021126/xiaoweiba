/**
 * HybridRetriever 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { HybridRetriever } from '../../../src/core/application/HybridRetriever';
import { createMockDatabaseManager } from '../../__mocks__/globalMocks';

describe('HybridRetriever Simplified', () => {
  let hybridRetriever: HybridRetriever;

  beforeEach(() => {
    container.clearInstances();
    
    const mockDbManager = createMockDatabaseManager();
    container.registerInstance('DatabaseManager', mockDbManager);
    
    hybridRetriever = container.resolve(HybridRetriever);
  });

  it('should initialize without errors', () => {
    expect(hybridRetriever).toBeDefined();
  });
});
