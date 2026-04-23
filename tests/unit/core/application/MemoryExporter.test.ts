import 'reflect-metadata';
import { MemoryExporter } from '../../../../src/core/application/MemoryExporter';
import { EpisodicMemory } from '../../../../src/core/memory/EpisodicMemory';

const mockEpisodicMemory = {
  retrieve: jest.fn(),
  record: jest.fn()
} as any;

describe('MemoryExporter', () => {
  let exporter: MemoryExporter;

  beforeEach(() => {
    jest.clearAllMocks();
    exporter = new MemoryExporter(mockEpisodicMemory);
  });

  describe('retrieveAll', () => {
    it('should retrieve all memories with default limit', async () => {
      const mockMemories = [{ id: '1' }, { id: '2' }];
      mockEpisodicMemory.retrieve.mockResolvedValue(mockMemories);

      const result = await exporter.retrieveAll();

      expect(mockEpisodicMemory.retrieve).toHaveBeenCalledWith({ limit: 1000 });
      expect(result).toEqual(mockMemories);
    });

    it('should retrieve with custom limit', async () => {
      const mockMemories = [{ id: '1' }];
      mockEpisodicMemory.retrieve.mockResolvedValue(mockMemories);

      const result = await exporter.retrieveAll({ limit: 100 });

      expect(mockEpisodicMemory.retrieve).toHaveBeenCalledWith({ limit: 100 });
      expect(result).toEqual(mockMemories);
    });

    it('should return empty array on error', async () => {
      mockEpisodicMemory.retrieve.mockRejectedValue(new Error('Test error'));

      const result = await exporter.retrieveAll();

      expect(result).toEqual([]);
    });
  });

  describe('recordMemory', () => {
    it('should record memory successfully', async () => {
      const record = {
        taskType: 'TEST',
        summary: 'Test summary',
        entities: ['entity1'],
        outcome: 'SUCCESS'
      };
      mockEpisodicMemory.record.mockResolvedValue('memory_id_123');

      const result = await exporter.recordMemory(record);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith({
        taskType: 'TEST',
        summary: 'Test summary',
        entities: ['entity1'],
        outcome: 'SUCCESS',
        modelId: 'unknown',
        durationMs: 0,
        metadata: undefined
      });
      expect(result).toBe('memory_id_123');
    });

    it('should use provided modelId and durationMs', async () => {
      const record = {
        taskType: 'TEST',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'gpt-4',
        durationMs: 1500
      };
      mockEpisodicMemory.record.mockResolvedValue('mem_456');

      const result = await exporter.recordMemory(record);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith(expect.objectContaining({
        modelId: 'gpt-4',
        durationMs: 1500
      }));
      expect(result).toBe('mem_456');
    });

    it('should throw error on failure', async () => {
      const record = {
        taskType: 'TEST',
        summary: 'Test',
        entities: [],
        outcome: 'SUCCESS'
      };
      mockEpisodicMemory.record.mockRejectedValue(new Error('Record failed'));

      await expect(exporter.recordMemory(record)).rejects.toThrow('Record failed');
    });
  });
});
