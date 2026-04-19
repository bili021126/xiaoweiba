/**
 * MemoryRecorder 单元测试
 */

import { MemoryRecorder, TaskCompletionData } from '../../../src/core/memory/MemoryRecorder';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { EventBus } from '../../../src/core/eventbus/EventBus';

// Mock EpisodicMemory
jest.mock('../../../src/core/memory/EpisodicMemory');

describe('MemoryRecorder', () => {
  let memoryRecorder: MemoryRecorder;
  let mockEpisodicMemory: jest.Mocked<EpisodicMemory>;
  let mockEventBus: EventBus;

  beforeEach(() => {
    mockEpisodicMemory = new EpisodicMemory(
      null as any,
      null as any,
      null as any,
      null as any
    ) as jest.Mocked<EpisodicMemory>;
    
    mockEventBus = new EventBus();
    memoryRecorder = new MemoryRecorder(mockEpisodicMemory, mockEventBus);

    // Mock record方法
    mockEpisodicMemory.record = jest.fn().mockResolvedValue('test-memory-id');
  });

  describe('recordTaskCompletion', () => {
    it('应该记录任务完成并保存记忆', async () => {
      const data: TaskCompletionData = {
        actionId: 'test-action',
        result: {
          success: true,
          data: { code: 'console.log("hello")' },
          modelId: 'deepseek'
        },
        durationMs: 1500,
        memoryMetadata: {
          taskType: 'CODE_GENERATE',
          summary: '生成Hello World代码',
          entities: ['console.log']
        }
      };

      await memoryRecorder.recordTaskCompletion(data);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith({
        taskType: 'CODE_GENERATE',
        summary: '生成Hello World代码',
        entities: ['console.log'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 1500
      });
    });

    it('应该处理失败的任务结果', async () => {
      const data: TaskCompletionData = {
        actionId: 'test-action',
        result: {
          success: false,
          error: '生成失败'
        },
        durationMs: 500,
        memoryMetadata: {
          taskType: 'CODE_EXPLAIN',
          summary: '解释函数',
          entities: []
        }
      };

      await memoryRecorder.recordTaskCompletion(data);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith({
        taskType: 'CODE_EXPLAIN',
        summary: '解释函数',
        entities: [],
        outcome: 'FAILED',
        modelId: 'deepseek',
        durationMs: 500
      });
    });

    it('应该在没有memoryMetadata时跳过记录', async () => {
      const data: TaskCompletionData = {
        actionId: 'test-action',
        result: { success: true },
        durationMs: 100
        // 没有memoryMetadata
      };

      await memoryRecorder.recordTaskCompletion(data);

      expect(mockEpisodicMemory.record).not.toHaveBeenCalled();
    });

    it('应该使用默认modelId当result.modelId不存在时', async () => {
      const data: TaskCompletionData = {
        actionId: 'test-action',
        result: { success: true },
        durationMs: 100,
        memoryMetadata: {
          taskType: 'CODE_EXPLAIN',
          summary: '测试',
          entities: []
        }
      };

      await memoryRecorder.recordTaskCompletion(data);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: 'deepseek'
        })
      );
    });

    it('应该提供durationMs默认值', async () => {
      const data: TaskCompletionData = {
        actionId: 'test-action',
        result: { success: true },
        // durationMs为undefined
        memoryMetadata: {
          taskType: 'CODE_EXPLAIN',
          summary: '测试',
          entities: []
        }
      };

      await memoryRecorder.recordTaskCompletion(data);

      expect(mockEpisodicMemory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: 0
        })
      );
    });
  });

  describe('extractEntities', () => {
    it('应该提取函数名', () => {
      const code = `function calculateSum(a, b) { return a + b; }`;

      const entities = memoryRecorder.extractEntities(code);
      expect(entities).toContain('calculateSum');
    });

    it('应该提取类名', () => {
      const code = `class UserService { constructor() {} }`;

      const entities = memoryRecorder.extractEntities(code);
      expect(entities).toContain('UserService');
    });

    it('应该提取多个实体', () => {
      const code = `function helper() {} class DataProcessor {} function main() {}`;

      const entities = memoryRecorder.extractEntities(code);
      expect(entities.length).toBeGreaterThanOrEqual(2);
    });

    it('空代码应返回空数组', () => {
      const entities = memoryRecorder.extractEntities('');
      expect(entities).toEqual([]);
    });

    it('无函数或类的代码应返回空数组', () => {
      const code = 'const x = 1 + 2;';
      const entities = memoryRecorder.extractEntities(code);
      expect(entities).toEqual([]);
    });
  });
});
