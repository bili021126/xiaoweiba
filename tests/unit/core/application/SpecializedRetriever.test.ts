import 'reflect-metadata';
import { SpecializedRetriever } from '../../../../src/core/application/SpecializedRetriever';
import { EpisodicMemory } from '../../../../src/core/memory/EpisodicMemory';

const mockEpisodicMemory = {
  search: jest.fn(),
  retrieve: jest.fn()
} as any;

describe('SpecializedRetriever', () => {
  let retriever: SpecializedRetriever;

  beforeEach(() => {
    jest.clearAllMocks();
    retriever = new SpecializedRetriever(mockEpisodicMemory);
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
      mockEpisodicMemory.search.mockResolvedValue([{ id: 'mem1' }]);

      const result = await retriever.retrieveForExplainCode(intent as any);

      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('file.ts', {
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
      mockEpisodicMemory.search
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
      mockEpisodicMemory.search.mockRejectedValue(new Error('Search failed'));

      const result = await retriever.retrieveForExplainCode(intent as any);
      expect(result).toEqual([]);
    });
  });

  describe('retrieveForCommit', () => {
    it('should retrieve recent commits', async () => {
      const intent = { name: 'generate_commit' as any };
      mockEpisodicMemory.retrieve.mockResolvedValue([{ id: 'commit1' }, { id: 'commit2' }]);

      const result = await retriever.retrieveForCommit(intent as any);

      expect(mockEpisodicMemory.retrieve).toHaveBeenCalledWith({
        taskType: 'COMMIT_GENERATE',
        limit: 5
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      mockEpisodicMemory.retrieve.mockRejectedValue(new Error('Retrieve failed'));

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
      mockEpisodicMemory.search.mockResolvedValue([{ id: 'mem1' }]);

      const result = await retriever.retrieveForChat(intent as any);

      expect(mockEpisodicMemory.search).toHaveBeenCalledWith('how to test', { limit: 5 });
      expect(result).toHaveLength(1);
    });

    it('should merge file results and deduplicate', async () => {
      const intent = {
        name: 'chat' as any,
        userInput: 'test',
        codeContext: { filePath: '/file.ts' }
      };
      mockEpisodicMemory.search
        .mockResolvedValueOnce([{ id: 'semantic1' }])
        .mockResolvedValueOnce([{ id: 'file1' }, { id: 'semantic1' }]);

      const result = await retriever.retrieveForChat(intent as any);

      expect(result).toHaveLength(2); // semantic1 should be deduplicated
    });

    it('should return empty array on error', async () => {
      mockEpisodicMemory.search.mockRejectedValue(new Error('Search failed'));

      const result = await retriever.retrieveForChat({ userInput: 'test' } as any);
      expect(result).toEqual([]);
    });
  });
});
