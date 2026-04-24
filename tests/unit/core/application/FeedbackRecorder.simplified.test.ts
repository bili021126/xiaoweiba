/**
 * FeedbackRecorder 单元测试 - 简化版
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { FeedbackRecorder } from '../../../../src/core/application/FeedbackRecorder';
import { createMockDatabaseManager, createMockProjectFingerprint } from '../../../__mocks__/globalMocks';

describe('FeedbackRecorder Simplified', () => {
  let recorder: FeedbackRecorder;

  beforeEach(() => {
    container.clearInstances();
    
    const mockDbManager = createMockDatabaseManager();
    const mockFingerprint = createMockProjectFingerprint();
    
    container.registerInstance('DatabaseManager', mockDbManager);
    container.registerInstance('ProjectFingerprint', mockFingerprint);
    
    recorder = container.resolve(FeedbackRecorder);
  });

  it('should record click feedback without throwing', async () => {
    await expect(recorder.recordClickFeedback('query_123', 'mem_456', 5000)).resolves.toBeUndefined();
  });
});
