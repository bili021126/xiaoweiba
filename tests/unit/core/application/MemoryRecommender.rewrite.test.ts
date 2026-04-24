/**
 * MemoryRecommender 单元测试 - 重写以适配 IMemoryPort
 */

import 'reflect-metadata';
import { MemoryRecommender } from '../../../../src/core/application/MemoryRecommender';
import { IMemoryPort } from '../../../../src/core/ports/IMemoryPort';

const mockMemoryPort: Partial<IMemoryPort> = {
  search: jest.fn()
};

describe('MemoryRecommender (Rewritten)', () => {
  let recommender: MemoryRecommender;

  beforeEach(() => {
    jest.clearAllMocks();
    recommender = new MemoryRecommender(mockMemoryPort as IMemoryPort);
  });

  describe('recommendForFile', () => {
    it('should recommend memories for a file', async () => {
      const mockMemories = [
        { id: 'mem1', summary: 'Test memory 1', timestamp: 1000 },
        { id: 'mem2', summary: 'Test memory 2', timestamp: 2000 }
      ];
      (mockMemoryPort.search as jest.Mock).mockResolvedValue(mockMemories);

      const result = await recommender.recommendForFile('/path/to/file.ts');

      expect(mockMemoryPort.search).toHaveBeenCalledWith('file.ts', { limit: 5 });
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test memory 1');
      expect(result[0].memoryId).toBe('mem1');
    });

    it('should return empty array on error', async () => {
      (mockMemoryPort.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const result = await recommender.recommendForFile('/path/to/file.ts');

      expect(result).toEqual([]);
    });
  });
});
