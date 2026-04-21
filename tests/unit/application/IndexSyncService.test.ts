/**
 * IndexSyncService 单元测试
 */

import 'reflect-metadata';
import { IndexSyncService } from '../../../src/core/application/IndexSyncService';
import { DatabaseManager } from '../../../src/storage/DatabaseManager';
import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import { IndexManager } from '../../../src/core/memory/IndexManager';
import { QueryExecutor } from '../../../src/core/application/QueryExecutor';

describe('IndexSyncService', () => {
  let service: IndexSyncService;
  let mockDbManager: any;
  let mockProjectFingerprint: any;
  let mockIndexManager: any;
  let mockQueryExecutor: any;

  beforeEach(() => {
    mockDbManager = {};
    mockProjectFingerprint = {
      getCurrentProjectFingerprint: jest.fn().mockResolvedValue('test_fp')
    };
    mockIndexManager = {
      buildIndex: jest.fn()
    };
    mockQueryExecutor = {
      getRecentMemories: jest.fn().mockResolvedValue([
        { id: '1', summary: 'test' }
      ])
    };

    service = new IndexSyncService(
      mockDbManager,
      mockProjectFingerprint,
      mockIndexManager,
      mockQueryExecutor
    );
  });

  it('应该成功重建索引', async () => {
    await service.rebuildIndex();
    expect(mockQueryExecutor.getRecentMemories).toHaveBeenCalledWith(2000);
    expect(mockIndexManager.buildIndex).toHaveBeenCalled();
  });

  it('在没有项目指纹时应跳过重建', async () => {
    mockProjectFingerprint.getCurrentProjectFingerprint.mockResolvedValue(null);
    await service.rebuildIndex();
    expect(mockQueryExecutor.getRecentMemories).not.toHaveBeenCalled();
  });
});
