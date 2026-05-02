#!/usr/bin/env node

/**
 * Cortex 架构法典合规性检查脚本
 *
 * 用法:
 *   node scripts/check-architecture-compliance.js
 *
 * 退出码:
 *   0 - 完全合规
 *   1 - 发现违规
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// 检查结果统计
const results = {
  passed: [],
  warnings: [],
  errors: []
};

/**
 * 检查规则 DEP-001: Application 层不能依赖 Infrastructure
 */
function checkDEP001() {
  console.log('\n' + colorize('📋 检查 DEP-001: Application → Infrastructure 依赖', 'cyan'));

  try {
    const result = execSync(
      'grep -r "from.*infrastructure" src/core/application/ 2>/dev/null || true',
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    if (result.trim()) {
      results.errors.push({
        rule: 'DEP-001',
        message: 'Application 层发现了 Infrastructure 导入',
        details: result
      });
      console.log(colorize('  ❌ 失败', 'red'));
      console.log(result);
    } else {
      results.passed.push('DEP-001');
      console.log(colorize('  ✅ 通过', 'green'));
    }
  } catch (error) {
    results.warnings.push({
      rule: 'DEP-001',
      message: '检查执行失败',
      details: error.message
    });
    console.log(colorize('  ⚠️  警告', 'yellow'));
  }
}

/**
 * 检查规则 DEP-002: Infrastructure 不能反向依赖 Application
 */
function checkDEP002() {
  console.log('\n' + colorize('📋 检查 DEP-002: Infrastructure → Application 依赖', 'cyan'));

  try {
    const result = execSync(
      'grep -r "from.*application" src/infrastructure/ 2>/dev/null || true',
      { encoding: 'utf-8', cwd: process.cwd() }
    );

    // 排除 adapters 目录（允许导入端口）
    const filtered = result.split('\n')
      .filter(line => line && !line.includes('adapters'))
      .join('\n');

    if (filtered.trim()) {
      results.errors.push({
        rule: 'DEP-002',
        message: 'Infrastructure 层发现了 Application 导入',
        details: filtered
      });
      console.log(colorize('  ❌ 失败', 'red'));
      console.log(filtered);
    } else {
      results.passed.push('DEP-002');
      console.log(colorize('  ✅ 通过', 'green'));
    }
  } catch (error) {
    results.warnings.push({
      rule: 'DEP-002',
      message: '检查执行失败',
      details: error.message
    });
    console.log(colorize('  ⚠️  警告', 'yellow'));
  }
}

/**
 * 检查规则 PORT-001: ports/ 目录必须是纯接口
 */
function checkPORT001() {
  console.log('\n' + colorize('📋 检查 PORT-001: ports/ 目录纯度', 'cyan'));

  const portsDir = path.join(process.cwd(), 'src', 'core', 'ports');

  if (!fs.existsSync(portsDir)) {
    results.errors.push({
      rule: 'PORT-001',
      message: 'ports/ 目录不存在'
    });
    console.log(colorize('  ❌ 失败: 目录不存在', 'red'));
    return;
  }

  const files = fs.readdirSync(portsDir);
  let hasClass = false;

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'index.ts') {
      const content = fs.readFileSync(path.join(portsDir, file), 'utf-8');
      if (content.match(/\bclass\s+\w+/)) {
        hasClass = true;
        results.errors.push({
          rule: 'PORT-001',
          message: `${file} 包含 class 定义`,
          details: content.match(/\bclass\s+\w+/g).join(', ')
        });
      }
    }
  }

  if (hasClass) {
    console.log(colorize('  ❌ 失败', 'red'));
  } else {
    results.passed.push('PORT-001');
    console.log(colorize('  ✅ 通过', 'green'));
  }
}

/**
 * 检查规则 AG-001: Agent 必须声明 supportedIntents
 */
function checkAG001() {
  console.log('\n' + colorize('📋 检查 AG-001: Agent supportedIntents 声明', 'cyan'));

  const agentsDir = path.join(process.cwd(), 'src', 'agents');

  if (!fs.existsSync(agentsDir)) {
    results.errors.push({
      rule: 'AG-001',
      message: 'agents/ 目录不存在'
    });
    console.log(colorize('  ❌ 失败: 目录不存在', 'red'));
    return;
  }

  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  let allPassed = true;

  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');

    // 检查是否实现 IAgent 接口
    if (content.includes('implements IAgent') || content.includes('extends AutonomousAgent')) {
      // 检查是否有 supportedIntents
      if (!content.includes('supportedIntents')) {
        allPassed = false;
        results.errors.push({
          rule: 'AG-001',
          message: `${file} 缺少 supportedIntents 声明`
        });
      }
    }
  }

  if (allPassed) {
    results.passed.push('AG-001');
    console.log(colorize('  ✅ 通过', 'green'));
  } else {
    console.log(colorize('  ❌ 失败', 'red'));
  }
}

/**
 * 检查规则 SEC-005: 审计日志使用
 */
function checkSEC005() {
  console.log('\n' + colorize('📋 检查 SEC-005: 审计日志集成', 'cyan'));

  try {
    // 检查 AuditLogger 是否存在
    const auditLoggerPath = path.join(process.cwd(), 'src', 'core', 'security', 'AuditLogger.ts');

    if (!fs.existsSync(auditLoggerPath)) {
      results.errors.push({
        rule: 'SEC-005',
        message: 'AuditLogger.ts 不存在'
      });
      console.log(colorize('  ❌ 失败: 文件不存在', 'red'));
      return;
    }

    // 检查关键模块是否使用审计日志
    const agentsDir = path.join(process.cwd(), 'src', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    let auditedCount = 0;
    for (const file of files) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      if (content.includes('AuditLogger') || content.includes('auditLogger')) {
        auditedCount++;
      }
    }

    if (auditedCount > 0) {
      results.passed.push('SEC-005');
      console.log(colorize(`  ✅ 通过 (${auditedCount}/${files.length} Agents 使用审计日志)`, 'green'));
    } else {
      results.warnings.push({
        rule: 'SEC-005',
        message: '没有 Agent 使用审计日志'
      });
      console.log(colorize('  ⚠️  警告', 'yellow'));
    }
  } catch (error) {
    results.warnings.push({
      rule: 'SEC-005',
      message: '检查执行失败',
      details: error.message
    });
    console.log(colorize('  ⚠️  警告', 'yellow'));
  }
}

/**
 * 检查测试覆盖率
 */
function checkTEST001() {
  console.log('\n' + colorize('📋 检查 TEST-001: 测试文件存在性', 'cyan'));

  const testsDir = path.join(process.cwd(), 'tests');

  if (!fs.existsSync(testsDir)) {
    results.errors.push({
      rule: 'TEST-001',
      message: 'tests/ 目录不存在'
    });
    console.log(colorize('  ❌ 失败: 目录不存在', 'red'));
    return;
  }

  // 统计测试文件数量
  const testFiles = [];
  function countTestFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        countTestFiles(filePath);
      } else if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
        testFiles.push(filePath);
      }
    }
  }

  countTestFiles(testsDir);

  if (testFiles.length >= 10) {
    results.passed.push('TEST-001');
    console.log(colorize(`  ✅ 通过 (${testFiles.length} 个测试文件)`, 'green'));
  } else {
    results.warnings.push({
      rule: 'TEST-001',
      message: `测试文件数量不足 (${testFiles.length} < 10)`
    });
    console.log(colorize(`  ⚠️  警告`, 'yellow'));
  }
}

/**
 * 打印总结报告
 */
function printSummary() {
  console.log('\n' + colorize('=' .repeat(60), 'bold'));
  console.log(colorize('📊 Cortex 架构法典合规性检查报告', 'bold'));
  console.log(colorize('=' .repeat(60), 'bold'));

  console.log('\n' + colorize('✅ 通过的规则:', 'green'));
  if (results.passed.length === 0) {
    console.log('  (无)');
  } else {
    results.passed.forEach(rule => {
      console.log(`  ✓ ${rule}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log('\n' + colorize('⚠️  警告:', 'yellow'));
    results.warnings.forEach(warning => {
      console.log(`  ⚠ ${warning.rule}: ${warning.message}`);
      if (warning.details) {
        console.log(`    ${warning.details}`);
      }
    });
  }

  if (results.errors.length > 0) {
    console.log('\n' + colorize('❌ 错误:', 'red'));
    results.errors.forEach(error => {
      console.log(`  ✗ ${error.rule}: ${error.message}`);
      if (error.details) {
        console.log(`    ${error.details}`);
      }
    });
  }

  console.log('\n' + colorize('-'.repeat(60), 'bold'));

  const totalChecks = results.passed.length + results.warnings.length + results.errors.length;
  const passRate = totalChecks > 0 ? ((results.passed.length / totalChecks) * 100).toFixed(1) : 0;

  console.log(`总检查数: ${totalChecks}`);
  console.log(`通过: ${results.passed.length}`);
  console.log(`警告: ${results.warnings.length}`);
  console.log(`错误: ${results.errors.length}`);
  console.log(`通过率: ${colorize(`${passRate}%`, passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red')}`);

  console.log('\n' + colorize('=' .repeat(60), 'bold'));

  if (results.errors.length > 0) {
    console.log(colorize('\n❌ 检查失败: 发现架构违规，请修复后重新提交', 'red'));
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log(colorize('\n⚠️  检查通过但有警告: 建议修复警告项', 'yellow'));
    process.exit(0);
  } else {
    console.log(colorize('\n✅ 检查通过: 所有规则均符合 Cortex 架构法典', 'green'));
    process.exit(0);
  }
}

// 主函数
async function main() {
  console.log(colorize('🔍 开始 Cortex 架构法典合规性检查...', 'bold'));
  console.log(colorize(`工作目录: ${process.cwd()}`, 'blue'));

  // 执行所有检查
  checkDEP001();
  checkDEP002();
  checkPORT001();
  checkAG001();
  checkSEC005();
  checkTEST001();

  // 打印总结
  printSummary();
}

main().catch(error => {
  console.error(colorize('💥 检查过程出错:', 'red'), error);
  process.exit(1);
});
