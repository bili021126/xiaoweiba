# 六边形架构 + 微核 + 事件总线 - 详细设计

**创建时间**: 2026-04-17  
**版本**: v1.0  
**关联文档**: [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)

---

## 一、模块职责详解

### 1.1 核心层（微核）

| 模块 | 职责 | 是否可替换 |
|------|------|-----------|
| **EventBus** | 事件发布/订阅、优先级队列、持久化 | ❌ 否（核心基础设施） |
| **MemoryPort + MemoryEngine** | 记忆的记录、检索、衰减、归档 | ❌ 否（核心差异化） |
| **SecurityPort + Authorizer** | 任务授权、令牌管理、审计日志 | ❌ 否 |
| **SessionManager** | 会话管理、消息历史 | ❌ 否 |
| **ContextBuilder** | 构建 Prompt 上下文 | ❌ 否 |
| **PluginManager** | 加载、启用/禁用插件 | ❌ 否 |

### 1.2 插件层（扩展）

每个插件实现一个或多个端口，通过事件总线与其他模块通信。

| 插件 | 触发的端口 | 发布的事件 | 订阅的事件 |
|------|-----------|-----------|-----------|
| **代码解释** | LLMPort, MemoryPort | `task.completed` | `plugin.enabled`, `config.updated` |
| **提交生成** | GitPort, LLMPort | `task.completed`, `git.commit` | - |
| **Git智能助手** | GitPort | `git.commit`, `git.push` | `task.completed` |
| **网络搜索** | SearchPort, MemoryPort | `search.completed` | `user.query` |

### 1.3 适配器层

每个端口可以有多个适配器，通过配置切换：

| 端口 | 适配器 | 说明 |
|------|-------|------|
| **MemoryPort** | SQLiteMemoryAdapter | 默认 |
| | VectorMemoryAdapter | 未来支持向量检索 |
| **LLMPort** | DeepSeekAdapter | 默认 |
| | OllamaAdapter | 本地模型 |
| | OpenAIAdapter | 可选 |
| **GitPort** | VSCodeGitAdapter | 默认 |
| | CommandLineGitAdapter | 备选 |
| **FilePort** | VSCodeFileAdapter | 默认 |
| | NodeFileAdapter | 独立运行时 |
| **SearchPort** | BingSearchAdapter | 默认 |
| | GoogleSearchAdapter | 可选 |
| | LocalMockAdapter | 测试用 |

---

## 二、事件总线与插件交互流程

### 2.1 典型场景：代码解释插件工作流程

```
用户触发命令
   ↓
代码解释插件接收命令
   ↓
插件发布事件: 'llm.call.started' (包含 prompt)
   ↓
LLM适配器订阅该事件，调用 DeepSeek API
   ↓
适配器发布事件: 'llm.call.completed' (包含 response)
   ↓
代码解释插件订阅该事件，接收响应
   ↓
插件发布事件: 'memory.record' (请求记录情景记忆)
   ↓
MemoryPort 订阅该事件，调用记忆引擎存储
   ↓
记忆引擎发布事件: 'memory.recorded' (确认已记录)
   ↓
代码解释插件订阅该事件，更新 UI
   ↓
插件发布事件: 'task.completed' (最终完成)
   ↓
AuditLogger 订阅该事件，写入审计日志
```

### 2.2 事件定义（核心事件）

| 事件名 | 载荷 | 发布者 | 订阅者 |
|--------|------|--------|--------|
| `llm.call.started` | `{ requestId, provider, prompt }` | 任何需要 LLM 的插件 | LLM适配器 |
| `llm.call.completed` | `{ requestId, response, duration }` | LLM适配器 | 原请求插件、审计 |
| `memory.record` | `{ memoryType, content, entities }` | 任何需要记录记忆的模块 | 记忆引擎 |
| `memory.recorded` | `{ memoryId }` | 记忆引擎 | 审计、UI |
| `memory.retrieve` | `{ query, options }` | 需要检索记忆的模块 | 记忆引擎 |
| `memory.retrieved` | `{ results }` | 记忆引擎 | 请求方 |
| `task.completed` | `{ taskId, taskType, result, duration }` | 任何完成任务的模块 | 审计、统计 |
| `git.commit` | `{ message, files }` | 提交生成插件 | Git适配器 |
| `git.push` | `{ remote, branch }` | Git智能助手 | Git适配器 |
| `search.request` | `{ query, sources }` | 网络搜索插件 | 搜索适配器 |
| `search.result` | `{ query, summary, links }` | 搜索适配器 | 原请求插件、记忆引擎 |
| `plugin.enabled` | `{ pluginId }` | 插件管理器 | 所有插件（重新注册） |
| `config.updated` | `{ key, oldValue, newValue }` | 配置管理器 | 所有依赖该配置的模块 |

---

## 三、依赖注入与生命周期管理

使用 **tsyringe** 作为 IoC 容器，管理核心服务和适配器的实例。

### 3.1 容器配置

```typescript
// src/container.ts
import { container } from 'tsyringe';
import { EventBusImpl } from './core/eventbus';
import { MemoryEngine } from './core/memory';
import { SqliteMemoryAdapter } from './adapters/memory';
import { DeepSeekAdapter } from './adapters/llm';
import { VSCodeGitAdapter } from './adapters/git';

// 注册核心服务
container.registerSingleton('EventBus', EventBusImpl);
container.registerSingleton('MemoryPort', MemoryEngine);
container.registerSingleton('GitPort', VSCodeGitAdapter);
container.registerSingleton('LLMPort', DeepSeekAdapter);

// 插件动态注册（扫描 plugins 目录）
export async function loadPlugins() {
  const pluginFiles = await fs.readdir('./plugins');
  for (const file of pluginFiles) {
    const plugin = await import(`./plugins/${file}`);
    plugin.register(container);
  }
}
```

### 3.2 插件注册模式

每个插件提供一个 `register` 函数：

```typescript
// plugins/ExplainCodePlugin.ts
import { Lifecycle } from 'tsyringe';

export function register(container: Container) {
  container.register('ExplainCodePlugin', ExplainCodeCommand, { 
    lifecycle: Lifecycle.Singleton 
  });
  
  const eventBus = container.resolve<EventBus>('EventBus');
  
  // 订阅事件
  eventBus.subscribe('llm.call.completed', onLLMResponse);
  eventBus.subscribe('config.updated', onConfigChange);
}

async function onLLMResponse(data: any) {
  // 处理 LLM 响应
  console.log('Received LLM response:', data.response);
}

async function onConfigChange(data: any) {
  // 配置变更处理
  if (data.key === 'model.default') {
    console.log('Default model changed to:', data.newValue);
  }
}
```

---

## 四、与"半开放半封闭"原则的契合

| 层面 | 封闭（不可变） | 开放（可扩展） |
|------|--------------|--------------|
| **核心层** | 记忆蒸馏算法、安全授权模型、事件总线接口 | 无（完全封闭） |
| **插件层** | 插件接口定义 | 插件实现（用户可编写） |
| **适配器层** | 端口接口 | 适配器实现（用户可添加新适配器，如新 LLM 提供商） |
| **事件总线** | 核心事件类型 | 插件可定义新事件类型 |

---

## 五、迁移路径（从当前代码到融合架构）

| 阶段 | 任务 | 工时 | 状态 |
|------|------|------|------|
| **1** | 定义核心端口接口（MemoryPort, LLMPort, GitPort 等） | 2h | ❌ 待开始 |
| **2** | 将现有类改造为实现对应端口（保持原有逻辑） | 4h | ❌ 待开始 |
| **3** | 实现 EventBus 基础版，替换 AuditLogger 中的直接调用 | 2h | ❌ 待开始 |
| **4** | 将命令（ExplainCodeCommand 等）改造为插件，通过事件总线通信 | 4h | ❌ 待开始 |
| **5** | 实现 PluginManager，支持动态加载 | 4h | ❌ 待开始 |
| **6** | 逐步拆分其他功能为插件 | 按需 | ❌ 待开始 |

**总工时估算**: 16小时（不含阶段6）

---

## 六、实施建议

### 6.1 渐进式重构策略

1. **Phase 1: 端口定义** (Week 1)
   - 定义所有核心端口接口
   - 保持现有实现不变
   - 编写端口接口文档

2. **Phase 2: 适配器封装** (Week 2)
   - 将现有类包装为适配器
   - 实现端口接口
   - 单元测试验证

3. **Phase 3: EventBus MVP** (Week 3)
   - 实现基础事件总线
   - 支持发布/订阅
   - 迁移AuditLogger使用事件

4. **Phase 4: 插件化改造** (Week 4-5)
   - 将Commands改造为Plugins
   - 实现PluginManager
   - 动态加载测试

5. **Phase 5: 全面迁移** (Week 6+)
   - 逐步迁移所有功能
   - 性能优化
   - 文档完善

### 6.2 风险控制

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 重构引入Bug | 中 | 高 | 充分测试+灰度发布 |
| 性能下降 | 低 | 中 | 基准测试对比 |
| 团队学习成本 | 中 | 低 | 详细文档+代码评审 |
| 向后兼容问题 | 低 | 高 | 双轨运行+配置开关 |

---

## 七、总结

融合后的架构具有以下特点：

✅ **内核稳定**：记忆蒸馏、安全授权等核心能力不随功能增减而变化  
✅ **插件热插拔**：用户可启用/禁用功能，甚至编写自己的 Skill  
✅ **技术栈可替换**：通过适配器，LLM、数据库、Git 实现都可以随时更换  
✅ **事件解耦**：模块间无直接依赖，易于测试和维护  
✅ **符合小尾巴哲学**：半开放半封闭、记忆为核、渐进式智能  

这是小尾巴从"**单体插件**"走向"**可扩展平台**"的关键设计。你可以根据这个蓝图，逐步重构现有代码，而不会破坏当前已经可用的功能。

---

**维护者**: AI Assistant  
**最后更新**: 2026-04-17  
**参考**: [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
