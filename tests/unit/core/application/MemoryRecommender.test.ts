import 'reflect-metadata';
import { MemoryRecommender } from '../../../../src/core/application/MemoryRecommender';
import { EpisodicMemory } from '../../../../src/core/memory/EpisodicMemory';

const mockEpisodicMemory = {
  search: jest.fn()
} as any;

describe('MemoryRecommender', () => {
  let recommender: MemoryRecommender;

  beforeEach(() => {
    jest.clearAllMocks();
    recommender = new MemoryRecommender(mockEpisodicMemory);
  });

  describe('recommendForFile', () => {
    it('should recommend memories for a file', async () => {
      const mockMemories = [
        { id: 'mem1', summary: 'Test memory 1', timestamp: 1000 },
        { id: 'mem2', summary: 'Test memory 2', timestamp: 2000 }
      ];
      mockEpisodicMemory.search.mockResolvedValue(mockMemories);

      const result = await recommender.recommendForFile('/path/to/file.ts');

      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('file.ts', { limit: 5 });
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test memory 1');
      expect(result[0].memoryId).toBe('mem1');
      expect(result[1].title).toBe('Test memory 2');
    });

    it('should use default title if summary is missing', async () => {
      const mockMemories = [
        { id: 'mem1', timestamp: 1000 }
      ];
      mockEpisodicMemory.search.mockResolvedValue(mockMemories);

      const result = await recommender.recommendForFile('/path/to/test.ts');

      expect(result[0].title).toContain('test.ts');
    });

    it('should return empty array on error', async () => {
      mockEpisodicMemory.search.mockRejectedValue(new Error('Search failed'));

      const result = await recommender.recommendForFile('/path/to/file.ts');

      expect(result).toEqual([]);
    });

    it('should limit results to 5', async () => {
      const mockMemories = Array.from({ length: 10 }, (_, i) => ({
        id: `mem${i}`,
        summary: `Memory ${i}`,
        timestamp: i * 1000
      }));
      mockEpisodicMemory.search.mockResolvedValue(mockMemories);

      await recommender.recommendForFile('/path/to/file.ts');

      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('file.ts', { limit: 5 });
    });
  });
});
