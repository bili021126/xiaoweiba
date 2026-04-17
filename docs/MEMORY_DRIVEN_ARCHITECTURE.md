# 以记忆为核心的融合架构 - 详细设计

**创建时间**: 2026-04-17  
**版本**: v1.0  
**关联文档**: [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)

---

## 一、核心：记忆引擎的驱动能力

记忆引擎不仅仅是存储和检索，它**主动驱动**整个系统的行为。

### 1.1 记忆变化 → 触发事件 → 其他模块响应

| 记忆变化 | 发布的事件 | 订阅者响应 |
|---------|-----------|-----------|
| 新情景记忆记录 | `memory.episodic.added` | 审计日志记录；UI更新记忆计数 |
| 偏好记忆置信度变化 | `memory.preference.updated` | 上下文构建器重新加载偏好；代码生成插件调整风格 |
| 记忆衰减（权重降低） | `memory.decayed` | 归档模块可将其移至冷存储 |
| 记忆被检索命中 | `memory.retrieved` | 统计模块记录命中率，用于优化检索权重 |

### 1.2 功能模块通过记忆驱动（示例）

#### 代码解释插件的工作流程（以记忆为核心）

```
用户选中代码
   ↓
插件向记忆引擎请求：retrieve(query: "代码解释偏好")
   ↓
记忆引擎返回：用户偏好"喜欢详细解释，包含示例"
   ↓
插件调用 LLM 时注入该偏好
   ↓
解释生成后，插件调用记忆引擎：record(episodic: { taskType: 'CODE_EXPLAIN', ... })
   ↓
记忆引擎发布 memory.episodic.added 事件
   ↓
审计日志插件订阅该事件，记录操作
   ↓
偏好学习插件订阅该事件，分析用户是否满意，更新偏好置信度
```

#### Git 提交生成插件（以记忆为核心）

```
用户执行命令
   ↓
插件检索记忆：retrieve("提交信息风格")
   ↓
记忆返回：用户偏好 Conventional Commits，scope 常用 feat, fix
   ↓
插件生成提交信息时遵循该风格
   ↓
提交成功后，记录情景记忆
   ↓
如果用户手动修改了提交信息，记忆引擎通过对比记录修正偏好
```

---

## 二、事件总线的调整（以记忆事件为中枢）

事件总线仍然存在，但**核心事件围绕记忆操作**，而不是通用任务。其他事件作为辅助。

### 2.1 核心记忆事件（优先级最高）

```typescript
interface MemoryEvent {
  type: 
    | 'memory.episodic.added'      // 新情景记忆
    | 'memory.preference.updated'  // 偏好更新
    | 'memory.semantic.added'      // 语义记忆添加
    | 'memory.retrieved'           // 记忆被检索
    | 'memory.decayed';            // 记忆衰减
  
  memoryId: string;
  memoryType: 'episodic' | 'preference' | 'semantic';
  payload: any;
}
```

### 2.2 辅助事件（功能模块之间）

```typescript
interface TaskEvent {
  type: 'task.started' | 'task.completed';
  taskId: string;
  taskType: string;
}
```

### 2.3 关键原则

**所有功能模块必须通过记忆事件与核心交互，而不能绕过记忆直接通信。**

例如：
- ❌ 代码解释插件不能直接调用审计日志插件
- ✅ 而是通过记录记忆事件，审计插件监听记忆事件来记录
- ✅ 两个插件之间如果需要协作，也通过记忆间接实现（一个插件写入记忆，另一个插件读取记忆变化）

---

## 三、端口与适配器的调整（以记忆为接口）

端口不再只是"技术抽象"，而是**记忆能力的延伸**。

### 3.1 记忆驱动端口定义

| 端口 | 本质 | 说明 |
|------|------|------|
| **LLMPort** | 记忆驱动的 LLM 调用 | 调用 LLM 前，自动从记忆检索相关偏好和上下文 |
| **GitPort** | 记忆驱动的 Git 操作 | 执行 Git 操作后，自动记录到情景记忆 |
| **FilePort** | 记忆驱动的文件操作 | 文件读取/写入可与记忆关联（如记录修改历史） |
| **SearchPort** | 记忆驱动的网络搜索 | 搜索结果自动存入语义记忆 |

### 3.2 适配器实现要求

每个适配器实现时，**必须注入记忆引擎**，并在适当时候调用记忆的 `record` 或 `retrieve`。

```typescript
class DeepSeekAdapter implements LLMPort {
  constructor(private memoryEngine: MemoryEngine) {}
  
  async chat(prompt: string): Promise<string> {
    // 1. 从记忆检索相关上下文
    const context = await this.memoryEngine.retrieve({
      query: prompt,
      limit: 3
    });
    
    // 2. 增强 prompt
    const enhancedPrompt = this.enhanceWithMemory(prompt, context);
    
    // 3. 调用 API
    const response = await this.callAPI(enhancedPrompt);
    
    // 4. 记录调用历史到记忆
    await this.memoryEngine.record({
      taskType: 'LLM_CALL',
      summary: `Called DeepSeek with ${prompt.length} chars`,
      outcome: 'SUCCESS'
    });
    
    return response;
  }
}
```

---

## 四、插件开发规范（以记忆为核心）

插件必须遵循以下规范：

### 4.1 标准工作流程

1. **输入**：从记忆引擎检索所需偏好和上下文
2. **执行**：调用端口（LLM、Git 等）完成具体任务
3. **输出**：将任务结果记录到记忆引擎（情景记忆或偏好记忆）
4. **不直接调用其他插件**：所有协作通过记忆事件或共享记忆实现

### 4.2 插件示例（伪代码）

```typescript
class ExplainCodePlugin {
  constructor(
    private memory: MemoryEngine,
    private llmPort: LLMPort
  ) {}
  
  async execute(selectedCode: string) {
    // 1. 从记忆检索偏好
    const preferences = await this.memory.retrieve({
      query: 'code_explain_style',
      taskType: 'CODE_EXPLAIN'
    });
    
    // 2. 调用 LLM（通过端口）
    const explanation = await this.llmPort.chat(
      promptWithPreferences(preferences, selectedCode)
    );
    
    // 3. 记录情景记忆
    await this.memory.record({
      taskType: 'CODE_EXPLAIN',
      summary: `解释了 ${selectedCode.slice(0, 50)}...`,
      entities: extractEntities(selectedCode),
      outcome: 'SUCCESS'
    });
    
    // 4. 发布事件（可选，用于通知其他插件）
    eventBus.publish({ 
      type: 'explanation.generated', 
      explanation 
    });
  }
}
```

### 4.3 禁止行为

❌ **禁止直接依赖其他插件**
```typescript
// 错误示例
import { AuditLogger } from '../security/AuditLogger';

class MyPlugin {
  constructor(private audit: AuditLogger) {} // ❌ 不允许
}
```

✅ **正确做法：通过记忆事件**
```typescript
// 正确示例
class MyPlugin {
  constructor(private memory: MemoryEngine) {}
  
  async execute() {
    // 记录到记忆，审计插件会自动监听记忆事件
    await this.memory.record({
      taskType: 'MY_TASK',
      summary: '...',
      outcome: 'SUCCESS'
    });
  }
}
```

---

## 五、与现有代码的差距与迁移

### 5.1 当前代码状态

| 组件 | 现状 | 问题 |
|------|------|------|
| **EpisodicMemory** | 已实现记录和检索 | 尚未作为核心驱动（其他模块主动调用它，而不是被它驱动） |
| **事件总线** | 缺失 | 记忆变化无法主动通知其他模块 |
| **功能模块** | 直接依赖具体实现 | ExplainCodeCommand 直接调用 EpisodicMemory，而不是通过端口 |
| **审计日志** | AuditLogger 被多处直接调用 | 应该改为订阅记忆事件 |

### 5.2 迁移步骤（保留记忆核心）

#### Phase 1: 定义记忆事件 (2h)

```typescript
// src/core/memory/events.ts
export enum MemoryEventType {
  EPISODIC_ADDED = 'memory.episodic.added',
  PREFERENCE_UPDATED = 'memory.preference.updated',
  SEMANTIC_ADDED = 'memory.semantic.added',
  RETRIEVED = 'memory.retrieved',
  DECAYED = 'memory.decayed'
}

export interface MemoryEvent {
  type: MemoryEventType;
  memoryId: string;
  memoryType: 'episodic' | 'preference' | 'semantic';
  timestamp: number;
  payload?: any;
}
```

#### Phase 2: 实现事件总线 (2h)

```typescript
// src/core/eventbus/EventBus.ts
import { MemoryEvent } from './events';

export class EventBus {
  private subscribers: Map<string, Function[]> = new Map();
  
  publish(event: MemoryEvent): void {
    const handlers = this.subscribers.get(event.type) || [];
    handlers.forEach(handler => handler(event));
  }
  
  subscribe(eventType: string, handler: Function): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }
}
```

#### Phase 3: EpisodicMemory 集成事件总线 (2h)

```typescript
// src/core/memory/EpisodicMemory.ts
export class EpisodicMemory {
  constructor(private eventBus: EventBus) {}
  
  async record(memory: Omit<EpisodicMemoryRecord, 'id'>): Promise<string> {
    // ... 原有记录逻辑 ...
    
    const id = await this.saveToDatabase(memory);
    
    // 发布事件
    this.eventBus.publish({
      type: MemoryEventType.EPISODIC_ADDED,
      memoryId: id,
      memoryType: 'episodic',
      timestamp: Date.now(),
      payload: { taskType: memory.taskType, summary: memory.summary }
    });
    
    return id;
  }
}
```

#### Phase 4: 审计日志改为订阅记忆事件 (2h)

```typescript
// src/core/security/AuditLogger.ts
export class AuditLogger {
  constructor(private eventBus: EventBus) {
    // 订阅记忆事件
    this.eventBus.subscribe(MemoryEventType.EPISODIC_ADDED, this.onMemoryAdded);
    this.eventBus.subscribe(MemoryEventType.RETRIEVED, this.onMemoryRetrieved);
  }
  
  private onMemoryAdded = async (event: MemoryEvent) => {
    await this.log('memory_added', 'success', 0, {
      memoryId: event.memoryId,
      memoryType: event.memoryType
    });
  };
  
  private onMemoryRetrieved = async (event: MemoryEvent) => {
    await this.log('memory_retrieved', 'success', 0, {
      memoryId: event.memoryId
    });
  };
}
```

#### Phase 5: 功能模块改造 (4h)

将 ExplainCodeCommand 等改造为通过记忆端口交互：

```typescript
// src/commands/ExplainCodeCommand.ts
export class ExplainCodeCommand {
  constructor(
    private memory: MemoryEngine,
    private llmPort: LLMPort
  ) {}
  
  async execute(code: string) {
    // 从记忆检索偏好
    const prefs = await this.memory.retrieve({ 
      query: 'code explanation preference' 
    });
    
    // 调用 LLM
    const result = await this.llmPort.chat(buildPrompt(code, prefs));
    
    // 记录到记忆（自动触发审计）
    await this.memory.record({
      taskType: 'CODE_EXPLAIN',
      summary: code.slice(0, 100),
      outcome: 'SUCCESS'
    });
    
    return result;
  }
}
```

#### Phase 6: 引入插件管理器 (4h)

最后一步，将功能模块拆分为独立插件，支持动态加载。

---

## 六、总结

以记忆为核心的融合架构，将**记忆引擎置于中央**，所有功能模块作为记忆的消费者和生产者，通过事件总线响应记忆变化。

### 核心优势

✅ **记忆主动驱动**：不是被动存储，而是系统行为的驱动力  
✅ **单一真理来源**：所有数据最终都汇聚到记忆系统  
✅ **松耦合**：插件间不直接依赖，通过记忆间接协作  
✅ **可扩展**：新增功能只需实现记忆端口，无需修改核心  
✅ **符合小尾巴定位**：记忆蒸馏是核心差异化，其他功能只是记忆的端口  

这比普通的六边形架构更贴合小尾巴的定位——**记忆为核，功能为端口**。

---

**维护者**: AI Assistant  
**最后更新**: 2026-04-17  
**参考**: [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
