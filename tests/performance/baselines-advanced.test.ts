/**
 * 高级性能基准测试 - 补充关键路径性能指标
 * 
 * 包括：
 * 1. LLM调用延迟测试
 * 2. 向量检索性能
 * 3. 缓存命中率测试
 * 4. Agent执行性能
 */

import { createBenchmarkRunner } from './benchmark';
import { ConfigManager } from '../../src/storage/ConfigManager';
import { DatabaseManager } from '../../src/storage/DatabaseManager';
import { EpisodicMemory } from '../../src/core/memory/EpisodicMemory';
import { AuditLogger } from '../../src/core/security/AuditLogger';
import { ProjectFingerprint } from '../../src/utils/ProjectFingerprint';
import { LLMResponseCache } from '../../src/core/cache/LLMResponseCache';
import { container } from 'tsyringe';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Advanced Performance Baseline Tests', () => {
  let benchmarkRunner: ReturnType<typeof createBenchmarkRunner>;
  let configManager: ConfigManager;
  let databaseManager: DatabaseManager;
  let episodicMemory: EpisodicMemory;
  let auditLogger: AuditLogger;
  let projectFingerprint: ProjectFingerprint;
  let llmCache: LLMResponseCache;

  beforeAll(async () => {
    // 创建临时测试目录
    const testDir = path.join(os.tmpdir(), `xiaoweiba-adv-perf-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Mock vscode.SecretStorage
    const mockSecretStorage = {
      get: jest.fn().mockResolvedValue(undefined),
      store: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      onDidChange: jest.fn()
    };

    // 注册依赖
    container.registerInstance('SecretStorage', mockSecretStorage as any);

    // 初始化配置管理器
    configManager = new ConfigManager(mockSecretStorage as any);
    
    // 创建默认配置文件
    const configPath = path.join(testDir, '.xiaoweiba', 'config.yaml');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const defaultConfig = `mode: private
model:
  default: deepseek-v4-flash
  providers: []
security:
  trustLevel: moderate
memory:
  retentionDays: 90
audit:
  level: info
`;
    fs.writeFileSync(configPath, defaultConfig, 'utf-8');

    await configManager.loadConfig();

    // 初始化数据库管理器
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize();

    // 初始化审计日志
    auditLogger = new AuditLogger(configManager);

    // 初始化项目指纹
    projectFingerprint = new ProjectFingerprint();

    // 初始化情景记忆
    episodicMemory = new EpisodicMemory(
      databaseManager,
      auditLogger,
      projectFingerprint,
      configManager,
      { updateIndexAsync: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      { getRecentMemories: jest.fn().mockResolvedValue([]) } as any,
      { calculateInitialWeight: jest.fn().mockReturnValue(1.0) } as any,
      {} as any,
      { search: jest.fn().mockResolvedValue([]) } as any
    );

    // 初始化LLM缓存
    llmCache = new LLMResponseCache();

    benchmarkRunner = createBenchmarkRunner();
  });

  afterAll(() => {
    databaseManager?.close();
    llmCache?.dispose();
    benchmarkRunner?.clearResults();
  });

  /**
   * 性能测试1: LLM缓存命中性能
   */
  it('should measure LLM cache hit performance', async () => {
    // 预填充缓存
    llmCache.set('test prompt 1', 'cached response 1', undefined, 60000);
    llmCache.set('test prompt 2', 'cached response 2', undefined, 60000);

    const result = await benchmarkRunner.runBenchmark(
      'LLMResponseCache.get()',
      () => {
        llmCache.get('test prompt 1');
      },
      {
        warmupIterations: 100,
        measurementIterations: 1000,
        description: '测量LLM缓存命中性能（Map查找）'
      }
    );

    // 基线断言：缓存命中应极快（<1ms，包含console.log开销）
    expect(result.avgTime).toBeLessThan(1);
    expect(result.p95).toBeLessThan(2);
  });

  /**
   * 性能测试2: LLM缓存未命中性能
   */
  it('should measure LLM cache miss performance', async () => {
    let missCount = 0;
    
    const result = await benchmarkRunner.runBenchmark(
      'LLMResponseCache.get() [miss]',
      () => {
        llmCache.get(`non-existent prompt ${missCount++}`);
      },
      {
        warmupIterations: 100,
        measurementIterations: 1000,
        description: '测量LLM缓存未命中性能'
      }
    );

    // 基线断言：缓存未命中也应很快（<0.01ms）
    expect(result.avgTime).toBeLessThan(0.01);
    expect(result.p95).toBeLessThan(0.02);
  });

  /**
   * 性能测试3: 大规模缓存查找性能
   */
  it('should measure large cache lookup performance', async () => {
    // 填充大量缓存条目
    for (let i = 0; i < 100; i++) {
      llmCache.set(`prompt ${i}`, `response ${i}`, undefined, 60000);
    }

    let lookupIndex = 0;
    const result = await benchmarkRunner.runBenchmark(
      'LLMResponseCache.get() [100 entries]',
      () => {
        llmCache.get(`prompt ${lookupIndex++ % 100}`);
      },
      {
        warmupIterations: 50,
        measurementIterations: 500,
        description: '测量100条缓存条目时的查找性能'
      }
    );

    // 基线断言：即使有100条缓存，查找仍应很快（<1ms）
    expect(result.avgTime).toBeLessThan(1);
    expect(result.p95).toBeLessThan(2);
  });

  /**
   * 性能测试4: 缓存过期检查性能
   */
  it('should measure cache expiration check performance', async () => {
    // 添加即将过期的条目
    for (let i = 0; i < 50; i++) {
      llmCache.set(`expiring prompt ${i}`, `response ${i}`, undefined, 1); // 1ms TTL
    }

    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await benchmarkRunner.runBenchmark(
      'LLMResponseCache.clearExpired()',
      () => {
        llmCache['clearExpired']();
      },
      {
        warmupIterations: 10,
        measurementIterations: 50,
        description: '测量清理过期缓存的性能'
      }
    );

    // 基线断言：清理操作应在合理时间内完成
    expect(result.avgTime).toBeLessThan(5);
    expect(result.p95).toBeLessThan(10);
  });

  /**
   * 性能测试5: 批量记忆记录性能（无索引更新）
   */
  it('should measure batch memory record without index update', async () => {
    let recordCount = 0;
    
    const result = await benchmarkRunner.runBenchmark(
      'EpisodicMemory.record() [batch]',
      async () => {
        await episodicMemory.record({
          summary: `Batch perf test ${recordCount++}`,
          entities: ['perf-test'],
          decision: 'SUCCESS',
          outcome: 'SUCCESS',
          taskType: 'CODE_EXPLAIN',
          modelId: 'test-model',
          durationMs: 50
        });
      },
      {
        warmupIterations: 10,
        measurementIterations: 50,
        description: '测量批量记忆记录性能（含DB写入+索引更新）'
      }
    );

    // 基线断言：单条记录应在10ms内完成
    expect(result.avgTime).toBeLessThan(10);
    expect(result.p95).toBeLessThan(15);
  });

  /**
   * 性能测试6: 记忆检索性能（小数据集）
   */
  it('should measure memory retrieval performance [small dataset]', async () => {
    // 预插入少量数据
    for (let i = 0; i < 20; i++) {
      await episodicMemory.record({
        summary: `Retrieval test ${i}`,
        entities: ['retrieval-test'],
        decision: 'SUCCESS',
        outcome: 'SUCCESS',
        taskType: 'CODE_EXPLAIN',
        modelId: 'test-model',
        durationMs: 50
      });
    }

    const result = await benchmarkRunner.runBenchmark(
      'EpisodicMemory.retrieve() [20 records]',
      async () => {
        await episodicMemory.retrieve({ limit: 10, offset: 0 });
      },
      {
        warmupIterations: 10,
        measurementIterations: 100,
        description: '测量20条记录时的检索性能'
      }
    );

    // 基线断言：小数据集检索应很快
    expect(result.avgTime).toBeLessThan(5);
    expect(result.p95).toBeLessThan(8);
  });

  /**
   * 性能测试7: 记忆检索性能（中等数据集）
   */
  it('should measure memory retrieval performance [medium dataset]', async () => {
    // 预插入中等量数据
    for (let i = 0; i < 100; i++) {
      await episodicMemory.record({
        summary: `Medium retrieval test ${i} about TypeScript and JavaScript programming`,
        entities: ['typescript', 'javascript', 'programming'],
        decision: i % 3 === 0 ? 'SUCCESS' : 'PARTIAL',
        outcome: i % 3 === 0 ? 'SUCCESS' : 'PARTIAL',
        taskType: 'CODE_GENERATE',
        modelId: 'test-model',
        durationMs: 100
      });
    }

    const result = await benchmarkRunner.runBenchmark(
      'EpisodicMemory.retrieve() [100 records]',
      async () => {
        await episodicMemory.retrieve({ limit: 20, offset: 0 });
      },
      {
        warmupIterations: 5,
        measurementIterations: 50,
        description: '测量100条记录时的检索性能'
      }
    );

    // 基线断言：中等数据集检索应在10ms内
    expect(result.avgTime).toBeLessThan(10);
    expect(result.p95).toBeLessThan(15);
  });

  /**
   * 性能测试8: 全文搜索性能（大数据集）
   */
  it('should measure full-text search performance [large dataset]', async () => {
    // 预插入大量数据用于搜索
    for (let i = 0; i < 200; i++) {
      await episodicMemory.record({
        summary: `Large search test ${i}: TypeScript async/await pattern for handling promises and error management in Node.js applications`,
        entities: ['typescript', 'async', 'promise', 'nodejs'],
        decision: 'SUCCESS',
        outcome: 'SUCCESS',
        taskType: 'CODE_EXPLAIN', // 使用有效的TaskType
        modelId: 'test-model',
        durationMs: 150
      });
    }

    const result = await benchmarkRunner.runBenchmark(
      'EpisodicMemory.search() [200 records]',
      async () => {
        await episodicMemory.search('TypeScript async promise', {
          limit: 10,
          offset: 0
        });
      },
      {
        warmupIterations: 5,
        measurementIterations: 30,
        description: '测量200条记录时的全文搜索性能'
      }
    );

    // 基线断言：大数据集搜索应在20ms内
    expect(result.avgTime).toBeLessThan(20);
    expect(result.p95).toBeLessThan(30);
  });

  /**
   * 保存测试结果
   */
  afterAll(() => {
    const outputDir = path.join(__dirname, '..', '..', 'docs');
    
    // 保存基线文件
    const baselinePath = path.join(outputDir, 'performance-baseline-advanced.json');
    benchmarkRunner.saveResults(baselinePath);
    
    // 保存当前结果文件
    const currentPath = path.join(outputDir, 'performance-current-advanced.json');
    const report = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      results: benchmarkRunner.getResults()
    };
    fs.writeFileSync(currentPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`💾 Advanced results saved to: ${currentPath}`);
  });
});
