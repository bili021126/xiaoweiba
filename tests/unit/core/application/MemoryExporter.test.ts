import 'reflect-metadata';
import { MemoryExporter } from '../../../../src/core/application/MemoryExporter';
import { createMockMemoryPort } from '../../../__mocks__/globalMocks';

const mockMemoryPort = createMockMemoryPort();

describe('MemoryExporter', () => {
  let exporter: MemoryExporter;
  let mockMemoryPort: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemoryPort = createMockMemoryPort();
    exporter = new MemoryExporter(mockMemoryPort);
  });

  describe('retrieveAll', () => {
    it('should retrieve all memories with default limit', async () => {
      const mockMemories = [{ id: '1' }, { id: '2' }];
      mockMemoryPort.retrieveAll.mockResolvedValue(mockMemories);

      const result = await exporter.retrieveAll();

      expect(mockMemoryPort.retrieveAll).toHaveBeenCalledWith({ limit: 1000 });
      expect(result).toEqual(mockMemories);
    });

    it('should retrieve with custom limit', async () => {
      const mockMemories = [{ id: '1' }];
      mockMemoryPort.retrieveAll.mockResolvedValue(mockMemories);

      const result = await exporter.retrieveAll({ limit: 100 });

      expect(mockMemoryPort.retrieveAll).toHaveBeenCalledWith({ limit: 100 });
      expect(result).toEqual(mockMemories);
    });

    it('should return empty array on error', async () => {
      mockMemoryPort.retrieveAll.mockRejectedValue(new Error('Test error'));

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
      mockMemoryPort.recordMemory.mockResolvedValue('memory_id_123');

      const result = await exporter.recordMemory(record);

      expect(mockMemoryPort.recordMemory).toHaveBeenCalledWith(record);
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
      mockMemoryPort.recordMemory.mockResolvedValue('mem_456');

      const result = await exporter.recordMemory(record);

      expect(mockMemoryPort.recordMemory).toHaveBeenCalledWith(expect.objectContaining({
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
      mockMemoryPort.recordMemory.mockRejectedValue(new Error('Record failed'));

      await expect(exporter.recordMemory(record)).rejects.toThrow('Record failed');
    });
  });
});
