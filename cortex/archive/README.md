# Cortex 架构文档归档目录

**日期**: 2026-04-22  
**状态**: 📦 **已归档（不再维护）**

---

## 📋 归档说明

本目录包含已从主文档体系中移除的历史文档。这些文档的内容已被合并到新的核心文档中，因此不再单独维护。

**归档原则**：
- ✅ 保留历史版本供参考
- ❌ 不再更新或维护
- 🔗 所有引用应指向新的合并文档

---

## 📚 归档文档列表

### 1. 哲学与存在论类（已合并至 PHILOSOPHICAL_APPENDIX.md）

| 原文件名 | 归档日期 | 合并目标 |
|---------|---------|---------|
| [EXISTENTIAL_MANIFESTO_SPEECH_AND_BEING.md](./EXISTENTIAL_MANIFESTO_SPEECH_AND_BEING.md) | 2026-04-22 | → [PHILOSOPHICAL_APPENDIX.md](../PHILOSOPHICAL_APPENDIX.md) |
| [PHILOSOPHICAL_BOUNDARIES_AND_DISILLUSIONMENT.md](./PHILOSOPHICAL_BOUNDARIES_AND_DISILLUSIONMENT.md) | 2026-04-22 | → [PHILOSOPHICAL_APPENDIX.md](../PHILOSOPHICAL_APPENDIX.md) |

**合并理由**：两份文档都探讨了 Cortex 的哲学边界和存在论问题，合并后形成完整的"自我认知宪章"。

---

### 2. Agent 系统类（已合并至 AGENT_SYSTEM_FULL_SPEC.md）

| 原文件名 | 归档日期 | 合并目标 |
|---------|---------|---------|
| [AGENT_DESIGN_PHILOSOPHY.md](./AGENT_DESIGN_PHILOSOPHY.md) | 2026-04-22 | → [AGENT_SYSTEM_FULL_SPEC.md](../AGENT_SYSTEM_FULL_SPEC.md) |
| [AGENT_TECHNICAL_SPECIFICATION.md](./AGENT_TECHNICAL_SPECIFICATION.md) | 2026-04-22 | → [AGENT_SYSTEM_FULL_SPEC.md](../AGENT_SYSTEM_FULL_SPEC.md) |
| [CORE_CODE_AGENTS_SPEC.md](./CORE_CODE_AGENTS_SPEC.md) | 2026-04-22 | → [AGENT_SYSTEM_FULL_SPEC.md](../AGENT_SYSTEM_FULL_SPEC.md) |
| [FULL_STACK_HYBRID_ATTENTION_MAPPING.md](./FULL_STACK_HYBRID_ATTENTION_MAPPING.md) | 2026-04-22 | → [AGENT_SYSTEM_FULL_SPEC.md](../AGENT_SYSTEM_FULL_SPEC.md) |

**合并理由**：四份文档分别从哲学、技术规范、代码智能矩阵、注意力映射角度描述 Agent 系统，合并后形成"唯一真理源"。

---

### 3. 架构风险与矛盾调和类（已合并至 ARCHITECTURE_RISK_SPEC.md）

| 原文件名 | 归档日期 | 合并目标 |
|---------|---------|---------|
| [ARCHITECTURE_CONFLICT_RESOLUTION_SPEC.md](./ARCHITECTURE_CONFLICT_RESOLUTION_SPEC.md) | 2026-04-22 | → [ARCHITECTURE_RISK_SPEC.md](../ARCHITECTURE_RISK_SPEC.md) |
| [ARCHITECTURE_RISK_MITIGATION_SPEC.md](./ARCHITECTURE_RISK_MITIGATION_SPEC.md) | 2026-04-22 | → [ARCHITECTURE_RISK_SPEC.md](../ARCHITECTURE_RISK_SPEC.md) |

**合并理由**：两份文档分别处理哲学层矛盾和工程层风险，合并后形成从哲学到工程的完整风险控制总纲。

---

## 🔄 文档精简计划进度

### 已完成合并（3/8）
- ✅ AGENT_SYSTEM_FULL_SPEC.md（4份 → 1份）
- ✅ PHILOSOPHICAL_APPENDIX.md（2份 → 1份）
- ✅ ARCHITECTURE_RISK_SPEC.md（2份 → 1份）

### 待完成合并（5/8）
- ⏳ CORE_ENGINE_SPEC.md（待合并 CORE_ENGINE_IMPLEMENTATION_SPEC.md + CORTEX_ULTIMATE_BLUEPRINT.md）
- ⏳ MEMORY_SYSTEM_FULL_SPEC.md（待合并记忆系统"两层四份"文档）
- ⏳ PROJECT_STATUS.md（待合并 MIGRATION_PROGRESS.md + PROJECT_COMPLETION_REPORT.md）
- ⏳ SKILL_SYSTEM_PRIVATE_ENGINE_SPEC.md（保持独立）
- ⏳ MEMORY_SYSTEM_HYBRID_ATTENTION_SPEC.md（保持独立）

**目标**：将 20+ 份文档精简到 8-9 份核心文档

---

## 📖 如何访问归档文档

如果您需要查阅这些历史文档：

1. **查看合并后的新文档**（推荐）：
   - 新文档包含了所有旧文档的核心内容，并进行了整合和优化
   - 链接见上方的"合并目标"列

2. **查阅归档原文档**（仅供参考）：
   - 本文档中的链接仍然有效
   - 但请注意：这些文档已过时，可能包含与新文档不一致的信息

3. **Git 历史追溯**：
   ```bash
   # 查看某个归档文档的最后一次提交
   git log -- cortex/archive/FILENAME.md
   
   # 恢复某个归档文档到工作区（仅用于研究）
   git checkout HEAD~1 -- cortex/archive/FILENAME.md
   ```

---

## ⚠️ 重要提醒

**请勿基于归档文档进行开发！**

- 归档文档中的规范可能已被修订或废弃
- 所有新功能开发应遵循新的合并文档
- 如发现归档文档与新文档有冲突，以新文档为准

---

**维护者**: Cortex·架构守护者  
**最后更新**: 2026-04-22  
**版本**: v1.0 文档归档目录
