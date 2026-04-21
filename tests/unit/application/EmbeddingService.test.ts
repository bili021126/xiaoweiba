/**
 * EmbeddingService 单元测试
 */

import 'reflect-metadata';
import { EmbeddingService } from '../../../src/core/application/EmbeddingService';
import { ConfigManager } from '../../../src/storage/ConfigManager';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue({
    data: new Float32Array(384).fill(0.1) // 模拟模型输出
  }),
  env: {
    allowLocalModels: false,
    useBrowserCache: false
  }
}));

// 确保 Mock 在模块加载前生效
const mockPipeline = require('@xenova/transformers').pipeline;

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockConfigManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        memory: {
          enableVectorSearch: true,
          embeddingProvider: 'local'
        }
      })
    };
    embeddingService = new EmbeddingService(mockConfigManager);
  });

  it('应该在启用时返回向量数组', async () => {
    // 模拟模型已加载的状态
    const mockOutput = { data: new Float32Array(384).fill(0.1) };
    (embeddingService as any).extractor = jest.fn().mockResolvedValue(mockOutput);
    
    const vector = await embeddingService.embed('test text');
    expect(vector).toBeDefined();
    expect(vector.length).toBe(384);
    expect(typeof vector[0]).toBe('number');
  });

  it('应该在禁用时返回空数组', async () => {
    mockConfigManager.getConfig.mockReturnValue({
      memory: { enableVectorSearch: false }
    });
    const service = new EmbeddingService(mockConfigManager);
    const vector = await service.embed('test');
    expect(vector).toEqual([]);
  });

  it('应该能正确计算余弦相似度', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(embeddingService.cosineSimilarity(a, b)).toBeCloseTo(1.0);

    const c = [0, 1, 0];
    expect(embeddingService.cosineSimilarity(a, c)).toBeCloseTo(0.0);
  });

  it('应该处理空向量的相似度计算', () => {
    expect(embeddingService.cosineSimilarity([], [])).toBe(0);
    expect(embeddingService.cosineSimilarity([1], [])).toBe(0);
  });

  it('应该暴露启用状态', () => {
    expect(embeddingService.isEnabled()).toBe(true);
  });
});
