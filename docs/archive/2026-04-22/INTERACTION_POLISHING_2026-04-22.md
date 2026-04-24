# 小尾巴交互打磨与文档同步 - 2026-04-22

**日期**: 2026-04-22  
**主题**: 现有功能交互打磨 + 核心文档同步更新  
**状态**: ✅ 已完成

---

## 📋 今日完成的工作

### 1. 配置加载问题修复 ✅

**问题**: ConfigManager 存在多实例导致配置不一致，LLM 调用失败（Provider not found）

**根因**: 
- `ConfigManager` 未被注册为 tsyringe 单例，导致创建了 31 个实例
- 只有 Instance #5 加载了新配置，其他实例仍使用默认值

**修复**:
- 在 `extension.ts` 的 `initializeContainer()` 中添加 `container.registerSingleton(ConfigManager)`
- 确保全局只有一个 ConfigManager 实例

**验证**:
```
✅ [Extension] ConfigManager registered as singleton
✅ [ConfigManager] 🆔 Instance #1 created
✅ [ConfigManager] 🔒 this.currentConfig.model.default: deepseek-v4-flash
✅ LLM 调用成功，V4-Flash/Pro 分层策略生效
```

**影响文件**:
- `src/extension.ts` - 注册 ConfigManager 为单例

---

### 2. AgentRunner 依赖注入时序修复 ✅

**问题**: Agent 执行后无法记录操作记忆，报错 `Cannot read properties of undefined (reading 'recordAgentExecution')`

**根因**:
- `AgentRunner` 在 `initializeContainer()` 中创建时，`memoryAdapter` 还是 `undefined`
- `memoryAdapter` 是在 `activate()` 函数中、`initializeContainer()` 调用之后才创建的

**修复**:
- 从 `initializeContainer()` 中移除 AgentRunner 创建
- 在 `activate()` 函数中，`memoryAdapter` 创建并注册 `IMemoryPort` 之后，再初始化 AgentRunner

**验证**:
```
✅ [AgentRunner] Agent chat-agent completed successfully in 4556ms
✅ [MemoryAdapter] Recording with memoryMetadata: CODE_EXPLAIN
✅ 操作记忆链路恢复完整
```

**影响文件**:
- `src/extension.ts` - 调整 AgentRunner 初始化时机

---

### 3. 会话持久化修复 ✅

**问题**: 在不同文件间切换时，当前会话被刷新/重置

**根因**:
- `ChatViewProvider` 在 Webview 重新激活时没有从 `workspaceState` 恢复之前的会话 ID
- `currentSessionId` 每次都是 `undefined`，导致会话被重置

**修复**:
1. **恢复会话**: 在 `resolveWebviewView` 中从 `workspaceState` 读取并恢复 `currentSessionId`
2. **保存会话**: 在新建、切换、删除会话时保存到 `workspaceState`
3. **清除会话**: 删除当前会话时清除 `workspaceState` 中的 ID

**验证**:
```
✅ [ChatViewProvider] Restored session: session_xxx
✅ [ChatViewProvider] Saved session to workspaceState: session_xxx
✅ 切换标签页后会话状态保持不变
```

**影响文件**:
- `src/chat/ChatViewProvider.ts` - 添加 workspaceState 持久化逻辑

---

### 4. Agent 命名统一 ✅

**问题**: Agent ID 命名风格不统一（下划线 vs 短横线）

**修复**:
- 统一所有 Agent ID 为 **kebab-case**（短横线分隔）
- 修改了 3 个 Agent：
  - `chat_agent` → `chat-agent`
  - `inline_completion_agent` → `inline-completion-agent`
  - `session_management_agent` → `session-management-agent`

**影响文件**:
- `src/agents/ChatAgent.ts`
- `src/agents/InlineCompletionAgent.ts`
- `src/agents/SessionManagementAgent.ts`
- `src/core/application/IntentDispatcher.ts` - 更新引用

---

### 5. ChatAgent 职责分流 ✅

**问题**: ChatAgent 同时处理 `chat`、`explain_code`、`qa`，职责不清晰

**修复**:
- 从 `supportedIntents` 中移除 `explain_code`
- `explain_code` 意图由专门的 `ExplainCodeAgent` 处理
- ChatAgent 只负责纯聊天和问答

**架构优势**:
- ✅ 职责单一原则
- ✅ 符合 IntentDispatcher 路由设计
- ✅ 易于维护和扩展

**影响文件**:
- `src/agents/ChatAgent.ts` - 移除 explain_code 意图和处理逻辑

---

### 6. EventBus 验证逻辑优化 ✅

**问题**: `EventBus.validatePluginEvent` 过度约束，拦截了内部领域事件（如 `task.failed`、`system.error`）

**修复**:
- 仅对以 `plugin.` 开头的事件进行格式校验
- 放行 Core 事件和 Domain 事件

**影响文件**:
- `src/core/eventbus/EventBus.ts`
- `src/core/eventbus/types.ts` - 新增 `TASK_FAILED` 和 `SYSTEM_ERROR` 到 `CoreEventType`

---

### 7. EmbeddingService 降级优化 ✅

**问题**: Transformers.js 在 VS Code Node.js 环境中模型加载失败

**修复**:
- 系统已实现优雅降级：向量检索失败时自动切换到关键词搜索
- 添加了用户友好的提示日志

**当前状态**:
```
⚠️ [EmbeddingService] Failed to load local model: Browser cache is not available
✅ [HybridRetriever] Vector model not available, falling back to keyword-only search
```

**影响**: 不影响核心对话功能，语义检索降级为关键词匹配

---

## 📊 核心文档待更新清单

### 需要更新的文档

1. **PROGRESS.md**
   - [ ] 添加"交互打磨阶段"章节
   - [ ] 记录本次修复的所有问题
   - [ ] 更新最后更新日期

2. **CHANGELOG_2026-04-22.md**
   - [x] 已存在，需补充详细内容
   - [ ] 添加 Bug 修复列表
   - [ ] 添加架构优化说明

3. **INTENT_DRIVEN_ARCHITECTURE.md**
   - [ ] 更新 Agent 路由表（ChatAgent 不再处理 explain_code）
   - [ ] 补充 Agent 命名规范

4. **architecture-constraints.md**
   - [ ] 添加"依赖注入时序约束"章节
   - [ ] 记录 AgentRunner 必须在 memoryAdapter 之后初始化

5. **CORE_PRINCIPLES.md**
   - [ ] 无需更新（原则层面未变化）

---

## 🎯 下一步计划

### 短期（本周）
1. **完善调试日志** - MemorySystem payload 结构确认
2. **测试覆盖** - 验证所有修复在实际使用中正常工作
3. **文档同步** - 更新上述核心文档

### 中期（下周）
1. **MetaAgent P0 阶段** - 知识库基础设施（如果优先级高）
2. **用户体验优化** - 根据反馈继续打磨交互细节

### 长期
1. **技术演进** - MetaAgent 元认知架构完整实施
2. **性能优化** - Embedding 模型本地缓存方案

---

## 📝 备注

- **配置问题已彻底解决** - V4-Flash/Pro 分层策略正常工作
- **会话持久化已修复** - 切换标签页不会丢失会话
- **Agent 职责更清晰** - ChatAgent 专注聊天，ExplainCodeAgent 专注代码解释
- **架构更健壮** - 依赖注入时序正确，不会出现 undefined 错误

---

**维护者**: 小尾巴团队  
**下次审查**: 2026-04-29（或重大架构变更后）
