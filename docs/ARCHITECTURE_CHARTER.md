# 小尾巴（XiaoWeiba）终极架构宪章

**版本**: v2.0  
**生效日期**: 2026-05-03  
**地位**: 本文档是小尾巴项目的最高技术准则，由原《核心三原则》、《Cortex架构法典》、《架构强制约束规范》及《Cortex终极架构》合并、提炼而成。任何设计、开发、评审必须遵守本宪章。

---

## 📜 序言：价值观与设计哲学

在深入具体规则前，所有团队成员必须理解并认同以下根本原则。它们是项目"灵魂"所在，是所有技术决策的最终仲裁者。

### 原则一：职责边界清晰

**口诀**: 操作归记忆，对话归会话。

- **操作记忆**：负责记录用户执行的具体操作（如代码解释、提交生成），每条记忆必须有明确的 `taskType`、包含文件路径的 `summary`。
- **对话历史**：由 `SessionManager` 独立管理，用于多轮对话上下文，绝不污染操作记忆库。

**决策原点**：记录信息前，必须先问：这是用户执行的"事"，还是用户说的"话"？

### 原则二：测试驱动真实

**口诀**: 用真实反馈说话，用自然语言交流。

- **智能感**：AI的交互必须像一个真实的学徒，禁止使用"根据对话记录"、"根据历史记忆"等元话语。
- **纯净数据**：记忆系统必须区分"真实使用"和"调试噪音"，调试产生的失败、重复记录不应污染用户的记忆画像。

### 原则三：体验优先于架构

**口诀**: 用户感知到的，才是存在的。

- **数据即时性**：任何写操作必须即时持久化，确保数据永不丢失。
- **成长可见性**：系统的"学徒感"必须通过用户可感知的方式（如语气从"您"到"你"再到"咱们"）呈现。

**决策原点**：任何架构设计，必须优先回答"这对用户体验意味着什么"。

---

## 第一篇：架构铁律 (Architecture Codex)

### 第一章：依赖方向铁律 (The Dependency Rule)

代码依赖必须是从不稳定向稳定，从具体向抽象。**严禁反向依赖**。

| 规则编号 | 规则内容 | 正确示例 (✅) | 禁止示例 (❌) |
|---------|---------|--------------|--------------|
| **DEP-001** | UI层 (Presentation) 只依赖应用层 (Application) 和领域端口 (Domain Ports)。 | `import { IntentDispatcher } from '../core/application'` | `import { MemoryAdapter } from '../infrastructure'` (直接依赖基础设施) |
| **DEP-002** | 应用层 (Application) 只依赖领域端口和模型。 | `constructor(@inject('IMemoryPort') private memory: IMemoryPort)` | `import { EpisodicMemory } from '../memory'` (依赖具体实现) |
| **DEP-003** | 基础设施层 (Infrastructure) 实现领域端口，可依赖外部SDK。 | `export class MemoryAdapter implements IMemoryPort {}` | 基础设施层反向导入应用层服务。 |
| **DEP-004** | 端口层 (Ports) 必须是纯抽象接口，不含任何实现。 | `export interface IMemoryPort { ... }` | 在 `ports/` 目录下出现 `class`、`enum` 或具体逻辑。 |

### 第二章：通信路径铁律 (Event-Driven Communication)

跨模块的读/写操作必须通过标准信道（`IEventBus` / 端口接口）完成，**严禁模块间直接方法调用**。

| 规则编号 | 规则内容 | 正确方式 (✅) | 禁止方式 (❌) |
|---------|---------|--------------|--------------|
| **COM-001** | 跨模块通信必须通过 IEventBus 发布/订阅领域事件。 | `this.eventBus.publish(new TaskCompletedEvent(...))` | `this.sessionManager.addMessage(...)` (直接调用其他模块方法) |
| **COM-002** | Agent 之间严禁直接通信。 | 一个Agent发布事件，另一个Agent订阅该事件。 | `codeGenerator.execute(searchResult)` |
| **COM-003** | 所有记忆读写必须通过MemoryPort统一接口。 | `const ctx = await this.memoryPort.retrieveContext(intent)` | `this.episodicMemory.search(query)` |
| **COM-004** | 工具调用必须通过ToolGateway进行权限校验和审计。 | Agent发起Function Call → ToolGateway校验并执行。 | Agent直接执行系统命令或文件操作。 |

### 第三章：记忆系统隔离铁律 (Memory Isolation)

四层记忆对应用户心智的不同侧面，必须物理或逻辑隔离，**严禁信息污染**。

| 记忆层 | 存储内容 | 写入者 | 读取/检索 |
|--------|---------|--------|----------|
| **操作记忆** | 用户执行的具体操作轨迹、任务历史（含 taskType）。 | 执行引擎 (Application) | 混合检索 (向量+关键词+时间衰减) |
| **会话记忆** | 多轮对话的上下文。 | SessionManager | 当前会话内直接读取 |
| **偏好记忆** | 用户偏好、技术栈倾向、习惯。 | 偏好学习模块 | 注入System Prompt |
| **知识库** | 外部知识、文档摘要、最佳实践。 | 认知引擎 | 语义检索 |

**MEM-001**: 对话历史绝不写入操作记忆。

**MEM-002**: 在写入记忆前，必须判断是"操作"还是"对话"。

**MEM-003**: 记忆的 summary 必须包含足够上下文（如文件路径），不能过于笼统。

### 第四章：Agent行为准则 (Agent Behavior)

所有Agent必须遵守统一的行为规范，确保可预测、可审计。

| 规则编号 | 规则内容 |
|---------|---------|
| **AG-001** | 每个Agent必须声明唯一的 `id` (kebab-case) 和 `supportedIntents`。 |
| **AG-002** | 所有Agent必须继承统一基类，遵循 `Think→Act→Observe` 标准循环。 |
| **AG-003** | Agent无权决定信任级别。高风险工具（写文件、执行命令）必须通过ToolGateway进行权限验证。 |
| **AG-004** | Agent必须对错误进行捕获，并尝试自修复，最多重试3次，之后必须向用户报告，不得无限循环。 |
| **AG-005** | System Prompt必须包含行为约束，明确禁止金钱交易、自主发布代码等越权操作。 |

### 第五章：安全强制执行 (Security Enforcement)

安全是基础要求，所有外部操作必须经过授权和审计。

| 规则编号 | 规则内容 | 技术实现 |
|---------|---------|---------|
| **SEC-001** | 任何写操作或命令执行，必须携带有效的权限凭证，凭证有效期5分钟，一次性使用。 | 通过ToolGateway进行HMAC签名等防篡改验证。 |
| **SEC-002** | 所有系统命令在执行前必须经过命令拦截器校验，匹配黑名单的直接拦截。 | 正则模式匹配黑名单/白名单。 |
| **SEC-003** | 所有操作须记录到审计日志，日志防篡改，保留30天。 | 集中式审计日志服务。 |

---

## 第二篇：工程实施规范 (Implementation Standards)

### 第六章：命名与目录约束

| 类型 | 命名规范 | 所属目录 | 示例 |
|------|---------|---------|------|
| **端口接口** | I + 名词 + Port | `src/core/ports/` | `IMemoryPort`, `IEventBus` |
| **领域模型** | 名词 | `src/core/domain/` | `Intent`, `MemoryContext` |
| **领域事件** | 名词 + 过去分词 + Event | `src/core/events/` | `TaskCompletedEvent`, `AgentSelectedEvent` |
| **应用服务** | 名词 + Service/Manager | `src/core/application/` | `IntentDispatcher`, `SessionManager` |
| **适配器** | 名词 + Adapter | `src/infrastructure/adapters/` | `MemoryAdapter`, `LLMAdapter` |
| **Agent** | 功能 + Agent | `src/agents/` | `ExplainCodeAgent`, `GenerateCommitAgent` |
| **Agent ID** | kebab-case | - | `explain-code-agent`, `chat-agent` |

### 第七章：依赖注入约束

所有依赖必须通过构造函数注入，**严禁在类内部自行创建或解析依赖**。

```typescript
// ✅ 正确：构造函数注入
export class IntentDispatcher {
  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}
}

// ❌ 错误：类内部解析或新建
export class BadClass {
  private memoryPort = container.resolve('IMemoryPort'); // 禁止
  private adapter = new MemoryAdapter(); // 禁止
}
```

**关键约束**：在组合根（`extension.ts` 或 `main.ts`）中，必须确保被依赖的对象先创建、先注册。

### 第八章：测试约束

| 层级 | 最低覆盖率 | Mock策略 |
|------|-----------|---------|
| **Domain Models** | 90% | Mock 端口接口 (e.g., `jest.Mocked<IMemoryPort>`) |
| **Application Services** | 85% | Mock 端口接口 |
| **Infrastructure Adapters** | 80% | Mock 外部SDK |
| **Agents** | 80% | Mock 端口接口 |

**原则**：单元测试只Mock端口接口，绝不Mock具体实现。

**对话测试**：新功能合并前，必须通过三轮以上自然对话测试，确保AI回复自然、符合"学徒"身份。

---

## 第三篇：代码审查与自动化

### 第九章：代码审查检查清单

每个 PR 必须通过以下检查：

- [ ] **依赖方向**：无跨层直接导入（通过ESLint规则 `no-restricted-imports` 强制）。
- [ ] **通信路径**：无直接调用EpisodicMemory；跨模块通信通过IEventBus。
- [ ] **端口纯度**：新端口接口位于`src/core/ports/`，且无实现代码。
- [ ] **依赖注入**：无 `container.resolve()` 在类内部使用；组合根中对象创建顺序正确；单例对象使用 `registerSingleton()`。
- [ ] **命名合规**：命名符合规范（IPort, Adapter, Agent, Event）；Agent ID使用kebab-case。
- [ ] **安全**：写操作携带权限凭证；命令执行经过拦截器校验。
- [ ] **测试**：单元测试覆盖新增代码，Mock策略正确，覆盖率不低于阈值。

### 第十章：自动化架构守护

**ESLint**: 已配置 `no-restricted-imports` 规则，禁止直接导入 `EpisodicMemory`, `PreferenceMemory` 及 `infrastructure` 层代码。

**Madge (待集成)**:
```bash
npx madge --circular --extensions ts src/ # 检查循环依赖
```

**dependency-cruiser (待集成)**: 配置细粒度规则，如"infrastructure不得依赖application"。

---

## 附件：未来发展蓝图 (Cortex终极架构指引)

本项目的产品形态正向更宏大的Cortex思想熔炉演进。这是一个全自主的AI开发平台，其架构理念是当前小尾巴项目的前进方向。

### 三大核心引擎

1. **概念具象化引擎**: 将用户模糊概念转化为结构化蓝图。
2. **全自主执行引擎**: 将蓝图自动实现为可运行软件，包含任务分解、Agent调度、错误自修复。
3. **思维可视化引擎**: 让用户理解AI的决策过程，建立信任。

### 技术基座

利用大模型的百万级上下文、思考模式、严格函数调用、FIM补全等能力。成本控制通过上下文缓存和混合检索策略实现。

### 最终形态

用户成为纯粹的"创造者"和"决策者"，表达概念，Cortex将其熔炼为现实。

> **"这就是编码的终结，创造的开始。"**

本文档是通往这一终极形态的坚实基座。当前所有工程实践都必须符合本宪章的规定。

---

## 📚 相关文档

- [核心三原则](./CORE_PRINCIPLES.md) - 原始版本（已整合）
- [Cortex架构法典](./CORTEX_ARCHITECTURE_CODEX.md) - 原始版本（已整合）
- [架构强制约束规范](./architecture-constraints.md) - 详细实施指南
- [意图驱动架构](./INTENT_DRIVEN_ARCHITECTURE.md) - 系统设计文档
- [记忆驱动架构](./MEMORY_DRIVEN_ARCHITECTURE.md) - 记忆系统设计
- [架构合规性检查报告](./ARCHITECTURE_COMPLIANCE_REPORT.md) - 当前合规状态

---

**维护者**: 小尾巴团队  
**最后更新**: 2026-05-03  
**下次审查**: 2026-06-03（或重大架构变更后）
