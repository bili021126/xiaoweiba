import 'reflect-metadata';
import { SpecializedRetriever } from '../../../../src/core/application/SpecializedRetriever';
import { IMemoryPort } from '../../../../src/core/ports/IMemoryPort';

const mockMemoryPort: Partial<IMemoryPort> = {
  search: jest.fn(),
  retrieveAll: jest.fn()
};

describe('SpecializedRetriever', () => {
  let retriever: SpecializedRetriever;

  beforeEach(() => {
    jest.clearAllMocks();
    retriever = new SpecializedRetriever(mockMemoryPort as IMemoryPort);
  });

  describe('retrieveForExplainCode', () => {
    it('should return empty array without codeContext', async () => {
      const intent = { name: 'explain_code' as any };
      const result = await retriever.retrieveForExplainCode(intent as any);
      expect(result).toEqual([]);
    });

    it('should search for file memories', async () => {
      const intent = {
        name: 'explain_code' as any,
        codeContext: { filePath: '/path/to/file.ts' }
      };
      (mockMemoryPort.search as jest.Mock).mockResolvedValue([{ id: 'mem1' }]);

      const result = await retriever.retrieveForExplainCode(intent as any);

      expect(mockMemoryPort.search).toHaveBeenCalledWith('file.ts', {
        taskType: 'CODE_EXPLAIN',
        limit: 3
      });
      expect(result).toHaveLength(1);
    });

    it('should also search for concept memories with userInput', async () => {
      const intent = {
        name: 'explain_code' as any,
        codeContext: { filePath: '/file.ts' },
        userInput: 'test function'
      };
      (mockMemoryPort.search as jest.Mock)
        .mockResolvedValueOnce([{ id: 'file_mem' }])
        .mockResolvedValueOnce([{ id: 'concept_mem' }]);

      const result = await retriever.retrieveForExplainCode(intent as any);

      expect(result).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      const intent = {
        name: 'explain_code' as any,
        codeContext: { filePath: '/file.ts' }
      };
      (mockMemoryPort.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const result = await retriever.retrieveForExplainCode(intent as any);
      expect(result).toEqual([]);
    });
  });

  describe('retrieveForCommit', () => {
    it('should retrieve recent commits', async () => {
      const intent = { name: 'generate_commit' as any };
      (mockMemoryPort.retrieveAll as jest.Mock).mockResolvedValue([{ id: 'commit1' }, { id: 'commit2' }]);

      const result = await retriever.retrieveForCommit(intent as any);

      expect(mockMemoryPort.retrieveAll).toHaveBeenCalledWith({ limit: 5 });

      expect(result).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      (mockMemoryPort.retrieveAll as jest.Mock).mockRejectedValue(new Error('Retrieve failed'));

      const result = await retriever.retrieveForCommit({} as any);
      expect(result).toEqual([]);
    });
  });

  describe('retrieveForChat', () => {
    it('should return empty array without userInput', async () => {
      const intent = { name: 'chat' as any };
      const result = await retriever.retrieveForChat(intent as any);
      expect(result).toEqual([]);
    });

    it('should search semantically', async () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'how to test'
      };
      (mockMemoryPort.search as jest.Mock).mockResolvedValue([{ id: 'mem1' }]);

      const result = await retriever.retrieveForChat(intent as any);

      expect(mockMemoryPort.search).toHaveBeenCalledWith('how to test', { limit: 5 });
      expect(result).toHaveLength(1);
    });

    it('should merge file results and deduplicate', async () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'test',
        codeContext: { filePath: '/file.ts' }
      };
      (mockMemoryPort.search as jest.Mock)
        .mockResolvedValueOnce([{ id: 'semantic1' }])
        .mockResolvedValueOnce([{ id: 'file1' }, { id: 'semantic1' }]);

      const result = await retriever.retrieveForChat(intent as any);

      expect(result).toHaveLength(2); // semantic1 should be deduplicated
    });

    it('should return empty array on error', async () => {
      (mockMemoryPort.search as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const result = await retriever.retrieveForChat({ userInput: 'test' } as any);
      expect(result).toEqual([]);
    });
  });
});
