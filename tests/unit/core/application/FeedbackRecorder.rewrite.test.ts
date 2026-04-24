/**
 * FeedbackRecorder 单元测试 - 重写以适配 IMemoryPort
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { FeedbackRecorder } from '../../../../src/core/application/FeedbackRecorder';
import { ProjectFingerprint } from '../../../../src/utils/ProjectFingerprint';
import { DatabaseManager } from '../../../../src/storage/DatabaseManager';

const mockDbManager = {
  query: jest.fn(),
  run: jest.fn()
};

const mockFingerprint = {
  getFingerprint: jest.fn().mockResolvedValue('fp_123')
};

describe('FeedbackRecorder (Rewritten)', () => {
  let recorder: FeedbackRecorder;

  beforeEach(() => {
    container.clearInstances();
    container.registerInstance(DatabaseManager, mockDbManager as unknown as DatabaseManager);
    container.registerInstance(ProjectFingerprint, mockFingerprint as unknown as ProjectFingerprint);
    
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
