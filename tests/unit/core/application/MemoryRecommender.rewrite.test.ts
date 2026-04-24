/**
 * MemoryRecommender 单元测试 - 使用全局 Mock 配置
 */

import 'reflect-metadata';
import { MemoryRecommender } from '../../../../src/core/application/MemoryRecommender';
import { createMockMemoryPort } from '../../../__mocks__/globalMocks';

const mockMemoryPort = createMockMemoryPort();

describe('MemoryRecommender (Global Mock)', () => {
  let recommender: MemoryRecommender;

  beforeEach(() => {
    jest.clearAllMocks();
    recommender = new MemoryRecommender(mockMemoryPort);
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
