/**
 * HybridRetriever 单元测试 - 补充核心检索分支
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { HybridRetriever } from '../../../src/core/application/HybridRetriever';
import { createMockDatabaseManager } from '../../__mocks__/globalMocks';

describe('HybridRetriever (Branch Coverage)', () => {
  let hybridRetriever: HybridRetriever;
  let mockDbManager: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockDbManager = createMockDatabaseManager();
    container.registerInstance('DatabaseManager', mockDbManager);
    
    hybridRetriever = container.resolve(HybridRetriever);
  });

  it('should execute keyword search and return results', async () => {
    const mockRecords = [{ id: 'mem1', summary: 'Test' }];
    mockDbManager.query.mockReturnValue(mockRecords);

    const results = await hybridRetriever.search('test query', { limit: 5 });

    expect(results).toBeDefined();
  });

  it('should handle empty search results', async () => {
    mockDbManager.query.mockReturnValue([]);

    const results = await hybridRetriever.search('nonexistent', { limit: 5 });

    expect(results).toEqual([]);
  });

  it('should merge and deduplicate results', async () => {
    // 通过内部方法测试融合逻辑
    const keywordResults = [
      { id: 'mem1', summary: 'Result 1', finalWeight: 0.8 },
      { id: 'mem2', summary: 'Result 2', finalWeight: 0.7 }
    ];
    const semanticResults = [
      { id: 'mem2', summary: 'Result 2', finalWeight: 0.9 },
      { id: 'mem3', summary: 'Result 3', finalWeight: 0.6 }
    ];

    const fused = (hybridRetriever as any).fuseResults(keywordResults, semanticResults);

    expect(fused).toHaveLength(3); // mem1, mem2, mem3
    const ids = fused.map((r: any) => r.id);
    expect(ids).toContain('mem1');
    expect(ids).toContain('mem2');
    expect(ids).toContain('mem3');
  });
});
