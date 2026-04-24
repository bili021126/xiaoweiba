import 'reflect-metadata';
import { FeedbackRecorder } from '../../../../src/core/application/FeedbackRecorder';
import { IntentAnalyzer } from '../../../../src/core/memory/IntentAnalyzer';
import { ExpertSelector } from '../../../../src/core/memory/ExpertSelector';
import { ProjectFingerprint } from '../../../../src/utils/ProjectFingerprint';
import { DatabaseManager } from '../../../../src/storage/DatabaseManager';

// Mock dependencies
jest.mock('../../../../src/core/memory/IntentAnalyzer');
jest.mock('../../../../src/core/memory/ExpertSelector');
jest.mock('../../../../src/utils/ProjectFingerprint');
jest.mock('../../../../src/storage/DatabaseManager');

const mockDb = {
  run: jest.fn()
};

describe('FeedbackRecorder E2E', () => {
  let feedbackRecorder: FeedbackRecorder;
  let mockProjectFingerprint: jest.Mocked<ProjectFingerprint>;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockIntentAnalyzer: jest.Mocked<IntentAnalyzer>;
  let mockExpertSelector: jest.Mocked<ExpertSelector>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockProjectFingerprint = {
      getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test-project-fp')
    } as any;

    mockDbManager = {
      getDatabase: jest.fn().mockReturnValue(mockDb)
    } as any;

    mockIntentAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        temporal: 0.5,
        entity: 0.3,
        semantic: 0.2,
        distantTemporal: 0
      })
    } as any;

    mockExpertSelector = {
      getBaseWeights: jest.fn().mockReturnValue({ k: 0.4, t: 0.3, e: 0.2, v: 0.1 }),
      recordFeedback: jest.fn()
    } as any;

    // Inject mocks into FeedbackRecorder
    (IntentAnalyzer as jest.Mock).mockImplementation(() => mockIntentAnalyzer);
    (ExpertSelector as jest.Mock).mockImplementation(() => mockExpertSelector);
    
    feedbackRecorder = new FeedbackRecorder(mockProjectFingerprint, mockDbManager);
    
    // Override the instances created in constructor
    (feedbackRecorder as any).intentAnalyzer = mockIntentAnalyzer;
    (feedbackRecorder as any).expertSelector = mockExpertSelector;
  });

  describe('recordClickFeedback - Complete Learning Loop', () => {
    it('should execute complete feedback learning loop', async () => {
      const query = '如何优化 React 组件性能？';
      const clickedMemoryId = 'mem_123';
      const dwellTimeMs = 5000;

      await feedbackRecorder.recordClickFeedback(query, clickedMemoryId, dwellTimeMs);

      // Step 1: IntentAnalyzer should analyze the query
      expect(mockIntentAnalyzer.analyze).toHaveBeenCalledWith(query);

      // Step 2: ExpertSelector should get base weights
      expect(mockExpertSelector.getBaseWeights).toHaveBeenCalled();

      // Step 3: ExpertSelector should record feedback with intent vector
      expect(mockExpertSelector.recordFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          temporal: 0.5,
          entity: 0.3,
          semantic: 0.2
        }),
        expect.objectContaining({
          k: 0.4,
          t: 0.3,
          e: 0.2,
          v: 0.1
        }),
        query,
        dwellTimeMs
      );

      // Step 4: Database should persist feedback record
      expect(mockProjectFingerprint.getCurrentProjectFingerprint).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feedback_records'),
        expect.arrayContaining([
          expect.stringMatching(/^fb_\d+_[a-z0-9]+$/), // ID format
          'test-project-fp',
          query,
          clickedMemoryId,
          dwellTimeMs,
          expect.any(Number) // timestamp
        ])
      );
    });

    it('should handle different query types correctly', async () => {
      const testCases = [
        {
          query: '昨天的代码修改',
          expectedIntent: { temporal: 0.8, entity: 0.1, semantic: 0.1, distantTemporal: 0 }
        },
        {
          query: '用户认证模块的实现',
          expectedIntent: { temporal: 0.2, entity: 0.6, semantic: 0.2, distantTemporal: 0 }
        },
        {
          query: '类似上周的数据库优化方案',
          expectedIntent: { temporal: 0.3, entity: 0.2, semantic: 0.3, distantTemporal: 0.2 }
        }
      ];

      for (const testCase of testCases) {
        mockIntentAnalyzer.analyze.mockReturnValue(testCase.expectedIntent);
        
        await feedbackRecorder.recordClickFeedback(testCase.query, 'mem_test', 3000);

        expect(mockIntentAnalyzer.analyze).toHaveBeenCalledWith(testCase.query);
        expect(mockExpertSelector.recordFeedback).toHaveBeenCalledWith(
          expect.objectContaining(testCase.expectedIntent),
          expect.any(Object),
          testCase.query,
          3000
        );
      }
    });

    it('should handle short dwell time (low confidence)', async () => {
      await feedbackRecorder.recordClickFeedback('test query', 'mem_123', 500);

      expect(mockExpertSelector.recordFeedback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        'test query',
        500 // Short dwell time should still be recorded
      );
    });

    it('should handle long dwell time (high confidence)', async () => {
      await feedbackRecorder.recordClickFeedback('test query', 'mem_123', 30000);

      expect(mockExpertSelector.recordFeedback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        'test query',
        30000 // Long dwell time indicates high satisfaction
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw, error is caught internally
      await expect(
        feedbackRecorder.recordClickFeedback('test query', 'mem_123', 5000)
      ).resolves.not.toThrow();

      // But IntentAnalyzer and ExpertSelector should still be called
      expect(mockIntentAnalyzer.analyze).toHaveBeenCalled();
      expect(mockExpertSelector.recordFeedback).toHaveBeenCalled();
    });

    it('should handle project fingerprint errors gracefully', async () => {
      mockProjectFingerprint.getCurrentProjectFingerprint.mockRejectedValue(
        new Error('Fingerprint error')
      );

      // Should not throw, error is caught internally
      await expect(
        feedbackRecorder.recordClickFeedback('test query', 'mem_123', 5000)
      ).resolves.not.toThrow();
    });

    it('should generate unique feedback IDs', async () => {
      await feedbackRecorder.recordClickFeedback('query1', 'mem_1', 1000);
      await feedbackRecorder.recordClickFeedback('query2', 'mem_2', 2000);

      const calls = mockDb.run.mock.calls;
      expect(calls.length).toBe(2);
      
      const id1 = calls[0][1][0];
      const id2 = calls[1][1][0];
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^fb_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^fb_\d+_[a-z0-9]+$/);
    });

    it('should preserve project isolation', async () => {
      mockProjectFingerprint.getCurrentProjectFingerprint.mockResolvedValueOnce('project-a');
      await feedbackRecorder.recordClickFeedback('query', 'mem_1', 1000);

      mockProjectFingerprint.getCurrentProjectFingerprint.mockResolvedValueOnce('project-b');
      await feedbackRecorder.recordClickFeedback('query', 'mem_2', 1000);

      const calls = mockDb.run.mock.calls;
      expect(calls[0][1][1]).toBe('project-a');
      expect(calls[1][1][1]).toBe('project-b');
    });
  });

  describe('getExpertSelector', () => {
    it('should return expert selector instance', () => {
      const selector = feedbackRecorder.getExpertSelector();
      expect(selector).toBeDefined();
      expect(selector).toBe(mockExpertSelector);
    });
  });

  describe('Integration with IntentAnalyzer', () => {
    it('should correctly extract temporal intent from time-related queries', async () => {
      const timeQueries = [
        '昨天的代码',
        '上周的修改',
        '最近的提交'
      ];

      for (const query of timeQueries) {
        mockIntentAnalyzer.analyze.mockReturnValue({
          temporal: 0.8,
          entity: 0.1,
          semantic: 0.1,
          distantTemporal: 0
        });

        await feedbackRecorder.recordClickFeedback(query, 'mem_123', 3000);

        const intentCall = mockIntentAnalyzer.analyze.mock.calls[
          mockIntentAnalyzer.analyze.mock.calls.length - 1
        ];
        expect(intentCall[0]).toBe(query);
      }
    });

    it('should correctly extract entity intent from code-related queries', async () => {
      const entityQueries = [
        'UserAuth 类的实现',
        'database schema 设计',
        'API endpoint 定义'
      ];

      for (const query of entityQueries) {
        mockIntentAnalyzer.analyze.mockReturnValue({
          temporal: 0.1,
          entity: 0.7,
          semantic: 0.2,
          distantTemporal: 0
        });

        await feedbackRecorder.recordClickFeedback(query, 'mem_123', 3000);

        const intentCall = mockIntentAnalyzer.analyze.mock.calls[
          mockIntentAnalyzer.analyze.mock.calls.length - 1
        ];
        expect(intentCall[0]).toBe(query);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle null query gracefully', async () => {
      mockIntentAnalyzer.analyze.mockImplementation(() => {
        throw new Error('Invalid query');
      });

      await expect(
        feedbackRecorder.recordClickFeedback(null as any, 'mem_123', 3000)
      ).resolves.not.toThrow();
    });

    it('should handle empty memory ID gracefully', async () => {
      await feedbackRecorder.recordClickFeedback('test query', '', 3000);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['', expect.any(Number)])
      );
    });

    it('should handle zero dwell time gracefully', async () => {
      await feedbackRecorder.recordClickFeedback('test query', 'mem_123', 0);

      expect(mockExpertSelector.recordFeedback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        'test query',
        0
      );
    });
  });
});
