import { PreferenceMemory, PreferenceDomain } from '../../../../src/core/memory/PreferenceMemory';
import { DatabaseManager } from '../../../../src/storage/DatabaseManager';
import { AuditLogger } from '../../../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../../../src/utils/ProjectFingerprint';
import { ConfigManager } from '../../../../src/storage/ConfigManager';

// Mock sql.js
jest.mock('sql.js', () => {
  const mockDb = {
    run: jest.fn(),
    exec: jest.fn(),
    export: jest.fn().mockReturnValue(new Uint8Array()),
    close: jest.fn()
  };
  return jest.fn().mockImplementation(() => mockDb);
});

describe('PreferenceMemory', () => {
  let preferenceMemory: PreferenceMemory;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockProjectFingerprint: jest.Mocked<ProjectFingerprint>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDbManager = {
      runQuery: jest.fn(),
      runMutation: jest.fn()
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockProjectFingerprint = {
      getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-fingerprint-123')
    } as any;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        memory: {
          retentionDays: 90,
          decayLambda: 0.01,
          coldStartTrust: 3
        }
      })
    } as any;

    preferenceMemory = new PreferenceMemory(
      mockDbManager,
      mockAuditLogger,
      mockProjectFingerprint,
      mockConfigManager
    );
  });

  describe('recordPreference', () => {
    it('should create a new preference when no existing pattern found', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);
      (mockDbManager.runMutation as jest.Mock).mockReturnValue({});

      const pattern = { naming_style: 'camelCase', prefix: 'get' };
      const id = await preferenceMemory.recordPreference('NAMING', pattern, true);

      expect(id).toMatch(/^pref_\d+_[a-z0-9]+$/);
      expect(mockDbManager.runMutation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO preference_memory'),
        expect.arrayContaining([
          id,
          'NAMING',
          JSON.stringify(pattern),
          0.8,
          1,
          expect.any(Number),
          null,
          'test-fingerprint-123'
        ])
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'preference_create',
        'success',
        0
      );
    });

    it('should update existing preference when pattern already exists', async () => {
      const existingRecord = {
        id: 'pref_existing_123',
        domain: 'NAMING',
        pattern: JSON.stringify({ naming_style: 'camelCase' }),
        confidence: 0.75,
        sample_count: 5,
        last_updated: Date.now() - 1000,
        model_id: null,
        project_fingerprint: 'test-fingerprint-123'
      };

      (mockDbManager.runQuery as jest.Mock)
        .mockReturnValueOnce([existingRecord]) // findExistingPreference
        .mockReturnValueOnce([{ confidence: 0.75, sample_count: 5 }]); // updateExistingPreference

      (mockDbManager.runMutation as jest.Mock).mockReturnValue({});

      const pattern = { naming_style: 'camelCase' };
      const id = await preferenceMemory.recordPreference('NAMING', pattern, true);

      expect(id).toBe('pref_existing_123');
      expect(mockDbManager.runMutation).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE preference_memory'),
        expect.arrayContaining([
          expect.any(Number), // newConfidence
          6, // newSampleCount
          expect.any(Number), // timestamp
          'pref_existing_123'
        ])
      );
    });

    it('should handle negative feedback correctly', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);
      (mockDbManager.runMutation as jest.Mock).mockReturnValue({});

      const pattern = { sql_strategy: 'JOIN_FIRST' };
      const id = await preferenceMemory.recordPreference('SQL_STRATEGY', pattern, false);

      expect(id).toMatch(/^pref_\d+_[a-z0-9]+$/);
      expect(mockDbManager.runMutation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO preference_memory'),
        expect.arrayContaining([
          id,
          'SQL_STRATEGY',
          JSON.stringify(pattern),
          0.3, // initialConfidence for negative feedback
          0, // initialSampleCount for negative feedback
          expect.any(Number),
          null,
          'test-fingerprint-123'
        ])
      );
    });

    it('should include modelId when provided', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);
      (mockDbManager.runMutation as jest.Mock).mockReturnValue({});

      const pattern = { test_style: 'BDD' };
      const modelId = 'gpt-4';
      await preferenceMemory.recordPreference('TEST_STYLE', pattern, true, modelId);

      expect(mockDbManager.runMutation).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO preference_memory'),
        expect.arrayContaining([modelId])
      );
    });

    it('should log error when recording fails', async () => {
      const error = new Error('Database error');
      (mockDbManager.runQuery as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(
        preferenceMemory.recordPreference('NAMING', { style: 'test' }, true)
      ).rejects.toThrow('Database error');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'preference_record',
        error,
        0
      );
    });
  });

  describe('queryPreferences', () => {
    it('should query all preferences without filters', async () => {
      const mockRows = [
        {
          id: 'pref_1',
          domain: 'NAMING',
          pattern: JSON.stringify({ style: 'camelCase' }),
          confidence: 0.85,
          sample_count: 10,
          last_updated: Date.now(),
          model_id: null,
          project_fingerprint: 'fp1'
        },
        {
          id: 'pref_2',
          domain: 'SQL_STRATEGY',
          pattern: JSON.stringify({ strategy: 'INDEX_SCAN' }),
          confidence: 0.75,
          sample_count: 5,
          last_updated: Date.now() - 1000,
          model_id: null,
          project_fingerprint: null
        }
      ];

      (mockDbManager.runQuery as jest.Mock).mockReturnValue(mockRows);

      const results = await preferenceMemory.queryPreferences();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('pref_1');
      expect(results[0].domain).toBe('NAMING');
      expect(results[0].pattern).toEqual({ style: 'camelCase' });
      expect(results[0].confidence).toBe(0.85);
      expect(results[0].sampleCount).toBe(10);
      expect(results[0].projectFingerprint).toBe('fp1');
      expect(results[1].projectFingerprint).toBeUndefined();
    });

    it('should filter by domain', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({ domain: 'NAMING' });

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE domain = ?'),
        ['NAMING']
      );
    });

    it('should filter by minConfidence', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({ minConfidence: 0.7 });

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE confidence >= ?'),
        [0.7]
      );
    });

    it('should filter by projectFingerprint with NULL fallback', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({ projectFingerprint: 'fp123' });

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (project_fingerprint = ? OR project_fingerprint IS NULL)'),
        ['fp123']
      );
    });

    it('should filter by modelId with NULL fallback', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({ modelId: 'gpt-4' });

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (model_id = ? OR model_id IS NULL)'),
        ['gpt-4']
      );
    });

    it('should apply limit when specified', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({ limit: 5 });

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 5'),
        []
      );
    });

    it('should order by confidence DESC and sample_count DESC', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences();

      expect(mockDbManager.runQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY confidence DESC, sample_count DESC'),
        []
      );
    });

    it('should combine multiple filters', async () => {
      (mockDbManager.runQuery as jest.Mock).mockReturnValue([]);

      await preferenceMemory.queryPreferences({
        domain: 'NAMING',
        minConfidence: 0.6,
        limit: 10
      });

      const callArgs = (mockDbManager.runQuery as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('WHERE domain = ?');
      expect(callArgs[0]).toContain('AND confidence >= ?');
      expect(callArgs[0]).toContain('LIMIT 10');
      expect(callArgs[1]).toEqual(['NAMING', 0.6]);
    });

    it('should log error when query fails', async () => {
      const error = new Error('Query failed');
      (mockDbManager.runQuery as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(preferenceMemory.queryPreferences()).rejects.toThrow('Query failed');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'preference_query',
        error,
        0
      );
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations sorted by match score', async () => {
      const mockPrefs = [
        {
          id: 'pref_1',
          domain: 'NAMING',
          pattern: { style: 'camelCase', prefix: 'get' },
          confidence: 0.9,
          sampleCount: 10,
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        },
        {
          id: 'pref_2',
          domain: 'NAMING',
          pattern: { style: 'snake_case', prefix: 'fetch' },
          confidence: 0.8,
          sampleCount: 8,
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        }
      ];

      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue(mockPrefs);

      const contextPattern = { style: 'camelCase', prefix: 'get' };
      const recommendations = await preferenceMemory.getRecommendations('NAMING', contextPattern);

      expect(recommendations).toHaveLength(2);
      // First should have higher match score due to exact match
      expect(recommendations[0].matchScore).toBeGreaterThanOrEqual(recommendations[1].matchScore);
      expect(recommendations[0].record.id).toBe('pref_1');
    });

    it('should filter out low confidence preferences in cold start', async () => {
      const mockPrefs = [
        {
          id: 'pref_1',
          domain: 'NAMING',
          pattern: { style: 'camelCase' },
          confidence: 0.4,
          sampleCount: 2, // Below coldStartThreshold
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        },
        {
          id: 'pref_2',
          domain: 'NAMING',
          pattern: { style: 'snake_case' },
          confidence: 0.8,
          sampleCount: 8, // Above coldStartThreshold
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        }
      ];

      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue(mockPrefs);

      const recommendations = await preferenceMemory.getRecommendations('NAMING');

      // Cold start preference (sampleCount < 3 and confidence < 0.7) should be filtered out
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].record.id).toBe('pref_2');
    });

    it('should apply cold start threshold', async () => {
      const mockPrefs = [
        {
          id: 'pref_1',
          domain: 'NAMING',
          pattern: { style: 'camelCase' },
          confidence: 0.65,
          sampleCount: 2, // Below coldStartThreshold of 3
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        },
        {
          id: 'pref_2',
          domain: 'NAMING',
          pattern: { style: 'snake_case' },
          confidence: 0.75,
          sampleCount: 5, // Above coldStartThreshold
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        }
      ];

      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue(mockPrefs);

      const recommendations = await preferenceMemory.getRecommendations('NAMING');

      // Cold start preference should be filtered out (confidence < 0.7)
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].record.id).toBe('pref_2');
    });

    it('should allow cold start preferences with high confidence', async () => {
      const mockPrefs = [
        {
          id: 'pref_1',
          domain: 'NAMING',
          pattern: { style: 'camelCase' },
          confidence: 0.85, // High enough despite low sample count
          sampleCount: 1, // Below coldStartThreshold
          lastUpdated: Date.now(),
          modelId: undefined,
          projectFingerprint: undefined
        }
      ];

      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue(mockPrefs);

      const recommendations = await preferenceMemory.getRecommendations('NAMING');

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].record.id).toBe('pref_1');
    });

    it('should use modelId filter when provided', async () => {
      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue([]);

      await preferenceMemory.getRecommendations('NAMING', {}, 'gpt-4');

      expect(preferenceMemory['queryPreferences']).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'NAMING',
          modelId: 'gpt-4',
          minConfidence: 0.5
        })
      );
    });

    it('should return empty array when no preferences found', async () => {
      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockResolvedValue([]);

      const recommendations = await preferenceMemory.getRecommendations('NAMING');

      expect(recommendations).toEqual([]);
    });

    it('should log error when recommendation fails', async () => {
      const error = new Error('Recommendation failed');
      jest.spyOn(preferenceMemory as any, 'queryPreferences').mockRejectedValue(error);

      await expect(preferenceMemory.getRecommendations('NAMING')).rejects.toThrow('Recommendation failed');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'preference_recommend',
        error,
        0
      );
    });
  });

  describe('deletePreference', () => {
    it('should delete a preference by ID', async () => {
      (mockDbManager.runMutation as jest.Mock).mockReturnValue({});

      await preferenceMemory.deletePreference('pref_123');

      expect(mockDbManager.runMutation).toHaveBeenCalledWith(
        'DELETE FROM preference_memory WHERE id = ?',
        ['pref_123']
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'preference_delete',
        'success',
        0
      );
    });

    it('should log error when deletion fails', async () => {
      const error = new Error('Delete failed');
      (mockDbManager.runMutation as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(preferenceMemory.deletePreference('pref_123')).rejects.toThrow('Delete failed');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'preference_delete',
        error,
        0
      );
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      (mockDbManager.runQuery as jest.Mock)
        .mockReturnValueOnce([{ count: 25 }]) // totalCount
        .mockReturnValueOnce([ // byDomain
          { domain: 'NAMING', count: 10 },
          { domain: 'SQL_STRATEGY', count: 8 },
          { domain: 'TEST_STYLE', count: 7 }
        ])
        .mockReturnValueOnce([{ avg_conf: 0.78 }]) // averageConfidence
        .mockReturnValueOnce([{ count: 5 }]); // coldStartCount

      const stats = await preferenceMemory.getStats();

      expect(stats.totalCount).toBe(25);
      expect(stats.byDomain.NAMING).toBe(10);
      expect(stats.byDomain.SQL_STRATEGY).toBe(8);
      expect(stats.byDomain.TEST_STYLE).toBe(7);
      expect(stats.byDomain.COMMIT_STYLE).toBe(0);
      expect(stats.byDomain.CODE_PATTERN).toBe(0);
      expect(stats.averageConfidence).toBe(0.78);
      expect(stats.coldStartCount).toBe(5);
    });

    it('should handle empty database', async () => {
      (mockDbManager.runQuery as jest.Mock)
        .mockReturnValueOnce([{ count: 0 }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ avg_conf: null }])
        .mockReturnValueOnce([{ count: 0 }]);

      const stats = await preferenceMemory.getStats();

      expect(stats.totalCount).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.coldStartCount).toBe(0);
    });

    it('should log error when stats retrieval fails', async () => {
      const error = new Error('Stats failed');
      (mockDbManager.runQuery as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(preferenceMemory.getStats()).rejects.toThrow('Stats failed');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'preference_stats',
        error,
        0
      );
    });
  });

  describe('calculateMatchScore', () => {
    it('should calculate Jaccard similarity correctly', () => {
      const storedPattern = { a: 1, b: 2, c: 3 };
      const contextPattern = { a: 1, b: 2, d: 4 };

      const score = (preferenceMemory as any).calculateMatchScore(storedPattern, contextPattern);

      // Intersection: {a, b} = 2
      // Union: {a, b, c, d} = 4
      // Jaccard = 2/4 = 0.5
      expect(score).toBeCloseTo(0.5);
    });

    it('should return 0 when no common keys', () => {
      const storedPattern = { a: 1, b: 2 };
      const contextPattern = { c: 3, d: 4 };

      const score = (preferenceMemory as any).calculateMatchScore(storedPattern, contextPattern);

      expect(score).toBe(0);
    });

    it('should return 1 when identical patterns', () => {
      const pattern = { a: 1, b: 2, c: 3 };

      const score = (preferenceMemory as any).calculateMatchScore(pattern, pattern);

      expect(score).toBe(1);
    });

    it('should return confidence when context is empty', () => {
      const storedPattern = { confidence: 0.85 };
      const contextPattern = {};

      const score = (preferenceMemory as any).calculateMatchScore(storedPattern, contextPattern);

      expect(score).toBe(0.85);
    });

    it('should only count matching values', () => {
      const storedPattern = { a: 1, b: 2 };
      const contextPattern = { a: 1, b: 3 };

      const score = (preferenceMemory as any).calculateMatchScore(storedPattern, contextPattern);

      // Only 'a' matches in value, intersection = 1
      // Union = {a, b} = 2
      // Jaccard = 1/2 = 0.5
      expect(score).toBeCloseTo(0.5);
    });
  });

  describe('hashPattern', () => {
    it('should generate consistent hash for same pattern', () => {
      const pattern = { b: 2, a: 1, c: 3 };
      const hash1 = (preferenceMemory as any).hashPattern(pattern);
      const hash2 = (preferenceMemory as any).hashPattern(pattern);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate same hash regardless of key order', () => {
      const pattern1 = { a: 1, b: 2, c: 3 };
      const pattern2 = { c: 3, a: 1, b: 2 };

      const hash1 = (preferenceMemory as any).hashPattern(pattern1);
      const hash2 = (preferenceMemory as any).hashPattern(pattern2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different patterns', () => {
      const pattern1 = { a: 1, b: 2 };
      const pattern2 = { a: 1, b: 3 };

      const hash1 = (preferenceMemory as any).hashPattern(pattern1);
      const hash2 = (preferenceMemory as any).hashPattern(pattern2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
