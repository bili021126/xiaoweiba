import 'reflect-metadata';
import { container } from 'tsyringe';
import * as vscode from 'vscode';
import { ExplainCodeCommand } from '../../../src/commands/ExplainCodeCommand';
import { LLMTool } from '../../../src/tools/LLMTool';
import { PreferenceMemory } from '../../../src/core/memory/PreferenceMemory';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { MemoryContext } from '../../../src/core/memory/MemorySystem';

// Mock LLMResponseCache
jest.mock('../../../src/core/cache/LLMResponseCache', () => {
  return {
    LLMResponseCache: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      clear: jest.fn(),
      clearExpired: jest.fn(),
      getStats: jest.fn().mockReturnValue({ size: 0, keys: [] })
    }))
  };
});

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null,
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
    createWebviewPanel: jest.fn(() => ({
      webview: { html: '', onDidReceiveMessage: jest.fn() },
      dispose: jest.fn()
    }))
  },
  ProgressLocation: { Notification: 15 }
}));

describe('ExplainCodeCommand (BaseCommand架构)', () => {
  let command: ExplainCodeCommand;
  let mockLLMTool: jest.Mocked<LLMTool>;
  let mockPreferenceMemory: jest.Mocked<PreferenceMemory>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    // 创建 Mock 对象
    mockLLMTool = {
      call: jest.fn(),
      callStream: jest.fn()
    } as any;

    mockPreferenceMemory = {
      getRecommendations: jest.fn().mockResolvedValue([])
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;

    // 注册 Mock 到容器
    container.registerInstance(LLMTool, mockLLMTool);
    container.registerInstance(PreferenceMemory, mockPreferenceMemory);
    container.registerInstance(AuditLogger, mockAuditLogger);

    // 创建命令实例
    command = new ExplainCodeCommand(mockLLMTool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeCore - 记忆注入测试', () => {
    it.skip('应该在没有记忆的情况下正常执行', async () => {
      // TODO: 需要完整 Mock Webview 和 Progress API
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: []
      };

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '这是代码解释',
        durationMs: 500
      });

      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('const x = 1;'), languageId: 'typescript' },
        selection: { isEmpty: false }
      };

      const result = await (command as any).executeCore({}, mockContext);

      expect(result.success).toBe(true);
      expect(mockLLMTool.call).toHaveBeenCalled();
    });

    it('应该注入历史记忆到 Prompt', async () => {
      const mockContext: MemoryContext = {
        episodicMemories: [
          {
            id: 'ep_1',
            taskType: 'CODE_EXPLAIN',
            summary: '之前解释过类似代码',
            timestamp: Date.now()
          }
        ],
        preferenceRecommendations: []
      };

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '这是代码解释',
        durationMs: 500
      });

      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('const y = 2;'), languageId: 'typescript' },
        selection: { isEmpty: false }
      };

      await (command as any).executeCore({}, mockContext);

      // 验证 LLM 调用时包含了记忆上下文
      const callArgs = mockLLMTool.call.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('相关历史记忆');
      expect(callArgs.messages[1].content).toContain('之前解释过类似代码');
    });

    it('应该注入偏好推荐到 Prompt', async () => {
      const mockContext: MemoryContext = {
        episodicMemories: [],
        preferenceRecommendations: [
          {
            domain: 'CODE_PATTERN',
            pattern: { style: 'functional' },
            confidence: 0.85
          }
        ]
      };

      mockLLMTool.call.mockResolvedValue({
        success: true,
        data: '这是代码解释',
        durationMs: 500
      });

      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('const z = 3;'), languageId: 'typescript' },
        selection: { isEmpty: false }
      };

      await (command as any).executeCore({}, mockContext);

      // 验证 LLM 调用时包含了偏好
      const callArgs = mockLLMTool.call.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('根据用户历史偏好');
      expect(callArgs.messages[1].content).toContain('functional');
    });

    it('应该在无编辑器时返回错误', async () => {
      (vscode.window.activeTextEditor as any) = null;

      const result = await (command as any).executeCore({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active editor');
    });

    it('应该在无选中代码时返回错误', async () => {
      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('') },
        selection: { isEmpty: true }
      };

      const result = await (command as any).executeCore({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code selected');
    });

    it('应该在 LLM 调用失败时返回错误', async () => {
      mockLLMTool.call.mockResolvedValue({
        success: false,
        error: 'API Error',
        durationMs: 100
      });

      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('const a = 1;'), languageId: 'typescript' },
        selection: { isEmpty: false }
      };

      const result = await (command as any).executeCore({}, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('缓存机制测试', () => {
    it.skip('应该使用缓存避免重复调用 LLM', async () => {
      // TODO: 需要更复杂的缓存 Mock 策略
      const { LLMResponseCache } = require('../../../src/core/cache/LLMResponseCache');
      const cache = new LLMResponseCache();
      
      // 模拟缓存命中
      cache.get = jest.fn().mockReturnValue('缓存的解释结果');

      (command as any).cache = cache;

      (vscode.window.activeTextEditor as any) = {
        document: { getText: jest.fn().mockReturnValue('const cached = true;'), languageId: 'typescript' },
        selection: { isEmpty: false }
      };

      const result = await (command as any).executeCore({}, {});

      expect(result.success).toBe(true);
      expect(mockLLMTool.call).not.toHaveBeenCalled(); // 未调用 LLM
    });
  });
});
