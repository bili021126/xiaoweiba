# 文档归档说明

**最后更新**: 2026-04-18  
**维护者**: 小尾巴团队

---

## 📁 归档策略

### 原则

1. **单一真理来源（Single Source of Truth）**：每个主题只保留一份最新、最完整的文档
2. **历史可追溯**：归档的文档保留在`archive/`目录，供查阅历史设计决策
3. **避免重复维护**：整合后的文档作为权威参考，旧文档不再更新

### 目录结构

```
docs/
├── MEMORY_DRIVEN_ARCHITECTURE_DESIGN.md  ← 主架构文档（v4.0）
├── REQUIREMENTS.md                        ← 需求文档（持续更新）
├── PROGRESS.md                            ← 进度跟踪（持续更新）
├── ISSUES.md                              ← 问题记录（持续更新）
├── MANUAL_TESTING.md                      ← 人工测试清单（持续更新）
├── archive/                               ← 归档文档
│   ├── 2026-04-17/                        ← 按日期归档
│   │   ├── MEMORY_AS_BRAIN_ARCHITECTURE.md
│   │   ├── ARCHITECTURE_EVOLUTION.md
│   │   ├── HEXAGONAL_MICROKERNEL_EVENTBUS.md
│   │   ├── MEMORY_RETRIEVAL_IMPLEMENTATION.md
│   │   └── INTENT_AWARE_RETRIEVAL.md
│   └── IMPLEMENTATION-PROGRESS.md         ← 早期实施报告
└── README.md                              ← 本文档
```

---

## 📚 主文档清单

### 核心文档（必须保持最新）

| 文档 | 路径 | 用途 | 更新频率 |
|------|------|------|---------|
| **记忆驱动架构设计** | `MEMORY_DRIVEN_ARCHITECTURE_DESIGN.md` | 完整架构蓝图（v4.0） | 重大变更时 |
| **需求架构** | `REQUIREMENTS.md` | 功能需求清单 | 新增功能时 |
| **进度跟踪** | `PROGRESS.md` | 实时进度、测试覆盖率 | 每日/每周 |
| **问题记录** | `ISSUES.md` | Bug与改进项 | 发现问题时 |
| **人工测试** | `MANUAL_TESTING.md` | 57个测试用例 | 发布前 |

### 归档文档（仅供参考）

| 文档 | 归档位置 | 原用途 | 替代文档 |
|------|---------|--------|----------|
| CODE_REVIEW_DATA_IO_2026-04-18.md | `archive/2026-04-18/` | 数据读写安全深度评审 | PROGRESS.md §4, ISSUES.md |
| BUGFIX_DUPLICATE_TASK_COMPLETED_2026-04-18.md | `archive/2026-04-18/` | TASK_COMPLETED重复发布修复 | PROGRESS.md §4 |
| FEATURE_MEMORY_EXTERNALIZATION_2026-04-18.md | `archive/2026-04-18/` | 记忆外化功能实现 | PROGRESS.md §4 |
| FIX_MEMORY_DATA_QUALITY_2026-04-18.md | `archive/2026-04-18/` | 记忆数据质量修复方案 | PROGRESS.md §4 |
| CODE_REVIEW_REPORT_*.md | `archive/2026-04-18/` | 代码评审报告系列 | PROGRESS.md §4, ISSUES.md |
| COMMANDS_DECOUPLING_PROGRESS.md | `archive/2026-04-18/` | Commands解耦进度 | PROGRESS.md §4 |
| COMPREHENSIVE_CODE_REVIEW_2026-04-18.md | `archive/2026-04-18/` | 综合代码评审 | PROGRESS.md §4 |
| TECHNICAL_DEBT_PAYDOWN_PROGRESS.md | `archive/2026-04-18/` | 技术债务偿还进度 | PROGRESS.md §4 |
| MEMORY_AS_BRAIN_ARCHITECTURE.md | `archive/2026-04-17/` | v4.0记忆大脑设计 | MEMORY_DRIVEN_ARCHITECTURE.md |
| ARCHITECTURE_EVOLUTION.md | `archive/2026-04-17/` | v3.0架构演进 | MEMORY_DRIVEN_ARCHITECTURE.md |
| HEXAGONAL_MICROKERNEL_EVENTBUS.md | `archive/2026-04-17/` | 六边形架构详细设计 | MEMORY_DRIVEN_ARCHITECTURE.md |
| MEMORY_RETRIEVAL_IMPLEMENTATION.md | `archive/2026-04-17/` | 混合检索实施报告 | MEMORY_DRIVEN_ARCHITECTURE.md §5.2 |
| INTENT_AWARE_RETRIEVAL.md | `archive/2026-04-17/` | 意图感知检索设计 | MEMORY_DRIVEN_ARCHITECTURE.md §5.3 |

---

## 🔄 归档流程

### 何时归档？

1. **文档整合**：多个相关文档合并为一个主文档
2. **版本迭代**：旧版设计被新版完全替代
3. **实施完成**：阶段性实施报告已整合到主文档

### 如何归档？

```bash
# 1. 创建归档目录（按日期）
mkdir -p docs/archive/YYYY-MM-DD

# 2. 移动文档到归档目录
git mv docs/OLD_DOC.md docs/archive/YYYY-MM-DD/

# 3. 提交归档操作
git commit -m "docs: 归档XXX文档到archive/YYYY-MM-DD/

原因：已整合到NEW_DOC.md
替代关系：OLD_DOC → NEW_DOC §X.X"

# 4. 更新主文档的引用（如有）
# 在NEW_DOC.md中添加指向归档文档的链接
```

### 归档检查清单

- [ ] 确认新文档已包含旧文档的所有关键内容
- [ ] 在新文档中添加指向归档文档的引用链接
- [ ] 更新相关文档的"关联文档"章节
- [ ] 提交清晰的commit message，说明归档原因和替代关系

---

## 📖 如何使用归档文档？

### 场景1：了解历史设计决策

**问题**："为什么选择混合检索而不是纯向量检索？"

**步骤**：
1. 查看主文档 `MEMORY_DRIVEN_ARCHITECTURE_DESIGN.md` §5.2
2. 如需更多细节，查阅归档文档 `archive/2026-04-17/MEMORY_RETRIEVAL_IMPLEMENTATION.md`

### 场景2：追溯架构演进

**问题**："小尾巴的架构是如何从v1.0演进到v4.0的？"

**步骤**：
1. 阅读主文档 §10 实施路线图
2. 查阅归档文档：
   - `archive/IMPLEMENTATION-PROGRESS.md` (v0.2.1)
   - `archive/2026-04-17/ARCHITECTURE_EVOLUTION.md` (v3.0)
   - `archive/2026-04-17/MEMORY_AS_BRAIN_ARCHITECTURE.md` (v4.0)

### 场景3：恢复旧设计

**问题**："我想看看之前的FTS5实现细节"

**步骤**：
1. 在归档文档中搜索相关关键词
2. 如需恢复代码，结合Git历史查看当时的实现

---

## ⚠️ 注意事项

### 不要做什么

❌ **不要删除归档文档**：即使已整合，也要保留历史记录  
❌ **不要修改归档文档**：归档文档是历史快照，不应再更新  
❌ **不要在主文档中复制归档内容**：应通过引用链接关联  

### 应该做什么

✅ **保持主文档最新**：所有新设计都应更新到主文档  
✅ **清晰标注替代关系**：在主文档中说明哪些内容来自归档文档  
✅ **定期清理过时引用**：移除指向不存在文档的链接  

---

## 📊 文档统计

| 类别 | 数量 | 总行数 |
|------|------|--------|
| **主文档** | 5 | ~4,000行 |
| **归档文档** | 23 | ~8,500行 |
| **总计** | 28 | ~12,500行 |

**主文档占比**：32% （符合单一真理来源原则）

---

## 🔗 相关链接

- [主架构文档](./MEMORY_DRIVEN_ARCHITECTURE_DESIGN.md)
- [需求文档](./REQUIREMENTS.md)
- [进度跟踪](./PROGRESS.md)
- [问题记录](./ISSUES.md)
- [人工测试](./MANUAL_TESTING.md)

---

**维护者**: 小尾巴团队  
**最后更新**: 2026-04-18
