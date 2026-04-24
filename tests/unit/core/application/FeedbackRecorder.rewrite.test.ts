/**
 * FeedbackRecorder 单元测试 - 使用全局 Mock 配置
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { FeedbackRecorder } from '../../../../src/core/application/FeedbackRecorder';
import { createMockDatabaseManager, createMockProjectFingerprint } from '../../../__mocks__/globalMocks';

const mockDbManager = createMockDatabaseManager();
const mockFingerprint = createMockProjectFingerprint();

describe('FeedbackRecorder (Global Mock)', () => {
  let recorder: FeedbackRecorder;
  let mockDbManager: any;
  let mockFingerprint: any;

  beforeEach(() => {
    container.clearInstances();
    
    mockDbManager = createMockDatabaseManager();
    mockFingerprint = createMockProjectFingerprint();
    
    container.registerInstance('DatabaseManager', mockDbManager);
    container.registerInstance('ProjectFingerprint', mockFingerprint);
    
    recorder = container.resolve(FeedbackRecorder);
  });

  describe('recordClickFeedback', () => {
    it('should record click feedback successfully', async () => {
      await recorder.recordClickFeedback('query_123', 'mem_456', 5000);

      expect(mockDbManager.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO feedback'),
        expect.any(Array)
      );

    });

    it('should handle recording failure gracefully', async () => {
      (mockDbManager.run as jest.Mock).mockRejectedValue(new Error('Database error'));

      // 应该捕获错误而不抛出
      await expect(recorder.recordClickFeedback('q', 'm', 100)).resolves.toBeUndefined();
    });
  });
});
