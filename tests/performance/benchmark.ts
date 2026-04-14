/**
 * 性能基准测试框架
 * 用于测量和跟踪关键操作的执行时间
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number; // ms
  avgTime: number; // ms
  minTime: number; // ms
  maxTime: number; // ms
  p50: number; // ms
  p90: number; // ms
  p95: number; // ms
  p99: number; // ms
  opsPerSecond: number;
  timestamp: string;
}

export interface BenchmarkOptions {
  warmupIterations?: number;
  measurementIterations: number;
  description?: string;
}

export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  /**
   * 运行基准测试
   */
  async runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    options: BenchmarkOptions
  ): Promise<BenchmarkResult> {
    const warmupIterations = options.warmupIterations ?? Math.floor(options.measurementIterations * 0.1);
    const measurementIterations = options.measurementIterations;

    console.log(`\n🔍 Running benchmark: ${name}`);
    console.log(`   Warmup: ${warmupIterations} iterations`);
    console.log(`   Measurements: ${measurementIterations} iterations`);

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Measurement phase
    const times: number[] = [];
    for (let i = 0; i < measurementIterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    // Calculate statistics
    const result = this.calculateStatistics(name, times, measurementIterations);
    this.results.push(result);

    // Print results
    this.printResult(result);

    return result;
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(
    name: string,
    times: number[],
    iterations: number
  ): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b);
    const totalTime = times.reduce((sum, t) => sum + t, 0);
    const avgTime = totalTime / iterations;
    const minTime = sorted[0];
    const maxTime = sorted[sorted.length - 1];

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      name,
      iterations,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      opsPerSecond: 1000 / avgTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 打印测试结果
   */
  private printResult(result: BenchmarkResult): void {
    console.log(`\n📊 Results for: ${result.name}`);
    console.log(`   Iterations: ${result.iterations}`);
    console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
    console.log(`   Avg Time: ${result.avgTime.toFixed(3)}ms`);
    console.log(`   Min Time: ${result.minTime.toFixed(3)}ms`);
    console.log(`   Max Time: ${result.maxTime.toFixed(3)}ms`);
    console.log(`   P50: ${result.p50.toFixed(3)}ms`);
    console.log(`   P90: ${result.p90.toFixed(3)}ms`);
    console.log(`   P95: ${result.p95.toFixed(3)}ms`);
    console.log(`   P99: ${result.p99.toFixed(3)}ms`);
    console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
  }

  /**
   * 保存结果到文件
   */
  saveResults(outputPath: string): void {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      results: this.results
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n💾 Results saved to: ${outputPath}`);
  }

  /**
   * 获取所有结果
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * 清除结果
   */
  clearResults(): void {
    this.results = [];
  }
}

/**
 * 创建基准测试运行器
 */
export function createBenchmarkRunner(): BenchmarkRunner {
  return new BenchmarkRunner();
}
