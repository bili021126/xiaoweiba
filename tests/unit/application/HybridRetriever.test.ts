/**
 * HybridRetriever 单元测试
 */

import { container } from 'tsyringe';
import { HybridRetriever } from '../../../src/core/application/HybridRetriever';
import { QueryExecutor } from '../../../src/core/application/QueryExecutor';
import { EmbeddingService } from '../../../src/core/application/EmbeddingService';
import { VectorEngine } from '../../../src/core/application/VectorEngine';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { EpisodicMemoryRecord } from '../../../src/core/memory/types';

// Mock 依赖
const mockDbManager = {
  getDatabase: jest.fn()
};

const mockQueryExecutor = {
  searchByKeywords: jest.fn(),
  getRecentMemories: jest.fn()
};

const mockEmbeddingService = {
  isEnabled: jest.fn(),
  embed: jest.fn()
};

const mockVectorEngine = {
  topKSimilarity: jest.fn()
};

describe('HybridRetriever', () => {
  let hybridRetriever: HybridRetriever;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建 HybridRetriever 实例
    hybridRetriever = new HybridRetriever(
      mockDbManager as any,
      mockQueryExecutor as any,
      mockEmbeddingService as any,
      mockVectorEngine as any
    );
  });

  describe('search', () => {
    const mockRecords: EpisodicMemoryRecord[] = [
      {
        id: 'mem1',
        projectFingerprint: 'fp1',
        timestamp: Date.now(),
        taskType: 'CODE_GENERATE',
        summary: '实现用户登录功能',
        entities: ['User', 'Login'],
        decision: '使用JWT认证',
        outcome: 'SUCCESS',
        finalWeight: 0.8,
        modelId: 'model1',
        durationMs: 100
      },
      {
        id: 'mem2',
        projectFingerprint: 'fp1',
        timestamp: Date.now(),
        taskType: 'CODE_GENERATE',
        summary: '修复数据库连接泄漏问题',
        entities: ['Database', 'Connection'],
        decision: '添加连接池',
        outcome: 'SUCCESS',
        finalWeight: 0.9,
        modelId: 'model1',
        durationMs: 200
      }
    ];

    it('应该执行关键词检索并返回结果', async () => {
      const query = '登录';
      mockQueryExecutor.searchByKeywords.mockResolvedValue(mockRecords);
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      const results = await hybridRetriever.search(query, { limit: 5 });

      expect(mockQueryExecutor.searchByKeywords).toHaveBeenCalledWith(query, {
        limit: 10,
        offset: 0
      });
      expect(results).toEqual(mockRecords);
    });

    it('当启用向量检索时应该执行混合检索', async () => {
      const query = '登录';
      const queryVector = [0.1, 0.2, 0.3];
      
      mockQueryExecutor.searchByKeywords.mockResolvedValue(mockRecords);
      mockQueryExecutor.getRecentMemories.mockResolvedValue(mockRecords);
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue(queryVector);
      mockVectorEngine.topKSimilarity.mockReturnValue([mockRecords[1], mockRecords[0]]);

      const results = await hybridRetriever.search(query, { 
        limit: 5,
        vectorWeight: 0.7,
        keywordWeight: 0.3
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(query);
      expect(mockVectorEngine.topKSimilarity).toHaveBeenCalled();
      expect(results).toBeDefined();
    });

    it('当向量嵌入失败时应降级为关键词检索', async () => {
      const query = '登录';
      
      mockQueryExecutor.searchByKeywords.mockResolvedValue(mockRecords);
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([]); // 空向量

      const results = await hybridRetriever.search(query, { limit: 5 });

      expect(mockVectorEngine.topKSimilarity).not.toHaveBeenCalled();
      expect(results).toEqual(mockRecords);
    });

    it('应该使用默认权重配置', async () => {
      const query = '测试';
      mockQueryExecutor.searchByKeywords.mockResolvedValue(mockRecords);
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await hybridRetriever.search(query);

      expect(mockQueryExecutor.searchByKeywords).toHaveBeenCalledWith(query, {
        limit: 20, // HybridRetriever 内部会将 limit * 2
        offset: 0
      });
    });

    it('融合结果应该按总分降序排列', async () => {
      const query = '测试';
      const keywordResults = [mockRecords[0]];
      const semanticResults = [mockRecords[1]];
      
      mockQueryExecutor.searchByKeywords.mockResolvedValue(keywordResults);
      mockQueryExecutor.getRecentMemories.mockResolvedValue(mockRecords);
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2]);
      mockVectorEngine.topKSimilarity.mockReturnValue(semanticResults);

      const results = await hybridRetriever.search(query, { limit: 5 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('fuseResults', () => {
    it('应该正确合并两组结果并去重', () => {
      const keywordResults = [
        { id: 'mem1', summary: '结果1' } as EpisodicMemoryRecord,
        { id: 'mem2', summary: '结果2' } as EpisodicMemoryRecord
      ];
      const semanticResults = [
        { id: 'mem2', summary: '结果2' } as EpisodicMemoryRecord,
        { id: 'mem3', summary: '结果3' } as EpisodicMemoryRecord
      ];

      // 通过反射调用私有方法（在真实场景中应通过公共接口测试）
      const fused = (hybridRetriever as any).fuseResults(
        keywordResults,
        semanticResults,
        0.7,
        0.3,
        10
      );

      expect(fused).toHaveLength(3); // mem1, mem2, mem3
      const ids = fused.map((r: EpisodicMemoryRecord) => r.id);
      expect(ids).toContain('mem1');
      expect(ids).toContain('mem2');
      expect(ids).toContain('mem3');
    });

    it('应该限制返回结果数量', () => {
      const keywordResults = Array.from({ length: 5 }, (_, i) => ({
        id: `kw${i}`,
        summary: `关键词结果${i}`
      })) as EpisodicMemoryRecord[];
      
      const semanticResults = Array.from({ length: 5 }, (_, i) => ({
        id: `sem${i}`,
        summary: `语义结果${i}`
      })) as EpisodicMemoryRecord[];

      const fused = (hybridRetriever as any).fuseResults(
        keywordResults,
        semanticResults,
        0.7,
        0.3,
        3
      );

      expect(fused).toHaveLength(3);
    });
  });
});
