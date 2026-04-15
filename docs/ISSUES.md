# 小尾巴（XiaoWeiba）问题记录

**版本**: 1.0  
**最后更新**: 2026-04-16

---

## 问题记录格式

| 字段 | 说明 |
|------|------|
| 日期 | 问题发现/修复日期 |
| 问题 | 问题描述 |
| 严重程度 | P0（严重）/ P1（警告）/ P2（建议） |
| 原因 | 根本原因分析 |
| 修复方案 | 解决方案 |
| 状态 | 待修复 / 修复中 / 已修复 |
| 相关文件 | 涉及的文件路径 |

---

## 已修复问题

### 2026-04-16

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|---------|
| 2026-04-16 | DatabaseManager.runQuery 忽略 params 参数，导致 SQL 执行失败 | P0 | 实现不完整，只调用 db.exec 未处理参数 | 使用 db.prepare + stmt.bind 实现真正的参数化查询 | ✅ 已修复 | src/storage/DatabaseManager.ts:579-612 |
| 2026-04-16 | PreferenceMemory.queryPreferences LIMIT 注入风险 | P1 | LIMIT 值直接字符串拼接 | 改用 LIMIT ? 参数化 + Math.min/max 验证范围 1-100 | ✅ 已修复 | src/core/memory/PreferenceMemory.ts:145-162 |
| 2026-04-16 | EpisodicMemory 测试使用 mockDb.exec 但实际代码使用 db.prepare | P1 | 测试 Mock 与实际实现不匹配 | 更新所有测试用例使用 mockStatement (prepare/bind/step/getAsObject) | ✅ 已修复 | tests/unit/memory/EpisodicMemory.test.ts |
| 2026-04-16 | ChatViewProvider CSP 测试期望错误 | P2 | 测试期望无 'unsafe-inline' 但 style-src 需要 | 更新测试验证 script-src 无 'unsafe-inline'，允许 style-src 包含 | ✅ 已修复 | tests/unit/chat/ChatViewProvider.test.ts:242-256 |

### 2026-04-15

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|---------|
| 2026-04-15 | EpisodicMemory SQL 注入漏洞（7处） | P0 | 手动 replace() 替换参数，本质仍是字符串拼接 | 使用 db.prepare + stmt.bind 真正参数化查询 | ✅ 已修复 | src/core/memory/EpisodicMemory.ts |
| 2026-04-15 | ImportMemoryCommand SQL 注入 | P0 | 字符串拼接 SQL 查询 | 使用参数化查询 | ✅ 已修复 | src/commands/ImportMemoryCommand.ts:286 |
| 2026-04-15 | ChatViewProvider XSS 漏洞 | P0 | LLM 返回内容直接插入 innerHTML，CSP 过松 | 引入 DOMPurify + 收紧 CSP 策略 | ✅ 已修复 | src/chat/ChatViewProvider.ts |
| 2026-04-15 | FTS5 查询可被绕过 | P1 | 特殊字符未充分清理 | 添加 sanitizeFtsQuery() 函数清理特殊字符 | ✅ 已修复 | src/core/memory/EpisodicMemory.ts |
| 2026-04-15 | sortBy/sortOrder 未充分验证 | P1 | 直接拼接到 ORDER BY 子句 | 白名单验证字段名 | ✅ 已修复 | src/core/memory/EpisodicMemory.ts |

---

## 当前问题（无）

暂无未修复问题。

---

## 统计

| 指标 | 数值 |
|------|------|
| 总问题数 | 11 |
| 已修复 | 11 |
| 待修复 | 0 |
| P0 严重 | 5（全部修复） |
| P1 警告 | 4（全部修复） |
| P2 建议 | 2（全部修复） |

---

**关联文档**:
- 需求架构: docs/REQUIREMENTS.md
- 进度跟踪: docs/PROGRESS.md
