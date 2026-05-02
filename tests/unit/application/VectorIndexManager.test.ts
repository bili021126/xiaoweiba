/**
 * VectorIndexManager 单元测试
 * 
 * 测试目标：提升 VectorIndexManager 覆盖率从 15.38% 到 90%+
 */

import { VectorIndexManager } from '../../../src/core/application/VectorIndexManager';
import { EmbeddingService } from '../../../src/core/application/EmbeddingService';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { EpisodicMemoryRecord } from '../../../src/core/memory/types';

describe('VectorIndexManager', () => {
  let vectorIndexManager: VectorIndexManager;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockDb: any;
  let mockStmt: any;

  beforeEach(() => {
    // Mock EmbeddingService
    mockEmbeddingService = {
      isEnabled: jest.fn(),
      embed: jest.fn()
    } as any;

    // Mock Database
    mockStmt = {
      bind: jest.fn(),
      step: jest.fn(),
      getAsObject: jest.fn(),
      free: jest.fn()
    };

    mockDb = {
      prepare: jest.fn().mockReturnValue(mockStmt),
      run: jest.fn()
    };

    // Mock DatabaseManager
    mockDbManager = {
      getDatabase: jest.fn().mockReturnValue(mockDb),
      run: jest.fn()
    } as any;

    // 创建 VectorIndexManager 实例
    vectorIndexManager = new VectorIndexManager(
      mockEmbeddingService,
      mockDbManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateIndexAsync', () => {
    it('应该在 embedding 服务禁用时直接返回', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '测试记忆'
      });

      expect(mockEmbeddingService.isEnabled).toHaveBeenCalled();
      expect(mockEmbeddingService.embed).not.toHaveBeenCalled();
      expect(mockDbManager.run).not.toHaveBeenCalled();
    });

    it('应该成功更新索引', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);

      const memory: Partial<EpisodicMemoryRecord> = {
        summary: '解释了 LoginView.vue 中的代码',
        decision: 'SUCCESS',
        entities: ['LoginView.vue', 'Vue']
      };

      await vectorIndexManager.updateIndexAsync('test-id', memory);

      // 验证构建了正确的索引文本
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
        '解释了 LoginView.vue 中的代码 SUCCESS LoginView.vue Vue'
      );

      // 验证向量被存入数据库
      expect(mockDbManager.run).toHaveBeenCalledWith(
        'UPDATE episodic_memory SET vector = ? WHERE id = ?',
        [expect.any(Buffer), 'test-id']
      );
    });

    it('应该处理空向量', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '测试'
      });

      // 空向量不应该更新数据库
      expect(mockDbManager.run).not.toHaveBeenCalled();
    });

    it('应该捕获并记录错误', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockRejectedValue(new Error('向量化失败'));

      // 不应该抛出异常
      await expect(vectorIndexManager.updateIndexAsync('test-id', {
        summary: '测试'
      })).resolves.toBeUndefined();

      // 错误应该被静默处理（console.error）
    });

    it('应该使用默认值构建索引文本', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.5]);

      await vectorIndexManager.updateIndexAsync('test-id', {});

      // 空字段应该被正确处理
      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('  ');
    });

    it('应该处理部分字段为空的记忆', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '只有摘要',
        decision: undefined,
        entities: []
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('只有摘要  ');
    });

    it('应该处理包含多个实体的记忆', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2, 0.3]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '代码优化',
        decision: 'PARTIAL',
        entities: ['TypeScript', 'async/await', 'Promise', 'error handling']
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
        '代码优化 PARTIAL TypeScript async/await Promise error handling'
      );
    });
  });

  describe('buildIndexText', () => {
    it('应该正确组合 summary、decision 和 entities', () => {
      const memory: Partial<EpisodicMemoryRecord> = {
        summary: '生成了提交信息',
        decision: 'SUCCESS',
        entities: ['git', 'commit']
      };

      // 通过 updateIndexAsync 间接测试 buildIndexText
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      vectorIndexManager.updateIndexAsync('test-id', memory);

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
        '生成了提交信息 SUCCESS git commit'
      );
    });

    it('应该处理空 entities 数组', () => {
      const memory: Partial<EpisodicMemoryRecord> = {
        summary: '测试',
        decision: 'FAILED',
        entities: []
      };

      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      vectorIndexManager.updateIndexAsync('test-id', memory);

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('测试 FAILED ');
    });

    it('应该处理所有字段都为空的情况', () => {
      const memory: Partial<EpisodicMemoryRecord> = {};

      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      vectorIndexManager.updateIndexAsync('test-id', memory);

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('  ');
    });
  });

  describe('getVector', () => {
    it('应该成功获取向量', async () => {
      const vectorArray = [0.1, 0.2, 0.3, 0.4];
      // 创建 Float32Array 并转换为 Uint8Array（模拟数据库存储）
      const float32Array = new Float32Array(vectorArray);
      const uint8Array = new Uint8Array(float32Array.buffer);

      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ vector: uint8Array });

      const result = await vectorIndexManager.getVector('test-id');

      expect(result).toHaveLength(vectorArray.length);
      expect(result[0]).toBeCloseTo(0.1, 5);
      expect(result[1]).toBeCloseTo(0.2, 5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT vector FROM episodic_memory WHERE id = ?'
      );
      expect(mockStmt.bind).toHaveBeenCalledWith(['test-id']);
      expect(mockStmt.free).toHaveBeenCalled();
    });

    it('应该在记录不存在时返回空数组', async () => {
      mockStmt.step.mockReturnValue(false);

      const result = await vectorIndexManager.getVector('non-existent-id');

      expect(result).toEqual([]);
      expect(mockStmt.free).toHaveBeenCalled();
    });

    it('应该在向量为 null 时返回空数组', async () => {
      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ vector: null });

      const result = await vectorIndexManager.getVector('test-id');

      expect(result).toEqual([]);
    });

    it('应该在向量为 undefined 时返回空数组', async () => {
      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({});

      const result = await vectorIndexManager.getVector('test-id');

      expect(result).toEqual([]);
    });

    it('应该正确转换 Float32Array 到普通数组', async () => {
      const originalVector = [1.5, 2.5, 3.5, -0.5, 0.0];
      const float32Array = new Float32Array(originalVector);
      const uint8Array = new Uint8Array(float32Array.buffer);

      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ vector: uint8Array });

      const result = await vectorIndexManager.getVector('test-id');

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(5);
      expect(result[0]).toBeCloseTo(1.5, 5);
      expect(result[3]).toBeCloseTo(-0.5, 5);
    });

    it('应该处理大型向量', async () => {
      // 模拟 768 维向量（常见的 embedding 维度）
      const largeVector = Array.from({ length: 768 }, (_, i) => Math.random());
      const float32Array = new Float32Array(largeVector);
      const uint8Array = new Uint8Array(float32Array.buffer);

      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ vector: uint8Array });

      const result = await vectorIndexManager.getVector('test-id');

      expect(result).toHaveLength(768);
      // 验证前几个元素
      expect(result[0]).toBeCloseTo(largeVector[0], 5);
      expect(result[767]).toBeCloseTo(largeVector[767], 5);
    });
  });

  describe('集成场景', () => {
    it('应该支持连续的索引更新操作', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1, 0.2]);

      // 连续更新多个记忆
      await vectorIndexManager.updateIndexAsync('id-1', { summary: '记忆1' });
      await vectorIndexManager.updateIndexAsync('id-2', { summary: '记忆2' });
      await vectorIndexManager.updateIndexAsync('id-3', { summary: '记忆3' });

      expect(mockEmbeddingService.embed).toHaveBeenCalledTimes(3);
      expect(mockDbManager.run).toHaveBeenCalledTimes(3);
    });

    it('应该在向量化失败时不影响其他操作', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      
      // 第一次成功
      mockEmbeddingService.embed.mockResolvedValueOnce([0.1]);
      // 第二次失败
      mockEmbeddingService.embed.mockRejectedValueOnce(new Error('失败'));
      // 第三次成功
      mockEmbeddingService.embed.mockResolvedValueOnce([0.2]);

      await vectorIndexManager.updateIndexAsync('id-1', { summary: '记忆1' });
      await vectorIndexManager.updateIndexAsync('id-2', { summary: '记忆2' });
      await vectorIndexManager.updateIndexAsync('id-3', { summary: '记忆3' });

      // 所有调用都应该完成（失败的被静默处理）
      expect(mockEmbeddingService.embed).toHaveBeenCalledTimes(3);
      // 只有成功的才会更新数据库
      expect(mockDbManager.run).toHaveBeenCalledTimes(2);
    });

    it('应该正确处理不同长度的向量', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      
      // 不同长度的向量
      mockEmbeddingService.embed
        .mockResolvedValueOnce([0.1])  // 1维
        .mockResolvedValueOnce([0.1, 0.2, 0.3])  // 3维
        .mockResolvedValueOnce(Array.from({ length: 100 }, () => 0.5));  // 100维

      await vectorIndexManager.updateIndexAsync('id-1', { summary: '短向量' });
      await vectorIndexManager.updateIndexAsync('id-2', { summary: '中向量' });
      await vectorIndexManager.updateIndexAsync('id-3', { summary: '长向量' });

      expect(mockDbManager.run).toHaveBeenCalledTimes(3);
    });
  });

  describe('边界情况', () => {
    it('应该处理特殊字符的 summary', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '解释了 <script>alert("xss")</script> 代码'
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalled();
    });

    it('应该处理超长文本', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      const longSummary = 'a'.repeat(10000);
      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: longSummary
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
        expect.stringContaining(longSummary)
      );
    });

    it('应该处理 Unicode 字符', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '解释了 🚀 火箭发射相关的代码 🎯'
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalled();
    });

    it('应该处理包含换行符的文本', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.embed.mockResolvedValue([0.1]);

      await vectorIndexManager.updateIndexAsync('test-id', {
        summary: '第一行\n第二行\n第三行'
      });

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith(
        expect.stringContaining('\n')
      );
    });
  });
});
