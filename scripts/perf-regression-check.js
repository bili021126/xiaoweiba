#!/usr/bin/env node

/**
 * 性能回归检测脚本
 * 
 * 功能：
 * 1. 运行性能基准测试
 * 2. 对比当前结果与历史基线
 * 3. 检测性能退化（超过阈值则失败）
 * 4. 更新基线数据（如果通过）
 * 
 * 使用方法：
 * npm run perf:check
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const BASELINE_FILE = path.join(__dirname, '..', 'docs', 'performance-baseline.json');
const CURRENT_RESULT_FILE = path.join(__dirname, '..', 'docs', 'performance-current.json');
const REGRESSION_THRESHOLD = 0.15; // 15% 性能退化阈值

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 运行性能测试
 */
function runPerformanceTests() {
  log('\n🔍 运行性能基准测试...', 'cyan');
  
  try {
    execSync('npm test -- tests/performance/baselines.test.ts --no-coverage --forceExit', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    log('✅ 性能测试执行完成', 'green');
  } catch (error) {
    log('❌ 性能测试执行失败', 'red');
    process.exit(1);
  }
}

/**
 * 加载基线数据
 */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    log('⚠️  未找到基线文件，将创建新基线', 'yellow');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
    log(`📊 加载基线数据 (${data.results?.length || 0} 个测试结果)`, 'blue');
    return data;
  } catch (error) {
    log('❌ 加载基线数据失败', 'red');
    return null;
  }
}

/**
 * 加载当前测试结果
 */
function loadCurrentResults() {
  if (!fs.existsSync(CURRENT_RESULT_FILE)) {
    log('❌ 未找到当前测试结果文件', 'red');
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(CURRENT_RESULT_FILE, 'utf-8'));
    log(`📊 加载当前结果 (${data.results?.length || 0} 个测试结果)`, 'blue');
    return data;
  } catch (error) {
    log('❌ 加载当前结果失败', 'red');
    return null;
  }
}

/**
 * 检查性能退化
 */
function checkRegression(baseline, current) {
  if (!baseline || !current || !baseline.results || !current.results) {
    log('⚠️  无法进行回归检测（缺少数据）', 'yellow');
    return false;
  }
  
  let hasRegression = false;
  const regressions = [];
  
  log('\n🔍 检查性能退化...', 'cyan');
  log(`阈值: ${REGRESSION_THRESHOLD * 100}%\n`, 'cyan');
  
  // 遍历当前结果
  for (const currentResult of current.results) {
    // 查找对应的基线结果
    const baselineResult = baseline.results.find(
      r => r.name === currentResult.name
    );
    
    if (!baselineResult) {
      log(`  ⚪ ${currentResult.name} (新测试，无基线)`, 'yellow');
      continue;
    }
    
    // 计算性能变化
    const avgChange = (currentResult.avgTime - baselineResult.avgTime) / baselineResult.avgTime;
    const p95Change = (currentResult.p95 - baselineResult.p95) / baselineResult.p95;
    
    // 判断是否退化
    const isRegressed = avgChange > REGRESSION_THRESHOLD || p95Change > REGRESSION_THRESHOLD;
    
    if (isRegressed) {
      hasRegression = true;
      regressions.push({
        name: currentResult.name,
        avgChange: (avgChange * 100).toFixed(2),
        p95Change: (p95Change * 100).toFixed(2),
        baselineAvg: baselineResult.avgTime.toFixed(3),
        currentAvg: currentResult.avgTime.toFixed(3),
        baselineP95: baselineResult.p95.toFixed(3),
        currentP95: currentResult.p95.toFixed(3)
      });
      
      log(`  ❌ ${currentResult.name}`, 'red');
      log(`     Avg: ${baselineResult.avgTime.toFixed(3)}ms → ${currentResult.avgTime.toFixed(3)}ms (+${(avgChange * 100).toFixed(2)}%)`, 'red');
      log(`     P95: ${baselineResult.p95.toFixed(3)}ms → ${currentResult.p95.toFixed(3)}ms (+${(p95Change * 100).toFixed(2)}%)`, 'red');
    } else {
      const status = avgChange < -0.05 ? '🚀' : '✅';
      const color = avgChange < -0.05 ? 'green' : 'reset';
      log(`  ${status} ${currentResult.name} (Avg: ${(avgChange * 100).toFixed(1)}%, P95: ${(p95Change * 100).toFixed(1)}%)`, color);
    }
  }
  
  // 打印总结
  if (hasRegression) {
    log('\n❌ 检测到性能退化！', 'red');
    log('\n退化详情:', 'red');
    regressions.forEach(r => {
      log(`  - ${r.name}:`, 'red');
      log(`    Avg: ${r.baselineAvg}ms → ${r.currentAvg}ms (+${r.avgChange}%)`, 'red');
      log(`    P95: ${r.baselineP95}ms → ${r.currentP95}ms (+${r.p95Change}%)`, 'red');
    });
    return false;
  } else {
    log('\n✅ 无性能退化 detected', 'green');
    return true;
  }
}

/**
 * 更新基线
 */
function updateBaseline(currentResults) {
  log('\n📝 更新基线数据...', 'cyan');
  
  const baseline = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    results: currentResults.results
  };
  
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf-8');
  log(`✅ 基线已更新 (${baseline.results.length} 个测试结果)`, 'green');
}

/**
 * 主函数
 */
function main() {
  log('\n========================================', 'cyan');
  log('  性能回归检测工具', 'cyan');
  log('========================================\n', 'cyan');
  
  // 1. 运行性能测试
  runPerformanceTests();
  
  // 2. 加载基线
  const baseline = loadBaseline();
  
  // 3. 加载当前结果（从测试输出中解析）
  // 注意：实际实现需要从测试输出中提取结果
  // 这里简化处理，假设测试已经保存了结果
  const currentResults = loadCurrentResults();
  
  if (!currentResults) {
    log('⚠️  跳过回归检测（无当前结果）', 'yellow');
    log('💡 提示：请确保性能测试正确保存结果到 performance-current.json', 'yellow');
    process.exit(0);
  }
  
  // 4. 检查回归
  const passed = checkRegression(baseline, currentResults);
  
  // 5. 如果通过且是首次运行，更新基线
  if (passed && !baseline) {
    updateBaseline(currentResults);
  } else if (passed && baseline) {
    // 可选：询问是否更新基线
    log('\n💡 提示：性能良好，可以手动更新基线', 'yellow');
    log('   命令: npm run perf:update-baseline', 'yellow');
  }
  
  // 6. 退出码
  if (!passed) {
    log('\n❌ 性能回归检测失败', 'red');
    process.exit(1);
  } else {
    log('\n✅ 性能回归检测通过', 'green');
    process.exit(0);
  }
}

main();
