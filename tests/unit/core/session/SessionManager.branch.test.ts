/**
 * SessionManager 单元测试 - 补充会话管理分支
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { SessionManager } from '../../../../src/core/application/SessionManager';
import { createMockDatabaseManager } from '../../../__mocks__/globalMocks';

describe('SessionManager (Branch Coverage)', () => {
  let sessionManager: SessionManager;
  let mockDbManager: any;

  beforeEach(() => {
    const container = require('tsyringe').container;
    container.clearInstances();
    
    mockDbManager = createMockDatabaseManager();
    
    container.registerInstance('DatabaseManager', mockDbManager);
    
    sessionManager = container.resolve(SessionManager);
  });

  it('should create a new session', async () => {
    const mockDb = { run: jest.fn() };
    mockDbManager.getDatabase.mockReturnValue(mockDb);
    
    await sessionManager.createSession('session_123', { title: 'Test' });
    
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('should handle session creation error', async () => {
    const mockDb = { run: jest.fn().mockImplementation(() => { throw new Error('DB error'); }) };
    mockDbManager.getDatabase.mockReturnValue(mockDb);
    
    await expect(sessionManager.createSession('session_123')).rejects.toThrow('DB error');
  });
});
