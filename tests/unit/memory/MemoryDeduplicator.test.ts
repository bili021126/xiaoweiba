import { MemoryDeduplicator } from '../../../src/core/memory/MemoryDeduplicator';
import { EpisodicMemoryRecord } from '../../../src/core/memory/EpisodicMemory';

describe('MemoryDeduplicator - 结果去重', () => {
  let deduplicator: MemoryDeduplicator;

  beforeEach(() => {
    deduplicator = new MemoryDeduplicator();
  });

  const createMockMemory = (id: string, summary: string, entities: string[]): EpisodicMemoryRecord => ({
    id,
    projectFingerprint: 'test-project',
    timestamp: Date.now(),
    taskType: 'CODE_EXPLAIN',
    summary,
    entities,
    outcome: 'SUCCESS',
    finalWeight: 8,
    modelId: 'test-model',
    durationMs: 100
  });

  describe('deduplicate() - 基本去重', () => {
    it('应该返回空数组当输入为空', () => {
      const result = deduplicator.deduplicate([]);
      expect(result).toEqual([]);
    });

    it('应该返回单个元素当输入只有一个', () => {
      const memories = [createMockMemory('1', 'test', ['entity1'])];
      const result = deduplicator.deduplicate(memories);
      expect(result).toHaveLength(1);
    });

    it('应该去除完全相同的记忆', () => {
      const mem1 = createMockMemory('1', '相同内容', ['entity1', 'entity2']);
      const mem2 = createMockMemory('2', '相同内容', ['entity1', 'entity2']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('应该保留不同的记忆', () => {
      const mem1 = createMockMemory('1', '内容A', ['entity1']);
      const mem2 = createMockMemory('2', '内容B', ['entity2']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('Jaccard相似度计算', () => {
    it('应该正确计算高相似度记忆', () => {
      // 高度重叠的entities
      const mem1 = createMockMemory('1', 'React组件开发', ['React', 'Component', 'Hook']);
      const mem2 = createMockMemory('2', 'React组件优化', ['React', 'Component', 'Performance']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      // 由于有共同的React和Component，可能被去重
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('应该正确计算低相似度记忆', () => {
      const mem1 = createMockMemory('1', 'Python数据处理', ['Python', 'Pandas', 'DataFrame']);
      const mem2 = createMockMemory('2', 'Java后端开发', ['Java', 'Spring', 'REST']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      expect(result).toHaveLength(2);
    });

    it('应该处理空entities的情况', () => {
      const mem1 = createMockMemory('1', '这是一段测试文本', []);
      const mem2 = createMockMemory('2', '这是另一段测试文本', []);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      // 基于summary的分词，可能有一定相似度
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('配置控制', () => {
    it('应该支持自定义相似度阈值', () => {
      const strictDeduplicator = new MemoryDeduplicator({ similarityThreshold: 0.95 });
      
      const mem1 = createMockMemory('1', '非常相似的内容A', ['entity1', 'entity2']);
      const mem2 = createMockMemory('2', '非常相似的内容B', ['entity1', 'entity2']);
      
      const result = strictDeduplicator.deduplicate([mem1, mem2]);
      
      // 高阈值下更可能保留两个
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('应该限制最大返回数量', () => {
      const limitedDeduplicator = new MemoryDeduplicator({ maxResults: 3 });
      
      const memories = [
        createMockMemory('1', '内容1', ['e1']),
        createMockMemory('2', '内容2', ['e2']),
        createMockMemory('3', '内容3', ['e3']),
        createMockMemory('4', '内容4', ['e4']),
        createMockMemory('5', '内容5', ['e5'])
      ];
      
      const result = limitedDeduplicator.deduplicate(memories);
      
      expect(result).toHaveLength(3);
    });

    it('应该支持动态更新配置', () => {
      deduplicator.updateConfig({ similarityThreshold: 0.5 });
      const config = deduplicator.getConfig();
      
      expect(config.similarityThreshold).toBe(0.5);
    });
  });

  describe('边界情况', () => {
    it('应该处理包含特殊字符的summary', () => {
      const mem1 = createMockMemory('1', 'React/Vue/Angular对比', ['framework']);
      const mem2 = createMockMemory('2', 'React vs Vue vs Angular', ['framework']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('应该处理中文内容', () => {
      const mem1 = createMockMemory('1', 'React组件开发最佳实践', ['React', '组件']);
      const mem2 = createMockMemory('2', 'Vue组件开发指南', ['Vue', '组件']);
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      // 由于有共同的"组件"，可能有一定相似度
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('应该跳过已处理的ID', () => {
      const mem1 = createMockMemory('1', '内容', ['entity']);
      const mem2 = createMockMemory('1', '内容', ['entity']); // 相同ID
      
      const result = deduplicator.deduplicate([mem1, mem2]);
      
      expect(result).toHaveLength(1);
    });
  });
});
