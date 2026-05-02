# 小尾巴项目文档合并与归档计划

**日期**: 2026-05-03  
**执行者**: AI 助手  
**状态**: 📋 待执行

---

## 🎯 目标

1. **精简文档数量**：将重复、过时的文档合并或归档
2. **保持核心文档最新**：确保核心架构文档反映当前实现状态
3. **建立清晰的文档层次**：核心文档 vs 报告文档 vs 归档文档

---

## 📊 当前文档分析

### 架构类文档（可能重复）

| 文件名 | 大小 | 最后更新 | 状态 | 建议 |
|--------|------|---------|------|------|
| `architecture-constraints.md` | 13.3KB | ? | ✅ 核心 | 保留 |
| `ARCHITECTURE_CHARTER.md` | 11.5KB | ? | ⚠️ 待查 | 可能与 constraints 重复 |
| `ARCHITECTURE_COMPLIANCE_REPORT.md` | 14.0KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |
| `ARCHITECTURE_OPTIMIZATION_REPORT_2026-04-22.md` | 11.3KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |
| `CORTEX_ARCHITECTURE_CODEX.md` | 25.1KB | ? | ⚠️ 待查 | 可能与 INTENT_DRIVEN 重复 |
| `INTENT_DRIVEN_ARCHITECTURE.md` | 64.0KB | ? | ✅ 核心 | 保留并更新 |
| `MEMORY_DRIVEN_ARCHITECTURE.md` | 77.2KB | ? | ✅ 核心 | 保留并更新 |

### 代码质量类文档（可能重复）

| 文件名 | 大小 | 最后更新 | 状态 | 建议 |
|--------|------|---------|------|------|
| `CODE_STANDARDS_REPORT.md` | 14.7KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |
| `CODE_QUALITY_IMPROVEMENT_2026-04-22.md` | 7.3KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |
| `CODE_REVIEW_REPORT_2026-04-22.md` | 7.5KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |

### 测试类文档

| 文件名 | 大小 | 最后更新 | 状态 | 建议 |
|--------|------|---------|------|------|
| `FUNCTIONAL_TEST_CHECKLIST.md` | 19.8KB | ? | ✅ 核心 | 保留 |
| `MANUAL_TESTING.md` | 19.0KB | ? | ✅ 核心 | 保留 |
| `TEST_COVERAGE_REPORT_2026-04-22.md` | 6.4KB | 2026-04-22 | 📊 报告 | 归档到 archive/2026-04-22 |

### 变更日志

| 文件名 | 状态 | 建议 |
|--------|------|------|
| `CHANGELOG_2026-04-22.md` | 已存在 | 归档到 archive/2026-04-22 |
| `CHANGELOG_2026-04-24.md` | 已存在 | 归档到 archive/2026-04-24 |

---

## 🔄 合并与归档计划

### 第一阶段：检查内容重复性

1. **对比 ARCHITECTURE_CHARTER.md 与 architecture-constraints.md**
   - 如果内容重叠 > 70%，合并到 architecture-constraints.md
   - 否则保留两者，但明确各自定位

2. **对比 CORTEX_ARCHITECTURE_CODEX.md 与 INTENT_DRIVEN_ARCHITECTURE.md**
   - CodeX 可能是更详细的规范版本
   - 如果 INTENT_DRIVEN 已包含所有核心内容，归档 CodeX

### 第二阶段：归档报告类文档

将所有带日期的报告文档移动到对应的 archive 目录：

```bash
# 2026-04-22 的报告
docs/ARCHITECTURE_COMPLIANCE_REPORT.md → docs/archive/2026-04-22/
docs/ARCHITECTURE_OPTIMIZATION_REPORT_2026-04-22.md → docs/archive/2026-04-22/
docs/CODE_STANDARDS_REPORT.md → docs/archive/2026-04-22/
docs/CODE_QUALITY_IMPROVEMENT_2026-04-22.md → docs/archive/2026-04-22/
docs/CODE_REVIEW_REPORT_2026-04-22.md → docs/archive/2026-04-22/
docs/TEST_COVERAGE_REPORT_2026-04-22.md → docs/archive/2026-04-22/
docs/CHANGELOG_2026-04-22.md → docs/archive/2026-04-22/

# 2026-04-24 的变更日志
docs/CHANGELOG_2026-04-24.md → docs/archive/2026-04-24/
```

### 第三阶段：更新核心文档

需要更新的核心文档列表：

1. **PROGRESS.md** - 添加 2026-05-03 的最新进展
2. **INTENT_DRIVEN_ARCHITECTURE.md** - 同步最近的架构变更
3. **MEMORY_DRIVEN_ARCHITECTURE.md** - 确认记忆系统实现状态
4. **DOCUMENT_STATUS_OVERVIEW.md** - 更新为 2026-05-03
5. **README.md** - 确认项目概述准确

### 第四阶段：创建新的变更日志

创建 `CHANGELOG_2026-05-03.md`，记录本次文档整理工作。

---

## ✅ 执行清单

### 待确认事项

- [ ] 检查 ARCHITECTURE_CHARTER.md 与 architecture-constraints.md 的内容重复度
- [ ] 检查 CORTEX_ARCHITECTURE_CODEX.md 是否需要保留
- [ ] 确认哪些文档是"核心文档"必须保留在根目录
- [ ] 确认哪些文档是"报告文档"可以归档

### 待执行操作

- [ ] 移动 6 份 2026-04-22 报告到 archive/2026-04-22/
- [ ] 移动 2 份变更日志到对应 archive 目录
- [ ] 更新 PROGRESS.md（添加 2026-05-03 条目）
- [ ] 更新 DOCUMENT_STATUS_OVERVIEW.md（更新日期和统计）
- [ ] 创建 CHANGELOG_2026-05-03.md
- [ ] 提交所有更改

---

## 📝 注意事项

1. **区分 Cortex 和小尾巴**：
   - `cortex/` 目录是独立的 Python 项目（已暂停）
   - `docs/` 目录是小尾巴项目的文档
   - 不要混淆两者的文档

2. **保留历史价值**：
   - 归档不是删除，所有文档都移到 archive/
   - archive/ 目录按日期组织，便于追溯

3. **核心文档不可归档**：
   - CORE_PRINCIPLES.md
   - INTENT_DRIVEN_ARCHITECTURE.md
   - MEMORY_DRIVEN_ARCHITECTURE.md
   - REQUIREMENTS.md
   - ROADMAP_550W.md
   - architecture-constraints.md
   - PROGRESS.md
   - FUNCTIONAL_TEST_CHECKLIST.md
   - MANUAL_TESTING.md
   - ISSUES.md

---

**下一步**：等待用户确认后执行归档操作
