# 小尾巴（XiaoWeiba）架构强制约束规范

**版本**: v1.0  
**生效时间**: Phase 2 完成后  
**约束原则**: 违反任何一条，代码不得合并

---

## 一、依赖方向约束（The Dependency Rule）

### 1.1 分层依赖矩阵

| 层级 | 可依赖的层 | 禁止依赖的层 |
|------|-----------|------------|
| **Presentation (UI)** | Application, Domain Ports | Infrastructure, Domain 实现 |
| **Application** | Domain Ports, Domain Models | Infrastructure |
| **Domain Ports** | 无（纯接口） | 任何实现层 |
| **Infrastructure** | Domain Ports, Domain Models | Application |

### 1.2 具体规则

```typescript
// ✅ 正确：UI 层只依赖 Application 和 Ports
import { IntentDispatcher } from '../core/application';
import { IEventBus } from '../core/ports';

// ❌ 错误：UI 层直接依赖 Infrastructure
import { EpisodicMemory } from '../core/memory/EpisodicMemory';  // 禁止
import { MemoryAdapter } from '../infrastructure/adapters';      // 禁止

// ✅ 正确：Infrastructure 实现 Domain Ports
export class MemoryAdapter implements IMemoryPort { }

// ❌ 错误：Infrastructure 反向依赖 Application
import { IntentDispatcher } from '../core/application';  // 禁止
```

### 1.3 ESLint 强制规则

已在 `.eslintrc.js` 中配置 `no-restricted-imports` 规则，详见配置文件。

---

## 二、通信路径约束（Event-Driven Only）

### 2.1 原则

**任何跨模块的读/写操作必须通过 IEventBus 发布/订阅事件完成，禁止直接方法调用。**

### 2.2 允许的直接调用

| 调用场景 | 是否允许 | 说明 |
|---------|---------|------|
| 同一模块内部方法调用 | ✅ 允许 | 如 IntentDispatcher 内部私有方法 |
| 通过端口接口调用 | ✅ 允许 | 如 `this.memoryPort.retrieveContext()` |
| 跨模块直接调用 | ❌ 禁止 | 如 ChatViewProvider 直接调用 EpisodicMemory.search() |
| 跨模块读取记忆 | ❌ 禁止 | 必须通过发布事件，由 MemoryAdapter 响应 |

### 2.3 正确示例

```typescript
// ✅ 正确：通过端口调用（端口是架构内的合法边界）
const context = await this.memoryPort.retrieveContext(intent);

// ✅ 正确：通过事件总线通信
this.eventBus.publish(new TaskCompletedEvent(intent, agentId, result, durationMs));

// ✅ 正确：订阅事件
this.eventBus.subscribe(AgentSelectedEvent, this.handleAgentSelected.bind(this));
```

### 2.4 禁止示例

```typescript
// ❌ 错误：直接调用记忆模块
const memories = await this.episodicMemory.search(query, { limit: 5 });

// ❌ 错误：直接调用其他模块的方法
this.sessionManager.addMessage(message);  // 应该发布事件
```

---

## 三、端口纯度约束（Port Purity）

### 3.1 原则

**所有端口接口（src/core/ports/）必须是纯 TypeScript 接口，不包含任何实现代码，不导入任何具体类。**

### 3.2 检查清单

```typescript
// ✅ 正确：纯接口
export interface IMemoryPort {
  retrieveContext(intent: Intent): Promise<MemoryContext>;
  recordTaskCompletion(event: TaskCompletedEvent): Promise<void>;
}

// ❌ 错误：接口文件包含实现
export class MemoryPortImpl implements IMemoryPort { ... }  // 禁止放在 ports/ 目录

// ❌ 错误：端口导入具体类
import { EpisodicMemory } from '../memory/EpisodicMemory';  // 禁止
```

### 3.3 目录约束

```
src/core/ports/
├── IMemoryPort.ts          # ✅ 纯接口
├── IEventBus.ts            # ✅ 纯接口
├── ILLMPort.ts             # ✅ 纯接口
├── IAgentRegistry.ts       # ✅ 纯接口
└── index.ts                # ✅ 只导出接口
```

**禁止在 ports/ 目录下出现任何 class 定义。**

---

## 四、依赖注入约束（Dependency Injection）

### 4.1 原则

**所有依赖必须通过构造函数注入，禁止在类内部使用 container.resolve() 或 new 创建依赖。**

### 4.2 正确示例

```typescript
// ✅ 正确：构造函数注入
export class IntentDispatcher {
  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IAgentRegistry') private agentRegistry: IAgentRegistry,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}
}

// ✅ 正确：在组合根（extension.ts）中组装依赖
const memoryAdapter = new MemoryAdapter(episodicMemory, preferenceMemory);
container.register('IMemoryPort', { useValue: memoryAdapter });
```

### 4.3 禁止示例

```typescript
// ❌ 错误：类内部解析依赖
export class BadClass {
  private memoryPort: IMemoryPort;
  
  constructor() {
    this.memoryPort = container.resolve('IMemoryPort');  // 禁止
  }
}

// ❌ 错误：类内部直接 new 具体实现
export class BadClass {
  private memoryAdapter = new MemoryAdapter();  // 禁止
}
```

---

## 五、命名与目录约束

### 5.1 目录结构约束

| 目录 | 允许的内容 | 禁止的内容 |
|------|-----------|-----------|
| `src/core/ports/` | 纯 TypeScript 接口 | class、enum、const |
| `src/core/domain/` | 领域模型（Intent, MemoryContext） | 端口接口、基础设施代码 |
| `src/core/events/` | DomainEvent 及其子类 | 业务逻辑 |
| `src/core/application/` | 应用服务（IntentDispatcher, MessageFlowManager） | 基础设施代码 |
| `src/infrastructure/adapters/` | 端口适配器实现 | 领域模型定义 |
| `src/agents/` | IAgent 的具体实现 | 基础设施代码 |
| `src/ui/` | VS Code UI 相关 | 业务逻辑、领域模型 |

### 5.2 命名约束

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| 端口接口 | I + 名词 + Port | IMemoryPort, IEventBus |
| 适配器 | 名词 + Adapter | MemoryAdapter, LLMAdapter |
| Agent | 名词 + Agent | ExplainCodeAgent, GenerateCommitAgent |
| 领域事件 | 名词 + 过去分词 + Event | TaskCompletedEvent, AgentSelectedEvent |

---

## 六、测试约束

### 6.1 单元测试依赖 Mock

**单元测试中，只 Mock 端口接口，不 Mock 具体实现。**

```typescript
// ✅ 正确：Mock 端口
const mockMemoryPort: jest.Mocked<IMemoryPort> = {
  retrieveContext: jest.fn(),
  recordTaskCompletion: jest.fn()
};

// ❌ 错误：Mock 具体实现
const mockEpisodicMemory: jest.Mocked<EpisodicMemory> = { ... };
```

### 6.2 覆盖率约束

| 层级 | 最低覆盖率 |
|------|-----------|
| Domain Models | 90% |
| Application Services | 85% |
| Infrastructure Adapters | 80% |
| Agents | 80% |

---

## 七、代码审查检查清单

**每个 PR 必须通过以下检查：**

- [ ] 无跨层直接导入（通过 ESLint 检查）
- [ ] 无 container.resolve() 在类内部使用
- [ ] 无直接调用 EpisodicMemory 等记忆模块
- [ ] 跨模块通信通过 IEventBus
- [ ] 新端口接口放在 src/core/ports/
- [ ] 依赖通过构造函数注入
- [ ] 命名符合规范
- [ ] 单元测试覆盖新增代码

---

## 八、架构守护工具配置

### 8.1 madge 依赖图检查

```bash
# 检查循环依赖
npx madge --circular --extensions ts src/

# 生成依赖图
npx madge --image deps.png src/
```

### 8.2 dependency-cruiser 规则

创建 `.dependency-cruiser.js` 配置文件（待实施）。

---

## 九、总结

这套强制约束覆盖了：

1. ✅ **依赖方向**：谁可以依赖谁
2. ✅ **通信路径**：事件驱动 vs 直接调用
3. ✅ **端口纯度**：接口与实现分离
4. ✅ **依赖注入**：构造函数注入 vs 容器解析
5. ✅ **命名与目录**：代码组织规范
6. ✅ **测试约束**：Mock 策略与覆盖率
7. ⏳ **自动化检查**：ESLint（已完成）、madge、dependency-cruiser（待配置）

**遵守这些约束，小尾巴的架构将长期保持清晰、可维护、可扩展。任何违反约束的代码都应该在代码审查阶段被拒绝。**

---

## 📝 当前状态（Phase 2 完成后）

### ✅ 已实施的约束

1. **ESLint no-restricted-imports 规则** - 禁止直接导入 EpisodicMemory、PreferenceMemory、LLMTool
2. **适配器层例外** - infrastructure/adapters 允许导入具体实现
3. **Chat/Completion 目录豁免** - 待重构代码暂时降级为警告
4. **Commands 目录删除** - patterns 规则禁止引用已删除的目录

### ⏳ 待实施的约束

1. **UI 层限制** - 禁止 ui/chat 目录导入 infrastructure
2. **Application 层限制** - 禁止 application 目录导入 infrastructure
3. **Infrastructure 层限制** - 禁止 infrastructure 导入 application/domain
4. **madge 循环依赖检查** - 集成到 CI/CD
5. **dependency-cruiser 规则** - 更细粒度的依赖检查
6. **测试覆盖率门禁** - 集成到 CI/CD

---

## 🚀 下一步行动

### Phase 3: 架构自动化守护

1. 配置 madge 检查循环依赖
2. 配置 dependency-cruiser 细粒度规则
3. 集成到 CI/CD 流水线
4. 配置测试覆盖率门禁
5. 重构 Chat/Completion 目录（Phase 2.5）

**预计工作量**: 2-3小时
