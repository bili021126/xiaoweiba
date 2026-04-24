/**
 * SpecializedRetriever 单元测试 - 使用全局 Mock 配置
 */

import 'reflect-metadata';
import { SpecializedRetriever } from '../../../../src/core/application/SpecializedRetriever';
import { createMockMemoryPort } from '../../../__mocks__/globalMocks';

describe('SpecializedRetriever (Global Mock)', () => {
  let retriever: SpecializedRetriever;
  let mockMemoryPort: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemoryPort = createMockMemoryPort();
    retriever = new SpecializedRetriever(mockMemoryPort);
  });

  describe('retrieveForExplainCode', () => {
    it('should return empty array without codeContext', async () => {
      const intent = { name: 'explain_code' as any, metadata: {} } as any;
      const result = await retriever.retrieveForExplainCode(intent);
      expect(result).toEqual([]);
    });

    it('should retrieve memories for explain code', async () => {
      const mockMemories = [{ id: 'mem1', summary: 'Test' }];
      mockMemoryPort.search.mockResolvedValue(mockMemories);
      
      const intent = { name: 'explain_code' as any, codeContext: 'const x = 1;', metadata: {} } as any;
      const result = await retriever.retrieveForExplainCode(intent);
      
      expect(result).toHaveLength(1);
    });

    it('should handle retrieval errors gracefully', async () => {
      mockMemoryPort.search.mockRejectedValue(new Error('Search failed'));
      
      const intent = { name: 'explain_code' as any, codeContext: 'const x = 1;', metadata: {} } as any;
      const result = await retriever.retrieveForExplainCode(intent);
      
      expect(result).toEqual([]);
    });
  });

  describe('retrieveForCommit', () => {
    it('should retrieve commit-related memories', async () => {
      const mockMemories = [{ id: 'mem1', summary: 'Previous commit' }];
      mockMemoryPort.retrieveAll.mockResolvedValue(mockMemories);
      
      const intent = { name: 'generate_commit' as any, metadata: {} } as any;
      const result = await retriever.retrieveForCommit(intent);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('retrieveForChat', () => {
    it('should retrieve chat-related memories', async () => {
      const mockMemories = [{ id: 'mem1', summary: 'Chat history' }];
      mockMemoryPort.search.mockResolvedValue(mockMemories);
      
      const intent = { name: 'chat' as any, userInput: 'Hello', metadata: {} } as any;
      const result = await retriever.retrieveForChat(intent);
      
      expect(result).toHaveLength(1);
    });
  });
});
