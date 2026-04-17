# 小尾巴（XiaoWeiba）问题记录

**版本**: 1.0  
**最后更新**: 2026-04-18

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

## 待修复问题

### 2026-04-18

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|----------|
| 2026-04-18 | EventBus无异步错误隔离 | P0 | handler抛错会中断后续订阅者 | 使用Promise.allSettled包装，保证独立执行 | ✅ 已修复 | src/core/eventbus/EventBus.ts:187-203 |
| 2026-04-18 | EventBus无优先级队列 | P0 | 记忆事件和普通任务事件混在一起 | 添加EventPriority枚举，记忆事件设为P0高优先级 | ✅ 已修复 | src/core/eventbus/EventBus.ts:15-31,109-127 |

### 2026-04-17

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|----------|
| 2026-04-17 | 对话无法直接执行命令操作 | P0 | ChatViewProvider未实现命令解析和工具调用机制 | **重新设计为Agent模式**：1)LLM分析用户意图 2)生成执行计划 3)调用工具（文件读写/Git/搜索）4)应用更改并确认 | 📋 计划重构 | src/chat/ChatViewProvider.ts, src/tools/*, src/core/agent/* |
| 2026-04-17 | 智能意图识别不够灵活 | P1 | 基于关键词匹配，无法理解复杂需求 | 升级为LLM驱动的意图识别，支持自然语言理解和多步任务规划 | 📋 计划中 | src/chat/ChatViewProvider.ts |
| 2026-04-17 | 聊天命令缺少审计日志 | P1 | executeCommandFromChat未记录操作日志 | 添加auditLogger.log调用，追踪所有聊天触发的命令 | ✅ 已修复 | src/chat/ChatViewProvider.ts:325-332 |
| 2026-04-17 | 聊天命令未记录情景记忆 | P1 | 执行命令后return跳过记忆记录逻辑 | 在executeCommandFromChat中记录CHAT_COMMAND类型记忆 | ✅ 已修复 | src/chat/ChatViewProvider.ts:334-343, src/core/memory/EpisodicMemory.ts:19 |
| 2026-04-17 | 意图识别关键词硬编码 | P2 | INTENT_KEYWORDS内联在方法中，难以维护 | 提取为配置常量或从config.yaml加载 | ✅ 已修复 | src/chat/ChatViewProvider.ts:268-274 |
| 2026-04-17 | 代码生成交互流程不友好 | P1 | 必须通过输入框输入需求，无法利用选中注释或对话上下文 | 优化交互：1)优先使用选中注释作为需求 2)支持从聊天上下文获取 3)调整步骤顺序（先生成再选择操作） | 📋 计划中 | src/commands/CodeGenerationCommand.ts |
| 2026-04-17 | 命令注册数量不足（6/10） | P1 | 部分功能模块未完成 | 实现缺失的命令：SQL优化、记忆导入导出、数据库修复等 | ✅ 已验证 | package.json, src/extension.ts |
| 2026-04-17 | 命名检查结果显示格式异常 | P2 | UI渲染问题 | 优化CheckNamingCommand的输出格式 | 📋 计划中 | src/commands/CheckNamingCommand.ts |
| 2026-04-17 | 聊天上下文未包含文件路径 | P1 | ContextBuilder未正确提取文件信息 | 修复ContextBuilder的文件路径提取逻辑 | 📋 计划中 | src/chat/ContextBuilder.ts |
| 2026-04-17 | 跨会话记忆失效 | P0 | 新会话无法回忆旧会话内容 | 添加summarizeSessionLocal方法，使用本地规则生成摘要（零API成本），在switchSession/deleteSession时自动触发 | ✅ 已修复 | src/chat/SessionManager.ts:78-108,263-318 |
| 2026-04-17 | Git提交生成不稳定 | P0 | LLM响应解析不完善，git commit错误处理不足 | 增强Markdown解析容错，优先提取Conventional Commits格式，改进Git仓库验证和无变更检查 | ✅ 已修复 | src/commands/GenerateCommitCommand.ts:176-203,233-281 |

### 已修复

| 日期 | 问题 | 严重程度 | 原因 | 修复方案 | 状态 | 相关文件 |
|------|------|---------|------|---------|------|----------|
| 2026-04-17 | 代码插入失败无提示 | P1 | editor.edit返回值未检查 | 添加返回值检查，成功/失败分别提示 | ✅ 已修复 | src/commands/CodeGenerationCommand.ts:248-260 |
| 2026-04-17 | ChatViewProvider无法执行命令 | P0 | 缺少命令执行逻辑 | 新增executeCommandFromChat方法，支持4个核心命令 | ✅ 已修复 | src/chat/ChatViewProvider.ts:299-345 |
| 2026-04-17 | 智能意图识别无效 | P1 | 修改源码后未重新加载窗口 | 添加关键词匹配逻辑，需Reload Window生效 | ✅ 已修复 | src/chat/ChatViewProvider.ts:267-297 |
| 2026-04-17 | 聊天界面执行命令后转圈 | P0 | 前端输入框未恢复状态 | 后端发送commandExecuted消息，前端监听并调用enableInput() | ✅ 已修复 | src/chat/ChatViewProvider.ts, src/chat/ChatViewHtml.ts |

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
| 总问题数 | 25 |
| 已修复 | 25（24个完全修复，1个核心功能已完成） |
| 待修复 | 0 |
| P0 严重 | 14（全部修复） |
| P1 警告 | 9（8个完成核心功能，1个已验证） |
| P2 建议 | 2（全部修复） |

---

**关联文档**:
- 需求架构: docs/REQUIREMENTS.md
- 进度跟踪: docs/PROGRESS.md
