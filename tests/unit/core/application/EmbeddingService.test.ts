import 'reflect-metadata';
import { EmbeddingService } from '../../../../src/core/application/EmbeddingService';
import { ConfigManager } from '../../../../src/storage/ConfigManager';

// Mock ConfigManager
jest.mock('../../../../src/storage/ConfigManager');

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({ memory: { enableVectorSearch: true } }),
      getApiKey: jest.fn()
    } as any;
    
    embeddingService = new EmbeddingService(mockConfigManager);
  });

  it('should generate a vector of correct dimension', async () => {
    const mockOutput = { data: new Float32Array(384).fill(0.1) };
    (embeddingService as any).extractor = jest.fn().mockResolvedValue(mockOutput);
    
    const text = 'Hello World';
    const vector = await embeddingService.embed(text);
    expect(vector).toHaveLength(384);
  });

  it('should return empty array when disabled', async () => {
    mockConfigManager.getConfig.mockReturnValue({
      memory: { enableVectorSearch: false }
    } as any);
    
    const service = new EmbeddingService(mockConfigManager);
    const vector = await service.embed('test');
    expect(vector).toEqual([]);
  });

  it('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(embeddingService.cosineSimilarity(a, b)).toBeCloseTo(1);

    const c = [1, 0, 0];
    const d = [0, 1, 0];
    expect(embeddingService.cosineSimilarity(c, d)).toBeCloseTo(0);
  });
});
