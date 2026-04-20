# EventBus 事件类型格式修复报告

**日期**: 2026-04-19  
**问题等级**: P0 - 严重（阻塞功能）  
**状态**: ✅ 已修复  

---

## 📋 问题描述

### 错误信息
```
会话操作失败：[EventBus] Plugin event type must match "plugin.<pluginId>.<event>", got session.list.updated
```

### 现象
用户执行会话操作（新建、切换、删除）时，系统抛出错误，会话列表无法更新。

---

## 🔍 根本原因

### EventBus 半封闭架构规范

根据项目的 EventBus 设计规范（`src/core/eventbus/types.ts`），事件类型分为两类：

1. **内核事件（CoreEventType）**：封闭枚举，由系统预定义
   - 例如：`task.completed`, `agent.selected`, `intent.received`

2. **插件事件（PluginEventType）**：开放命名空间，但必须遵循特定格式
   - 格式：`plugin.<pluginId>.<event>`
   - 例如：`plugin.git.commit`, `plugin.xiaoweiba.session_list_updated`

---

### 违规代码

**文件**: `src/core/events/DomainEvent.ts`

```typescript
export class SessionListUpdatedEvent extends DomainEvent<SessionListUpdatedPayload> {
  static readonly type = 'session.list.updated';  // ❌ 不符合插件事件格式
  
  constructor(...) {
    super(SessionListUpdatedEvent.type, Date.now(), {...});
  }
}
```

**问题**: 事件类型 `'session.list.updated'` 既不是内核事件，也不符合插件事件格式 `plugin.<pluginId>.<event>`。

---

### 验证逻辑

**文件**: `src/core/eventbus/EventBus.ts` (第62-67行)

```typescript
private validatePluginEvent(event: BaseEvent<PluginEventType>): void {
  const pluginEventPrefix = /^plugin\.\w+\.\w+$/;
  if (!pluginEventPrefix.test(event.type)) {
    throw new Error(`[EventBus] Plugin event type must match "plugin.<pluginId>.<event>", got ${event.type}`);
  }
}
```

当发布非内核事件时，EventBus 会调用此验证方法，检查是否符合插件事件格式。

---

## 🔧 修复方案

### 修改事件类型格式

**文件**: `src/core/events/DomainEvent.ts`

```typescript
export class SessionListUpdatedEvent extends DomainEvent<SessionListUpdatedPayload> {
  // ✅ 修复：使用 plugin.<pluginId>.<event> 格式
  static readonly type = 'plugin.xiaoweiba.session_list_updated';
  
  constructor(
    public readonly action: 'created' | 'deleted' | 'switched',
    public readonly sessionId?: string
  ) {
    super(SessionListUpdatedEvent.type, Date.now(), {
      action,
      sessionId,
      timestamp: Date.now()
    });
  }
}
```

**说明**:
- `plugin`: 固定前缀，标识这是插件事件
- `xiaoweiba`: 插件ID（当前项目名）
- `session_list_updated`: 具体事件名称（使用下划线分隔）

---

### 影响范围检查

#### 1. SessionManagementAgent（发布者）

**文件**: `src/agents/SessionManagementAgent.ts`

```typescript
// 使用 SessionListUpdatedEvent.type，自动适配新格式
this.eventBus.publish(new SessionListUpdatedEvent('created', sessionId));
```

**状态**: ✅ 无需修改（使用常量引用）

---

#### 2. ChatViewProvider（订阅者）

**文件**: `src/chat/ChatViewProvider.ts`

```typescript
// 使用 SessionListUpdatedEvent.type，自动适配新格式
this.eventBus.subscribe(SessionListUpdatedEvent.type, (event) => {
  const sessionEvent = event as SessionListUpdatedEvent;
  console.log('[ChatViewProvider] Session list updated:', sessionEvent.action);
  // ...
});
```

**状态**: ✅ 无需修改（使用常量引用）

---

## ✅ 验证结果

### 编译测试
```bash
npm run compile
```
**结果**: ✅ 零错误

---

### 单元测试
```bash
npm test -- --silent
```
**结果**: ✅ 30 suites passed, 527 tests passed

---

### 人工测试

请在 VS Code 中执行以下测试：

#### 测试1：新建会话
1. 点击"新建会话"按钮
2. 观察控制台日志

**预期结果**:
- [ ] 无错误提示
- [ ] 控制台显示：`[ChatViewProvider] Session list updated: created session_xxx`
- [ ] 前端收到 `refreshSessionList` 消息

---

#### 测试2：切换会话
1. 在聊天中输入："切换到会话 session_xxx"
2. 观察控制台日志

**预期结果**:
- [ ] 无错误提示
- [ ] 控制台显示：`[ChatViewProvider] Session list updated: switched session_xxx`

---

#### 测试3：删除会话
1. 在聊天中输入："删除会话 session_xxx"
2. 观察控制台日志

**预期结果**:
- [ ] 无错误提示
- [ ] 控制台显示：`[ChatViewProvider] Session list updated: deleted session_xxx`

---

## 📊 影响范围

### 修改的文件
1. `src/core/events/DomainEvent.ts` - +3行, -1行（修正事件类型格式）

**总计**: +3行, -1行

---

### 事件类型对比

| 事件名称 | 修复前 | 修复后 | 类型 |
|---------|--------|--------|------|
| SessionListUpdatedEvent | `session.list.updated` | `plugin.xiaoweiba.session_list_updated` | 插件事件 |

---

## 🎯 核心原则

### EventBus 半封闭架构

```
┌─────────────────────────────────────┐
│         EventBus 事件分类            │
├──────────────────┬──────────────────┤
│   内核事件        │   插件事件        │
│  (封闭枚举)       │  (开放命名空间)   │
├──────────────────┼──────────────────┤
│ task.completed   │ plugin.git.commit│
│ agent.selected   │ plugin.xiaoweiba │
│ intent.received  │   .session_list_ │
│ ...              │    updated       │
└──────────────────┴──────────────────┘
     ✅ 预定义           ✅ 必须符合格式
                         plugin.<id>.<event>
```

---

### 为什么需要这个规范？

1. **命名空间隔离**: 避免不同插件的事件类型冲突
2. **来源追溯**: 从事件类型即可知道是哪个插件发布的
3. **权限控制**: 可以对不同插件的事件进行不同的权限管理
4. **监控告警**: 可以按插件ID统计事件频率和错误率

---

## 💡 最佳实践

### 创建新事件时的检查清单

1. **判断事件类型**:
   - 是内核事件？→ 添加到 `CoreEventType` 枚举
   - 是插件事件？→ 使用 `plugin.<pluginId>.<event>` 格式

2. **命名规范**:
   - 插件ID：使用项目名称或小写单词（如 `xiaoweiba`, `git`）
   - 事件名称：使用下划线分隔的小写单词（如 `session_list_updated`）

3. **示例**:
   ```typescript
   // ✅ 正确
   static readonly type = 'plugin.xiaoweiba.memory_exported';
   static readonly type = 'plugin.git.branch_changed';
   
   // ❌ 错误
   static readonly type = 'memory.exported';
   static readonly type = 'gitBranchChanged';
   ```

---

### 其他可能需要修复的事件

检查项目中是否还有其他插件事件未遵循规范：

```bash
# 搜索所有 DomainEvent 子类
grep -r "extends DomainEvent" src/core/events/

# 检查它们的事件类型格式
grep -A 2 "static readonly type" src/core/events/DomainEvent.ts
```

**当前检查结果**:
- ✅ `IntentReceivedEvent`: `intent.received` → 内核事件（已在 CoreEventType 中）
- ✅ `AgentSelectedEvent`: `agent.selected` → 内核事件（已在 CoreEventType 中）
- ✅ `TaskCompletedEvent`: `task.completed` → 内核事件（已在 CoreEventType 中）
- ✅ `AssistantResponseEvent`: `assistant.response` → 内核事件（已在 CoreEventType 中）
- ✅ `StreamChunkEvent`: `stream.chunk` → 内核事件（已在 CoreEventType 中）
- ✅ `SessionListUpdatedEvent`: `plugin.xiaoweiba.session_list_updated` → 插件事件（已修复）

**结论**: 所有事件都已符合规范！

---

## 📝 总结

### 问题根源
`SessionListUpdatedEvent` 使用了不符合 EventBus 规范的事件类型格式，导致发布时被验证逻辑拦截。

---

### 解决方案
将事件类型从 `'session.list.updated'` 改为 `'plugin.xiaoweiba.session_list_updated'`，符合 `plugin.<pluginId>.<event>` 格式要求。

---

### 质量保证
- ✅ 编译零错误
- ✅ 单元测试全部通过
- ✅ 向后兼容（使用常量引用，无需修改订阅者）
- ✅ 符合架构规范

---

### 经验教训

1. **创建新事件时必须检查格式**: 插件事件必须遵循 `plugin.<pluginId>.<event>` 格式
2. **使用常量引用**: 发布者和订阅者都应使用 `EventClass.type`，避免硬编码字符串
3. **文档化规范**: 在 DomainEvent.ts 中添加注释说明事件类型规范

---

**修复完成时间**: 2026-04-19  
**执行人**: AI Code Assistant  
**状态**: ✅ 已完成
