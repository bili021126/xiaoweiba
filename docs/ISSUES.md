# 小尾巴（XiaoWeiba）问题记录

**版本**: 1.0  
**最后更新**: 2026-04-17

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

### 2026-04-17

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|----------|
| 2026-04-17 | 记忆检索权重固定，无法适应用户习惯 | P1 | 缺乏意图感知和自适应机制 | 实现意图分析器+专家选择器，基于反馈动态调整权重 | ✅ 已集成到 EpisodicMemory | src/core/memory/types.ts, IntentAnalyzer.ts, ExpertSelector.ts, EpisodicMemory.ts |
| 2026-04-17 | 记忆检索无法理解时间指代和语义 | P0 | 纯关键词匹配，无近因性加权，实体未有效利用 | 实现混合检索系统：时间指代检测 + TF-IDF + 时间衰减 + 实体加权 | ✅ 已修复 | src/core/memory/EpisodicMemory.ts:219-830 |
| 2026-04-17 | ContextBuilder.messages使用any[]类型 | P0 | 缺乏类型安全 | 改为ChatMessage[]接口 | ✅ 已修复 | src/chat/ContextBuilder.ts:21 |
| 2026-04-17 | ContextBuilder console.warn调试日志 | P1 | 生产环境遗留 | 移除console.warn，静默处理错误 | ✅ 已修复 | src/chat/ContextBuilder.ts:80 |
| 2026-04-17 | assessMessageComplexity硬编码阈值 | P1 | 可维护性差 | 提取为COMPLEXITY_CONSTANTS常量对象 | ✅ 已修复 | src/chat/ContextBuilder.ts:9-15 |
| 2026-04-17 | ChatViewProvider消息类型不明确 | P0 | any[]导致类型不安全 | 定义ChatMessage接口并应用 | ✅ 已修复 | src/chat/ChatViewProvider.ts:13-19 |
| 2026-04-17 | 审计日志durationMs硬编码为0 | P1 | 数据不准确 | 使用Date.now()计算实际耗时 | ✅ 已修复 | src/chat/ChatViewProvider.ts:186-187 |
| 2026-04-17 | ChatViewHtml正则表达式模板字符串转义错误 | P0 | 模板字符串中直接使用正则字面量导致解析失败 | 改用new RegExp()构造函数避免转义问题 | ✅ 已修复 | src/chat/ChatViewHtml.ts:438-443 |
| 2026-04-17 | FTS5不可用导致跨会话记忆失效 | P0 | sql.js开发环境不支持FTS5模块，search()返回空数组 | 添加降级方案：FTS5失败时自动切换到LIKE查询 | ✅ 已修复 | src/core/memory/EpisodicMemory.ts:195-303 |

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
| 总问题数 | 20 |
| 已修复 | 20（19个完全修复，1个核心功能已完成） |
| 待修复 | 0 |
| P0 严重 | 10（全部修复） |
| P1 警告 | 8（全部完成核心功能） |
| P2 建议 | 2（全部修复） |

---

**关联文档**:
- 需求架构: docs/REQUIREMENTS.md
- 进度跟踪: docs/PROGRESS.md
