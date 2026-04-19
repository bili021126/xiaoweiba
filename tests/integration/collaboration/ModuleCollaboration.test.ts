/**
 * 模块协同测试 - 基于真实代码的依赖关系验证
 * 
 * 本文件验证各模块间的依赖注入是否正确配置，
 * 以及模块间是否能正常通信。
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { LLMTool } from '../../../src/tools/LLMTool';

describe('模块协同测试 - 依赖注入验证', () => {
  afterEach(() => {
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('协同场景1: EpisodicMemory → DatabaseManager', () => {
    it('应该正确注入DatabaseManager依赖', () => {
      // Arrange
      const mockDbManager = {
        getDatabase: jest.fn(),
        initialize: jest.fn(),
        close: jest.fn(),
        run: jest.fn(),
        exec: jest.fn(),
        transaction: jest.fn((fn) => fn())
      } as any;
      
      const mockAuditLogger = {
        log: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      const mockProjectFingerprint = {
        getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fp')
      } as any;
      
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          memory: { retentionDays: 90, decayLambda: 0.01 }
        })
      } as any;

      container.registerInstance(DatabaseManager, mockDbManager);
      container.registerInstance(AuditLogger, mockAuditLogger);
      container.registerInstance(ProjectFingerprint, mockProjectFingerprint);
      container.registerInstance(ConfigManager, mockConfigManager);

      // Act
      const episodicMemory = container.resolve(EpisodicMemory);

      // Assert - 验证依赖已注入
      expect(episodicMemory['dbManager']).toBe(mockDbManager);
      expect(episodicMemory['auditLogger']).toBe(mockAuditLogger);
      expect(episodicMemory['projectFingerprint']).toBe(mockProjectFingerprint);
      expect(episodicMemory['configManager']).toBe(mockConfigManager);
    });

    it('应该在record时调用DatabaseManager的方法', async () => {
      // Arrange
      const mockDb = {
        run: jest.fn(),
        exec: jest.fn().mockReturnValue([{ values: [] }]),
        getRowsModified: jest.fn().mockReturnValue(1)
      };
      
      const mockDbManager = {
        getDatabase: jest.fn().mockReturnValue(mockDb),
        transaction: jest.fn((fn) => fn()),
        run: jest.fn()  // ✅ 添加run方法
      } as any;
      
      const mockAuditLogger = {
        log: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      const mockProjectFingerprint = {
        getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fp')
      } as any;
      
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          memory: { retentionDays: 90, decayLambda: 0.01 }
        })
      } as any;

      container.registerInstance(DatabaseManager, mockDbManager);
      container.registerInstance(AuditLogger, mockAuditLogger);
      container.registerInstance(ProjectFingerprint, mockProjectFingerprint);
      container.registerInstance(ConfigManager, mockConfigManager);

      const episodicMemory = container.resolve(EpisodicMemory);

      // Act
      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '测试',
        entities: ['test'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 1000
      });

      // Assert - 验证调用了数据库操作
      expect(mockDbManager.getDatabase).toHaveBeenCalled();
      expect(mockDbManager.run).toHaveBeenCalled();  // ✅ EpisodicMemory调用dbManager.run()
    });
  });

  describe('协同场景2: EpisodicMemory → AuditLogger', () => {
    it('应该在record时自动记录审计日志', async () => {
      // Arrange
      const mockDb = {
        run: jest.fn(),
        exec: jest.fn().mockReturnValue([{ values: [] }]),
        getRowsModified: jest.fn().mockReturnValue(1)
      };
      
      const mockDbManager = {
        getDatabase: jest.fn().mockReturnValue(mockDb),
        transaction: jest.fn((fn) => fn()),
        run: jest.fn()  // ✅ 添加run方法
      } as any;
      
      const mockAuditLogger = {
        log: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      } as any;
      
      const mockProjectFingerprint = {
        getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fp')
      } as any;
      
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          memory: { retentionDays: 90, decayLambda: 0.01 }
        })
      } as any;

      container.registerInstance(DatabaseManager, mockDbManager);
      container.registerInstance(AuditLogger, mockAuditLogger);
      container.registerInstance(ProjectFingerprint, mockProjectFingerprint);
      container.registerInstance(ConfigManager, mockConfigManager);

      const episodicMemory = container.resolve(EpisodicMemory);

      // Act
      await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: '测试审计日志',
        entities: ['test'],
        outcome: 'SUCCESS',
        modelId: 'deepseek',
        durationMs: 1500
      });

      // Assert - 验证审计日志被记录
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'memory_record',  // 修正操作名
        'success',
        expect.any(Number),
        expect.objectContaining({
          parameters: expect.objectContaining({
            taskType: 'CODE_EXPLAIN'
          })
        })
      );
    });
  });

  describe('协同场景3: LLMTool → ConfigManager', () => {
    it('应该正确注入ConfigManager依赖', () => {
      // Arrange
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          model: {
            default: 'deepseek',
            providers: [{
              id: 'deepseek',
              apiUrl: 'https://api.deepseek.com/v1',
              maxTokens: 4096,
              temperature: 0.6
            }]
          }
        }),
        getApiKey: jest.fn().mockResolvedValue('test-api-key')
      } as any;
      
      const mockAuditLogger = {
        log: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      } as any;

      container.registerInstance(ConfigManager, mockConfigManager);
      container.registerInstance(AuditLogger, mockAuditLogger);

      // Act
      const llmTool = container.resolve(LLMTool);

      // Assert - 验证依赖已注入
      expect(llmTool['configManager']).toBe(mockConfigManager);
      expect(llmTool['auditLogger']).toBe(mockAuditLogger);
    });
  });

  describe('协同场景4: LLMTool → AuditLogger', () => {
    it('应该正确注入AuditLogger依赖', () => {
      // Arrange
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          model: {
            default: 'deepseek',
            providers: [{
              id: 'deepseek',
              apiUrl: 'https://api.deepseek.com/v1',
              maxTokens: 4096,
              temperature: 0.6
            }]
          }
        }),
        getApiKey: jest.fn().mockResolvedValue('test-key')
      } as any;
      
      const mockAuditLogger = {
        log: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined)
      } as any;

      container.registerInstance(ConfigManager, mockConfigManager);
      container.registerInstance(AuditLogger, mockAuditLogger);

      // Act
      const llmTool = container.resolve(LLMTool);

      // Assert - 验证依赖已注入
      expect(llmTool['auditLogger']).toBe(mockAuditLogger);
    });
  });

  describe('协同场景5: DatabaseManager → ConfigManager', () => {
    it('应该正确注入ConfigManager依赖', () => {
      // Arrange
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          memory: { retentionDays: 90 }
        })
      } as any;

      container.registerInstance(ConfigManager, mockConfigManager);

      // Act
      const dbManager = new DatabaseManager(mockConfigManager);

      // Assert - 验证依赖已注入（构造函数不再调用getConfig）
      expect(dbManager['configManager']).toBe(mockConfigManager);
    });
  });

  describe('协同场景6: AuditLogger → ConfigManager', () => {
    it('应该通过ConfigManager获取日志配置', () => {
      // Arrange
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          audit: {
            level: 'info',
            maxFileSizeMB: 20,
            maxFiles: 10
          }
        })
      } as any;

      container.registerInstance(ConfigManager, mockConfigManager);

      // Act
      const auditLogger = new AuditLogger(mockConfigManager);

      // Assert - 构造函数中会使用ConfigManager
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });
  });
});
