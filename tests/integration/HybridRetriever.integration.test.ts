/**
 * HybridRetriever 集成测试 - 验证四因子混合检索逻辑
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { HybridRetriever } from '../../src/core/application/HybridRetriever';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { QueryExecutor } from '../../src/core/application/QueryExecutor';
import { EmbeddingService } from '../../src/core/application/EmbeddingService';
import { VectorEngine } from '../../src/core/application/VectorEngine';

describe('HybridRetriever Integration Tests', () => {
  let retriever: HybridRetriever;
  let mockQueryExecutor: Partial<QueryExecutor>;
  let mockEmbeddingService: Partial<EmbeddingService>;
  let mockVectorEngine: Partial<VectorEngine>;

  beforeEach(() => {
    container.clearInstances();

    // Mock dependencies
    mockQueryExecutor = {
      searchByKeywords: jest.fn().mockResolvedValue([]),
      getRecentMemories: jest.fn().mockResolvedValue([])
    };
    
    mockEmbeddingService = {
      isModelAvailable: jest.fn().mockReturnValue(false),
      embed: jest.fn().mockResolvedValue([])
    };

    mockVectorEngine = {
      topKSimilarity: jest.fn().mockReturnValue([]),
      calculateHybridScore: jest.fn((v, k, r, e, w) => v * w.vector + k * w.keyword + r * w.recency + e * w.entity)
    };

    const mockDbManager = {} as DatabaseManager;

    container.registerInstance(DatabaseManager, mockDbManager);
    container.registerInstance(QueryExecutor, mockQueryExecutor as QueryExecutor);
    container.registerInstance(EmbeddingService, mockEmbeddingService as EmbeddingService);
    container.registerInstance(VectorEngine, mockVectorEngine as VectorEngine);

    retriever = container.resolve(HybridRetriever);
  });

  it('should perform keyword-only search when vector model is unavailable', async () => {
    (mockQueryExecutor.searchByKeywords as jest.Mock).mockResolvedValue([
      { id: '1', summary: 'test memory', timestamp: Date.now() }
    ]);

    const results = await retriever.search('test query');
    
    expect(mockQueryExecutor.searchByKeywords).toHaveBeenCalled();
    expect(results).toBeDefined();
  });

  it('should apply four-factor weighting in fuseResults', async () => {
    // 模拟一个关键词结果和一个语义结果
    (mockQueryExecutor.searchByKeywords as jest.Mock).mockResolvedValue([
      { id: 'kw1', summary: 'keyword match', timestamp: Date.now() - 1000000 }
    ]);
    
    (mockEmbeddingService.isModelAvailable as jest.Mock).mockReturnValue(true);
    (mockEmbeddingService.embed as jest.Mock).mockResolvedValue([0.1, 0.2]);
    (mockQueryExecutor.getRecentMemories as jest.Mock).mockResolvedValue([
      { id: 'vec1', summary: 'semantic match', timestamp: Date.now(), vector: new Float32Array(384) }
    ]);
    (mockVectorEngine.topKSimilarity as jest.Mock).mockReturnValue([
      { id: 'vec1', summary: 'semantic match', timestamp: Date.now() }
    ]);

    const results = await retriever.search('complex query', { limit: 5, vectorWeight: 0.6, keywordWeight: 0.4 });
    
    expect(mockVectorEngine.calculateHybridScore).toHaveBeenCalled();
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
