import 'reflect-metadata';
import { BaseCommand, CommandInput, CommandResult } from '../../../src/core/memory/BaseCommand';
import { MemoryContext } from '../../../src/core/memory/MemorySystem';
import { createMockMemorySystem, createMockEventBus } from '../../helpers/mockFactory';

// 创建测试命令类
class TestCommand extends BaseCommand {
  protected async executeCore(input: CommandInput, context: MemoryContext): Promise<CommandResult> {
    return { 
      success: true, 
      data: { 
        input, 
        memoryCount: context.episodicMemories?.length || 0,
        preferenceCount: context.preferenceRecommendations?.length || 0
      } 
    };
  }
}

describe('BaseCommand - 命令基类', () => {
  let mockMemorySystem: any;
  let mockEventBus: any;
  let command: TestCommand;

  beforeEach(() => {
    mockMemorySystem = createMockMemorySystem();
    mockEventBus = createMockEventBus();
    command = new TestCommand(mockMemorySystem, mockEventBus, 'test');
  });

  describe('execute - 统一执行入口', () => {
    it('应该在执行前调用 retrieveMemoryContext', async () => {
      await command.execute({ test: 'data' });
      
      expect(mockMemorySystem.retrieveRelevant).toHaveBeenCalledWith('test', { test: 'data' });
    });

    it('应该在执行后发布 TASK_COMPLETED 事件', async () => {
      await command.execute({});
      
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'task.completed',
        expect.objectContaining({ actionId: 'test' }),
        expect.anything()
      );
    });

    it('应该将 memoryContext 传递给 executeCore', async () => {
      const mockContext = { 
        episodicMemories: [{ id: '1', summary: 'test', taskType: 'TEST', timestamp: Date.now() }],
        preferenceRecommendations: []
      };
      mockMemorySystem.retrieveRelevant.mockResolvedValue(mockContext);
      
      const result = await command.execute({});
      
      expect(result.success).toBe(true);
      expect(result.data.memoryCount).toBe(1);
      expect(result.data.preferenceCount).toBe(0);
    });

    it('应该处理空记忆上下文', async () => {
      mockMemorySystem.retrieveRelevant.mockResolvedValue({
        episodicMemories: [],
        preferenceRecommendations: []
      });

      const result = await command.execute({});
      
      expect(result.data.memoryCount).toBe(0);
      expect(result.data.preferenceCount).toBe(0);
    });

    it('应该在 executeCore 抛出异常时捕获并返回错误', async () => {
      class ErrorCommand extends BaseCommand {
        protected async executeCore(): Promise<CommandResult> {
          throw new Error('测试错误');
        }
      }

      const errorCommand = new ErrorCommand(mockMemorySystem, mockEventBus, 'errorTest');
      
      const result = await errorCommand.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('测试错误');
    });

    it('应该记录执行耗时', async () => {
      const result = await command.execute({});
      
      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs!).toBeGreaterThanOrEqual(0);
    });
  });
});
