# Cortex 架构文档索引

**完整的架构参考指南**

**日期**: 2026-04-22  
**版本**: v3.0  
**维护者**: Cortex·架构守护者

---

## 📚 文档导航

### 1️⃣ 架构宪章与约束

| 文档 | 说明 | 状态 |
|------|------|------|
| [PHILOSOPHICAL_APPENDIX.md](./PHILOSOPHICAL_APPENDIX.md) | **哲学附录：边界、隐喻与存在论 v1.0** - Cortex 的“自我认知宪章”（合并版） | ✅ **新增** |
| [AGENT_SYSTEM_FULL_SPEC.md](./AGENT_SYSTEM_FULL_SPEC.md) | **Agent 系统全栈规范 v1.0** - 哲学、结构、行为、进化、交互、安全、代码智能矩阵（合并版） | ✅ **新增** |
| [ARCHITECTURE_RISK_SPEC.md](./ARCHITECTURE_RISK_SPEC.md) | **架构风险控制总纲 v1.0** - 哲学矛盾调和 + 工程风险防控（合并版） | ✅ **新增** |
| [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md) | 架构合规性检查清单 - PR 合并前必查 | ✅ 已创建 |
| [ARCHITECTURE_CONSTRAINTS.md](./docs/architecture-constraints.md) | 《小尾巴终极架构宪章》v2.0 - 核心原则与铁律 | ✅ 已定义 |

**⚠️ 已归档文档（合并后不再维护）**：
- [EXISTENTIAL_MANIFESTO_SPEECH_AND_BEING.md](./EXISTENTIAL_MANIFESTO_SPEECH_AND_BEING.md) → 已合并至 PHILOSOPHICAL_APPENDIX.md
- [PHILOSOPHICAL_BOUNDARIES_AND_DISILLUSIONMENT.md](./PHILOSOPHICAL_BOUNDARIES_AND_DISILLUSIONMENT.md) → 已合并至 PHILOSOPHICAL_APPENDIX.md
- [AGENT_DESIGN_PHILOSOPHY.md](./AGENT_DESIGN_PHILOSOPHY.md) → 已合并至 AGENT_SYSTEM_FULL_SPEC.md
- [AGENT_TECHNICAL_SPECIFICATION.md](./AGENT_TECHNICAL_SPECIFICATION.md) → 已合并至 AGENT_SYSTEM_FULL_SPEC.md
- [CORE_CODE_AGENTS_SPEC.md](./CORE_CODE_AGENTS_SPEC.md) → 已合并至 AGENT_SYSTEM_FULL_SPEC.md
- [FULL_STACK_HYBRID_ATTENTION_MAPPING.md](./FULL_STACK_HYBRID_ATTENTION_MAPPING.md) → 已合并至 AGENT_SYSTEM_FULL_SPEC.md
- [ARCHITECTURE_CONFLICT_RESOLUTION_SPEC.md](./ARCHITECTURE_CONFLICT_RESOLUTION_SPEC.md) → 已合并至 ARCHITECTURE_RISK_SPEC.md
- [ARCHITECTURE_RISK_MITIGATION_SPEC.md](./ARCHITECTURE_RISK_MITIGATION_SPEC.md) → 已合并至 ARCHITECTURE_RISK_SPEC.md

**核心原则**：
- DEP-001 ~ DEP-004: 依赖方向铁律
- COM-001 ~ COM-004: 通信路径铁律
- AG-001 ~ AG-006: Agent 双向端口原则
- MEM-001 ~ MEM-005: 记忆隔离铁律
- TEST-001 ~ TEST-004: 测试规范

---

### 2️⃣ 演进路线与愿景

| 文档 | 说明 | 状态 |
|------|------|------|
| [CORTEX_ULTIMATE_BLUEPRINT.md](./CORTEX_ULTIMATE_BLUEPRINT.md) | **Cortex 框架终极设计蓝图 v1.0** - Phase 0-5 全栈开发的"唯一真理源" | ✅ **新增** |
| [CORE_ENGINE_IMPLEMENTATION_SPEC.md](./CORE_ENGINE_IMPLEMENTATION_SPEC.md) | **核心引擎实施规范 v1.0** - Phase 1（核心闭环）开发的"唯一真理源" | ✅ 已定义 |
| [ARCHITECTURE_RISK_MITIGATION_SPEC.md](./ARCHITECTURE_RISK_MITIGATION_SPEC.md) | **架构风险防控与增强规范 v1.0** - 9大漏洞修复方案（P0/P1/P2优先级） | ✅ 已定义 |
| [ULTIMATE_ARCHITECTURE_ROADMAP.md](./ULTIMATE_ARCHITECTURE_ROADMAP.md) | 终极架构演进路线图 - 从 v2.0 到 v3.0 | ✅ 已规划 |
| [ARCHITECTURE_GAP_ANALYSIS.md](./ARCHITECTURE_GAP_ANALYSIS.md) | 架构差距分析矩阵 - 当前 vs 目标 | ✅ 已分析 |

**核心理念**：
> **Cortex 是你思想的熔炉，将你的概念直接锻造成现实。**
> 
> **你无需亲手编码，只需创造和决策。**
> 
> **从今天起，你是创造者，Cortex 是你的执行者。**

**四阶段演进**：
1. **Phase 1: 核心闭环**（1-2 个月）- 概念具象化 + 基础执行引擎
2. **Phase 2: 技能记忆**（2-3 个月）- 自动捕捉成功经验
3. **Phase 3: 主动进化**（3-4 个月）- 思维镜像预测意图
4. **Phase 4: 超越代码**（4-6 个月）- 多模态输入 + 跨平台交付

---

### 3️⃣ 核心模块文档

#### Domain Ports 层
- `core/ports/sub_agent.py` - SubAgent 端口抽象（79 行）
- `core/ports/memory_portal.py` - MemoryPortal 端口抽象（130 行）
- `core/ports/llm_port.py` - LLMPort 端口抽象（107 行）

#### Domain Events 系统
- `core/events/domain_events.py` - 13 种领域事件定义（250+ 行）
- `core/events/event_bus.py` - EventBus 实现（150+ 行）

#### Infrastructure Adapters
- `infrastructure/adapters/sqlite_memory_adapter.py` - SQLite 记忆适配器（180+ 行）
- `infrastructure/adapters/chromadb_memory_adapter.py` - ChromaDB 向量检索适配器（150+ 行）
- `infrastructure/adapters/deepseek_adapter.py` - DeepSeek API 适配器（120+ 行）

#### Agents
- `agents/base_agent.py` - AutonomousAgent 基类（实现 SubAgent 端口）
- `agents/chat_agent.py` - ChatAgent（遵循双向端口原则）

#### 记忆系统核心算法
- [MEMORY_SYSTEM_HYBRID_ATTENTION_SPEC.md](./MEMORY_SYSTEM_HYBRID_ATTENTION_SPEC.md) | **记忆系统混合注意力架构规范** - CSA/HCA 映射 + Lightning Indexer + 记忆蒸馏 | ✅ 已定义 |
- [FULL_STACK_HYBRID_ATTENTION_MAPPING.md](./FULL_STACK_HYBRID_ATTENTION_MAPPING.md) | **全栈混合注意力架构映射规范** - Agent调度/执行/安全/交互/模型选择的全局映射 | ✅ 已定义 |

#### 技能系统核心规范
- [SKILL_SYSTEM_PRIVATE_ENGINE_SPEC.md](./SKILL_SYSTEM_PRIVATE_ENGINE_SPEC.md) | **技能系统私有自动化引擎规范** - 三层体系 + YAML Schema + 自动沉淀 + 安全沙箱 | ✅ 已定义 |

#### 代码智能矩阵核心规范
- [CORE_CODE_AGENTS_SPEC.md](./CORE_CODE_AGENTS_SPEC.md) | **代码智能矩阵四大核心 Agent 规范** - 代码解释/生成/补全/SQL优化 | ✅ **新增** |

---

### 4️⃣ 测试与质量保障

| 文档 | 说明 | 状态 |
|------|------|------|
| `tests/helpers/mock_factories.py` | 测试 Mock 工厂 - 集中化配置 | ✅ 已创建 |
| `verify_architecture.py` | 架构合规性验证脚本 - 自动化检查 | ✅ 已创建 |

**测试规范**：
- TEST-001: 单元测试覆盖率 ≥80%
- TEST-002: 只 Mock 端口抽象，不 Mock 具体实现
- TEST-003: 集成测试覆盖关键业务流程
- TEST-004: E2E 测试验证用户场景

---

## 🗺️ 快速入门指南

### 对于新开发者

1. **阅读架构宪章** → [ARCHITECTURE_CONSTRAINTS.md](./docs/architecture-constraints.md)
2. **理解核心原则** → 依赖方向、通信路径、双向端口
3. **运行验证脚本** → `python verify_architecture.py`
4. **查看示例代码** → `agents/chat_agent.py`（标准实现）

---

### 对于架构审查者

1. **检查合规性** → [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
2. **运行 radon** → `radon cc cortex/ -a -s -n C`
3. **审查 PR** → 确保不违反 DEP/COM/AG/MEM 铁律
4. **更新文档** → 如有架构变更，同步更新相关文档

---

### 对于产品规划者

1. **了解愿景** → [ULTIMATE_ARCHITECTURE_ROADMAP.md](./ULTIMATE_ARCHITECTURE_ROADMAP.md)
2. **评估差距** → [ARCHITECTURE_GAP_ANALYSIS.md](./ARCHITECTURE_GAP_ANALYSIS.md)
3. **制定优先级** → P0/P1/P2/P3 任务排序
4. **跟踪进度** → 里程碑与关键指标

---

## 📊 架构健康度评分

### 当前评分（v2.0）

| 维度 | 得分 | 满分 | 说明 |
|------|------|------|------|
| **依赖方向合规** | 5/5 | 5 | DEP-001 ~ DEP-004 完全遵守 |
| **通信路径合规** | 5/5 | 5 | COM-001 ~ COM-004 完全遵守 |
| **Agent 双向端口** | 5/5 | 5 | AG-001 ~ AG-006 完全遵守 |
| **记忆隔离** | 5/5 | 5 | MEM-001 ~ MEM-005 完全遵守 |
| **测试覆盖率** | 4/5 | 5 | 核心模块 ≥80%，待完善边缘场景 |
| **代码复杂度** | 4/5 | 5 | radon 平均复杂度 B，无上帝类 |
| **文档完整性** | 5/5 | 5 | 架构文档齐全 |
| **总分** | **33/35** | 35 | **健康度: 94%** ✅ |

**评级**: 🟢 **优秀**（≥30 分为健康）

---

## 🔍 常见问题解答

### Q1: 如何添加新的 Agent？

**A**: 遵循以下步骤：
1. 继承 `AutonomousAgent` 基类
2. 实现 `agent_id`、`name`、`supported_intents` 属性
3. 实现 `execute()` 方法（自动发布领域事件）
4. 通过构造函数注入依赖（MemoryPortal, EventBus, LLMPort）
5. 编写单元测试（Mock 端口抽象）

**示例**: 参见 `agents/chat_agent.py`

---

### Q2: 如何添加新的领域事件？

**A**: 遵循以下步骤：
1. 在 `core/events/domain_events.py` 中定义新事件类
2. 继承 `DomainEvent` 基类
3. 定义事件类型（`event_type`）和载荷（`payload`）
4. 在 `__init__.py` 中导出
5. 通过 `EventBus.publish()` 发布事件

**示例**: 参见 `TaskCompletedEvent`、`SystemErrorEvent`

---

### Q3: 如何实现新的记忆适配器？

**A**: 遵循以下步骤：
1. 实现 `MemoryPortal` 端口接口
2. 使用 ABC 或 Protocol 定义抽象方法
3. 在异常时发布 `SystemErrorEvent`（遵循记忆记录失败告警规范）
4. 区分操作记忆和会话历史
5. 编写集成测试

**示例**: 参见 `infrastructure/adapters/sqlite_memory_adapter.py`

---

### Q4: 如何避免上帝类？

**A**: 遵循以下原则：
1. **单一职责**：每个类只负责一个功能
2. **依赖注入**：通过构造函数注入依赖，而非内部实例化
3. **事件驱动**：跨模块通信通过 EventBus，禁止直接调用
4. **端口抽象**：Application 层只依赖端口，不依赖具体实现
5. **定期审查**：使用 radon 检查复杂度，超过阈值立即重构

**工具**: `radon cc cortex/ -a -s -n C`（显示复杂度 ≥C 的类）

---

### Q5: 如何进行架构合规性检查？

**A**: 使用以下方法：
1. **自动化验证** → `python verify_architecture.py`
2. **代码审查清单** → 参见 [ARCHITECTURE_COMPLIANCE_CHECKLIST.md](./ARCHITECTURE_COMPLIANCE_CHECKLIST.md)
3. **radon 复杂度检查** → `radon cc cortex/ -a -s -n C`
4. **import-linter** → 验证依赖方向（可选）
5. **人工审查** → PR 合并前必须由架构守护者审核

---

## 📝 文档更新日志

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|---------|------|
| 2026-04-22 | v3.0 | 添加终极架构愿景、演进路线、差距分析 | Cortex·架构守护者 |
| 2026-04-22 | v2.1 | 添加架构合规性检查清单、验证脚本 | Cortex·架构守护者 |
| 2026-04-22 | v2.0 | 完成架构修正，合规率 100% | Cortex·架构守护者 |
| 2026-04-20 | v1.0 | 初始架构宪章定义 | Cortex·架构守护者 |

---

## 🤝 贡献指南

### 提交 PR 前的检查清单

- [ ] 代码符合架构宪章（DEP/COM/AG/MEM 铁律）
- [ ] 单元测试覆盖率 ≥80%
- [ ] 运行 `python verify_architecture.py` 通过所有检查
- [ ] 运行 `radon cc cortex/ -a -s -n C` 无复杂度 ≥C 的类
- [ ] 更新相关文档（如有架构变更）
- [ ] 添加 CHANGELOG 条目

---

### 报告架构问题

如发现架构违规或设计缺陷，请：
1. 创建 GitHub Issue，标签设为 `architecture`
2. 描述问题详情（违反哪条铁律）
3. 提供修复建议（可选）
4. 标记 @Cortex-Architecture-Guardian

---

## 🏆 结语

**Cortex 架构的核心价值**：

1. **职责边界清晰** - 每个模块只做一件事，并做好
2. **测试驱动真实** - AI 回答像学徒般自然，禁止元话语
3. **体验优先** - 写操作即时持久化，语义检索是默认能力
4. **架构纯洁性** - 任何违反宪章的代码都将被拦截

**我们的使命**：
> 将用户的思想直接锻造成现实，无需亲手编码，只需创造和决策。

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v3.0 文档索引

**最后更新**: 2026-04-22 18:30 UTC+8
