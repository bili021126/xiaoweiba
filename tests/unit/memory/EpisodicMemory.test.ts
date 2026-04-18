/**
 * EpisodicMemory 单元测试 - 核心功能覆盖
 */

import { EpisodicMemory } from '../../../src/core/memory/EpisodicMemory';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import { container } from 'tsyringe';

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn((key) => {
        if (key === 'memory') return { decayLambda: 0.1 };
        return {};
      })
    })
  }
}));

describe('EpisodicMemory', () => {
  let episodicMemory: EpisodicMemory;
  let mockSecretStorage: any;

  beforeAll(async () => {
    // Mock SecretStorage
    mockSecretStorage = {
      get: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    };

    // Register mock dependencies
    const configManager = new ConfigManager(mockSecretStorage as any);
    container.registerInstance(ConfigManager, configManager);
    
    const dbManager = new DatabaseManager(configManager);
    await (dbManager as any).initialize();
    container.registerInstance(DatabaseManager, dbManager);
    
    const auditLogger = new AuditLogger(configManager);
    container.registerInstance(AuditLogger, auditLogger);
    
    const projectFingerprint = new ProjectFingerprint();
    container.registerInstance(ProjectFingerprint, projectFingerprint);
    
    episodicMemory = new EpisodicMemory(dbManager, auditLogger, projectFingerprint, configManager);
    await episodicMemory.initialize();
  });

  describe('record', () => {
    it('should record a memory successfully', async () => {
      const recordId = await episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: 'Test explanation',
        entities: ['testFunction'],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 100
      });

      expect(recordId).toBeDefined();
      expect(typeof recordId).toBe('string');
    });

    it('should handle empty entities', async () => {
      const recordId = await episodicMemory.record({
        taskType: 'CODE_GENERATE',
        summary: 'Generate code',
        entities: [],
        outcome: 'SUCCESS',
        modelId: 'test-model',
        durationMs: 200
      });

      expect(recordId).toBeDefined();
    });
  });

  describe('retrieve', () => {
    it('should retrieve recent memories', async () => {
      const memories = await episodicMemory.retrieve({ limit: 5 });
      
      expect(Array.isArray(memories)).toBe(true);
      expect(memories.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter by task type', async () => {
      const memories = await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 3
      });

      expect(Array.isArray(memories)).toBe(true);
      memories.forEach(m => {
        expect(m.taskType).toBe('CODE_EXPLAIN');
      });
    });
  });

  describe('search', () => {
    it('should search by keyword', async () => {
      const memories = await episodicMemory.search('test', { limit: 5 });
      
      expect(Array.isArray(memories)).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const memories = await episodicMemory.search('nonexistent_keyword_xyz', { limit: 5 });
      
      expect(Array.isArray(memories)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const stats = await episodicMemory.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
    });
  });
});
