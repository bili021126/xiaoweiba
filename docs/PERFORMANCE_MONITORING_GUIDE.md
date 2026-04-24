# 性能监控指南

**最后更新**: 2026-04-22  
**版本**: v1.0

---

## 📊 概述

小尾巴项目已建立完整的性能监控体系，包括：

1. **性能基准测试** - 7 个核心性能指标
2. **回归检测工具** - 自动化性能退化检测
3. **CI/CD 集成** - GitHub Actions 自动监控
4. **基线管理** - 版本化性能基线数据

---

## 🚀 快速开始

### 本地运行性能测试

```bash
# 运行性能基准测试
npm run test:performance

# 检查性能回归（对比基线）
npm run perf:check

# 更新性能基线
npm run perf:update-baseline
```

### CI/CD 自动检测

每次 Push 或 Pull Request 时，GitHub Actions 会自动：

1. ✅ 运行性能测试
2. 🔍 检测性能退化
3. 📊 在 PR 中评论测试结果
4. 💾 上传性能数据作为 Artifact

---

## 📈 性能基线指标

### 当前基线 (2026-04-22)

| 测试项 | 平均耗时 | P95 | Ops/sec | 状态 |
|--------|---------|-----|---------|------|
| **Config loading** | ~0.15ms | <0.2ms | ~6,400 | ✅ 优秀 |
| **Database write** | ~4.5ms | <6ms | ~220 | ✅ 良好 |
| **Database query** | ~1.3ms | <2ms | ~770 | ✅ 优秀 |
| **Full-text search** | ~2.7ms | <4ms | ~370 | ✅ 良好 |
| **Audit logging** | ~0.14ms | <0.2ms | ~7,000 | ✅ 优秀 |
| **Project fingerprint** | ~0.003ms | <0.005ms | ~334K | ✅ 极快(缓存) |
| **Batch write (50条)** | ~207ms | <228ms | ~4.8批次/s | ✅ 可接受 |

### 性能退化阈值

- **警告阈值**: 10% 性能下降
- **失败阈值**: 15% 性能下降
- **优化目标**: 5% 性能提升

---

## 🔧 工具说明

### 1. 性能测试框架 (`tests/performance/benchmark.ts`)

**功能**:
- 高精度计时 (`perf_hooks.performance.now()`)
- Warmup 阶段消除 JIT 影响
- 统计 P50/P90/P95/P99 百分位数
- 自动保存结果到 JSON

**使用示例**:
```typescript
const runner = createBenchmarkRunner();

const result = await runner.runBenchmark(
  'MyOperation',
  async () => {
    // 要测试的操作
    await myFunction();
  },
  {
    warmupIterations: 10,
    measurementIterations: 100,
    description: '测试描述'
  }
);

console.log(`Avg: ${result.avgTime}ms, P95: ${result.p95}ms`);
```

### 2. 回归检测脚本 (`scripts/perf-regression-check.js`)

**功能**:
- 运行性能测试
- 加载历史基线
- 对比当前结果与基线
- 检测性能退化
- 生成详细报告

**退出码**:
- `0`: 通过（无退化或退化 < 15%）
- `1`: 失败（检测到显著退化）

### 3. GitHub Actions Workflow (`.github/workflows/perf-regression.yml`)

**触发条件**:
- Push 到 `dev` 或 `main` 分支
- Pull Request 到 `dev` 或 `main` 分支

**执行步骤**:
1. Checkout 代码
2. 安装依赖
3. 编译 TypeScript
4. 运行性能测试
5. 检查性能回归
6. 上传测试结果
7. 在 PR 中评论结果

---

## 📝 工作流程

### 日常开发

```bash
# 1. 开发完成后运行性能测试
npm run test:performance

# 2. 检查是否有性能退化
npm run perf:check

# 3. 如果性能良好，可选更新基线
npm run perf:update-baseline
```

### 提交 PR 前

```bash
# 确保性能测试通过
npm run perf:check

# 如果有退化，分析原因并优化
# 或者记录退化原因（如新功能必需的性能权衡）
```

### 发布新版本前

```bash
# 1. 运行完整性能测试套件
npm run test:performance

# 2. 检查回归
npm run perf:check

# 3. 更新基线（如果性能有显著提升）
npm run perf:update-baseline

# 4. 提交新的基线文件
git add docs/performance-baseline.json
git commit -m "chore: update performance baseline for v0.3.2"
```

---

## 🔍 故障排查

### 问题 1: 性能测试失败

**症状**: `npm run test:performance` 失败

**可能原因**:
1. Mock 配置不完整
2. 依赖注入失败
3. 数据库初始化错误

**解决方案**:
```bash
# 查看详细错误信息
npm run test:performance -- --verbose

# 清理 Jest 缓存
npx jest --clearCache

# 重新运行
npm run test:performance
```

### 问题 2: 回归检测误报

**症状**: 检测到退化但实际性能正常

**可能原因**:
1. 系统负载波动
2. JIT 编译未完成
3. 垃圾回收干扰

**解决方案**:
```bash
# 多次运行取平均值
for i in {1..3}; do npm run perf:check; done

# 增加 warmup 次数（修改 baselines.test.ts）
warmupIterations: 20  # 从 10 增加到 20

# 在空闲系统上运行
```

### 问题 3: 基线文件丢失

**症状**: `performance-baseline.json` 不存在

**解决方案**:
```bash
# 首次运行会创建基线
npm run test:performance

# 手动创建基线
npm run perf:update-baseline
```

---

## 📊 数据分析

### 查看历史趋势

```bash
# 查看基线文件
cat docs/performance-baseline.json | jq '.results[] | {name, avgTime, p95}'

# 对比两次测试
diff <(cat docs/performance-baseline.json | jq '.results') \
     <(cat docs/performance-current.json | jq '.results')
```

### 可视化性能数据

可以使用以下工具可视化性能趋势：

1. **GitHub Insights** - 查看 Artifact 中的历史数据
2. **自定义脚本** - 解析 JSON 并生成图表
3. **第三方服务** - 如 Grafana、DataDog

---

## 🎯 最佳实践

### 1. 定期更新基线

- **频率**: 每月或每个大版本
- **条件**: 性能有显著提升或架构重大变更
- **流程**: 
  ```bash
  npm run perf:check          # 确认性能良好
  npm run perf:update-baseline # 更新基线
  git add docs/performance-baseline.json
  git commit -m "chore: update performance baseline"
  ```

### 2. 处理性能退化

**步骤**:
1. **确认退化**: 多次运行排除偶然因素
2. **定位原因**: 使用 profiler 分析热点
3. **优化代码**: 针对性优化
4. **记录决策**: 如果退化是必要的，记录原因

**示例**:
```markdown
## 性能退化说明

**测试项**: Database write  
**退化幅度**: +18% (4.5ms → 5.3ms)  
**原因**: 新增向量索引更新逻辑  
**决策**: 接受退化，换取 L2 语义检索能力  
**缓解措施**: 异步更新索引，不阻塞主流程
```

### 3. 添加新性能测试

**何时添加**:
- 新增关键路径
- 重构核心模块
- 引入新的性能敏感操作

**如何添加**:
```typescript
it('should measure new operation performance', async () => {
  const result = await benchmarkRunner.runBenchmark(
    'NewOperation',
    async () => {
      await newOperation();
    },
    {
      warmupIterations: 10,
      measurementIterations: 100,
      description: '新操作性能测试'
    }
  );

  expect(result.avgTime).toBeLessThan(THRESHOLD);
});
```

---

## 📚 相关文件

- **测试文件**: `tests/performance/baselines.test.ts`
- **测试框架**: `tests/performance/benchmark.ts`
- **回归检测**: `scripts/perf-regression-check.js`
- **CI/CD**: `.github/workflows/perf-regression.yml`
- **基线数据**: `docs/performance-baseline.json`
- **当前结果**: `docs/performance-current.json`

---

## 🤝 贡献指南

### 提交性能改进

1. 运行性能测试记录基线
2. 实施优化
3. 再次运行测试验证改进
4. 在 PR 中附上性能对比数据

### 报告性能问题

1. 运行 `npm run perf:check` 确认退化
2. 使用 profiler 定位瓶颈
3. 创建 Issue 并附上性能数据
4. 提出优化建议（可选）

---

**维护者**: 小尾巴开发团队  
**反馈渠道**: GitHub Issues
