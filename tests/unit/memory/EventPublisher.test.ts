/**
 * EventPublisher 单元测试
 */

import { EventPublisher } from '../../../src/core/memory/EventPublisher';
import { EventBus, CoreEventType } from '../../../src/core/eventbus/EventBus';
import { CommandResult } from '../../../src/core/memory/BaseCommand';

describe('EventPublisher', () => {
  let eventPublisher: EventPublisher;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    eventPublisher = new EventPublisher(eventBus);
  });

  describe('publishTaskCompleted', () => {
    it('应该发布成功事件', () => {
      const mockHandler = jest.fn();
      eventBus.subscribe(CoreEventType.TASK_COMPLETED, mockHandler);

      const result: CommandResult = {
        success: true,
        data: { code: 'console.log("hello")' },
        durationMs: 1500,
        memoryMetadata: {
          taskType: 'CODE_GENERATE',
          summary: '生成代码',
          entities: ['console.log']
        }
      };

      eventPublisher.publishTaskCompleted('test-command', result, 1500);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CoreEventType.TASK_COMPLETED,
          payload: expect.objectContaining({
            actionId: 'test-command',
            result: {
              success: true,
              data: { code: 'console.log("hello")' }
            },
            durationMs: 1500,
            memoryMetadata: {
              taskType: 'CODE_GENERATE',
              summary: '生成代码',
              entities: ['console.log']
            }
          })
        })
      );
    });

    it('应该处理没有memoryMetadata的情况', () => {
      const mockHandler = jest.fn();
      eventBus.subscribe(CoreEventType.TASK_COMPLETED, mockHandler);

      const result: CommandResult = {
        success: true,
        data: {},
        durationMs: 100
      };

      eventPublisher.publishTaskCompleted('test-command', result, 100);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('publishTaskFailed', () => {
    it('应该发布失败事件', () => {
      const mockHandler = jest.fn();
      eventBus.subscribe(CoreEventType.TASK_COMPLETED, mockHandler);

      const error = new Error('执行失败');
      eventPublisher.publishTaskFailed('test-command', error, 500);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CoreEventType.TASK_COMPLETED,
          payload: expect.objectContaining({
            actionId: 'test-command',
            result: {
              success: false,
              error: '执行失败'
            },
            durationMs: 500
          })
        })
      );
    });

    it('应该处理字符串错误', () => {
      const mockHandler = jest.fn();
      eventBus.subscribe(CoreEventType.TASK_COMPLETED, mockHandler);

      eventPublisher.publishTaskFailed('test-command', '未知错误', 300);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            result: {
              success: false,
              error: '未知错误'
            }
          })
        })
      );
    });
  });
});
