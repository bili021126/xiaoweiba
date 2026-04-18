import 'reflect-metadata';
import { BaseCommand } from '../../../src/core/memory/BaseCommand';
import { MemoryContext, MemorySystem } from '../../../src/core/memory/MemorySystem';
import { EventBus } from '../../../src/core/eventbus/EventBus';
import { createMockMemorySystem, createMockEventBus } from '../../helpers/mockFactory';

// 创建一个具体的测试命令类
class TestCommand extends BaseCommand {
  protected async executeCore(input: any, context: MemoryContext): Promise<any> {
    return {
      input,
      memoryCount: context.episodicMemories ? context.episodicMemories.length : 0,
      preferenceCount: context.preferenceRecommendations ? context.preferenceRecommendations.length : 0
    };
  }
}

describe.skip('BaseCommand - 命令基类（待适配新架构）', () => {
  let command: TestCommand;
  let mockMemorySystem: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockMemorySystem = createMockMemorySystem();
    mockEventBus = createMockEventBus();
    command = new TestCommand(mockMemorySystem, mockEventBus);
  });

  describe('execute - 统一执行入口', () => {
    it('应该正确调用executeCore并返回结果', async () => {
      const mockContext: MemoryContext = {
        episodicMemories: [
          { id: 'ep_1', taskType: 'TEST', summary: '测试记忆', timestamp: Date.now() }
        ],
        preferenceRecommendations: [
          { domain: 'TEST', pattern: { style: 'test' }, confidence: 0.8 }
        ]
      };

      const result = await command.execute({ test: 'data' }, mockContext);

      expect(result).toEqual({
        input: { test: 'data' },
        memoryCount: 1,
        preferenceCount: 1
      });
    });

    it('应该处理空记忆上下文', async () => {
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      const result = await command.execute({}, mockContext);

      expect(result.memoryCount).toBe(0);
      expect(result.preferenceCount).toBe(0);
    });

    it('应该处理undefined记忆数组', async () => {
      const mockContext: MemoryContext = {
        episodicMemories: undefined,
        preferenceRecommendations: undefined
      };

      const result = await command.execute({}, mockContext);

      // TestCommand中使用 || 0 处理undefined
      expect(result.memoryCount).toBe(0);
      expect(result.preferenceCount).toBe(0);
    });

    it('应该在executeCore抛出异常时传播错误', async () => {
      class ErrorCommand extends BaseCommand {
        protected async executeCore(): Promise<any> {
          throw new Error('测试错误');
        }
      }

      const errorCommand = new ErrorCommand();
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      await expect(errorCommand.execute({}, mockContext)).rejects.toThrow('测试错误');
    });

    it('应该记录执行日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockContext: MemoryContext = {
        episodicMemories: [
          { id: 'ep_1', taskType: 'TEST', summary: '测试', timestamp: Date.now() }
        ],
        preferenceRecommendations: []
      };

      await command.execute({}, mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[BaseCommand] Executing TestCommand with 1 memories'
      );

      consoleSpy.mockRestore();
    });

    it('应该在执行失败时记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      class ErrorCommand extends BaseCommand {
        protected async executeCore(): Promise<any> {
          throw new Error('执行失败');
        }
      }

      const errorCommand = new ErrorCommand();
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      await expect(errorCommand.execute({}, mockContext)).rejects.toThrow('执行失败');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BaseCommand] Execution failed:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('应该支持复杂的输入参数', async () => {
      const complexInput = {
        code: 'const x = 1;',
        language: 'typescript',
        options: { includeComments: true }
      };

      const mockContext: MemoryContext = {
        episodicMemories: [
          { id: 'ep_1', taskType: 'CODE_EXPLAIN', summary: '代码解释', timestamp: Date.now() },
          { id: 'ep_2', taskType: 'CODE_EXPLAIN', summary: '之前的解释', timestamp: Date.now() - 1000 }
        ],
        preferenceRecommendations: [
          { domain: 'CODE_PATTERN', pattern: { style: 'functional' }, confidence: 0.9 }
        ]
      };

      const result = await command.execute(complexInput, mockContext);

      expect(result.input).toEqual(complexInput);
      expect(result.memoryCount).toBe(2);
      expect(result.preferenceCount).toBe(1);
    });

    it('应该正确处理大量记忆', async () => {
      const manyMemories = Array.from({ length: 50 }, (_, i) => ({
        id: `ep_${i}`,
        taskType: 'TEST',
        summary: `记忆 ${i}`,
        timestamp: Date.now() - i * 1000
      }));

      const mockContext: MemoryContext = {
        episodicMemories: manyMemories,
        preferenceRecommendations: []
      };

      const result = await command.execute({}, mockContext);

      expect(result.memoryCount).toBe(50);
    });
  });

  describe('executeCore - 抽象方法', () => {
    it('子类必须实现executeCore方法', () => {
      // TypeScript编译时会强制要求实现，这里验证实例可以创建
      expect(command).toBeInstanceOf(BaseCommand);
    });

    it('executeCore可以访问受保护成员', async () => {
      class AccessTestCommand extends BaseCommand {
        public testProtectedAccess(context: MemoryContext) {
          // 验证可以访问context参数
          return context.episodicMemories?.length || 0;
        }

        protected async executeCore(input: any, context: MemoryContext): Promise<any> {
          return this.testProtectedAccess(context);
        }
      }

      const accessCommand = new AccessTestCommand();
      const mockContext: MemoryContext = {
        episodicMemories: [
          { id: 'ep_1', taskType: 'TEST', summary: '测试', timestamp: Date.now() }
        ],
        preferenceRecommendations: []
      };

      const result = await accessCommand.execute({}, mockContext);
      expect(result).toBe(1);
    });
  });

  describe('继承与多态', () => {
    it('多个命令可以独立工作', async () => {
      class CommandA extends BaseCommand {
        protected async executeCore(input: any): Promise<any> {
          return { command: 'A', input };
        }
      }

      class CommandB extends BaseCommand {
        protected async executeCore(input: any): Promise<any> {
          return { command: 'B', input };
        }
      }

      const cmdA = new CommandA();
      const cmdB = new CommandB();

      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      const resultA = await cmdA.execute({ data: 'testA' }, mockContext);
      const resultB = await cmdB.execute({ data: 'testB' }, mockContext);

      expect(resultA).toEqual({ command: 'A', input: { data: 'testA' } });
      expect(resultB).toEqual({ command: 'B', input: { data: 'testB' } });
    });

    it('命令可以有自定义初始化逻辑', async () => {
      class CustomInitCommand extends BaseCommand {
        private config: any;

        constructor(private initValue: string) {
          super();
          this.config = { value: initValue };
        }

        protected async executeCore(input: any): Promise<any> {
          return { config: this.config, input };
        }
      }

      const customCmd = new CustomInitCommand('test-config');
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      const result = await customCmd.execute({ action: 'test' }, mockContext);

      expect(result.config).toEqual({ value: 'test-config' });
      expect(result.input).toEqual({ action: 'test' });
    });
  });
});
