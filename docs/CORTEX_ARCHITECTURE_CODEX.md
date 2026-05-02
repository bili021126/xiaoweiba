# Cortex 架构法典（约束与纪律）

**版本**: v1.0  
**生效日期**: 2026-05-02  
**地位**: 本文件是 Cortex 项目的工程强制约束，与《小尾巴重构核心三原则》共同构成项目治理的最高准则。所有设计、开发、评审必须遵守本法典。

---

## 📜 法典总纲

Cortex 架构法典定义了七大约束铁律，确保系统具备：
- **清晰的依赖边界** - 防止架构腐化
- **规范的通信路径** - 保证模块解耦
- **纯粹的端口抽象** - 实现依赖倒置
- **隔离的记忆系统** - 避免信息污染
- **统一的 Agent 行为** - 确保可预测性
- **强制执行的安全** - 建立信任基础
- **严格的测试标准** - 保障质量底线

**违反任何一条铁律，代码不得合并。**

---

## 一、依赖方向铁律 (Dependency Direction)

### 原则
**代码依赖必须是从不稳定向稳定，从具体向抽象，严禁反向依赖。**

### 规则矩阵

| 规则编号 | 规则内容 | 正确示例 | 禁止示例 |
|---------|---------|---------|---------|
| **DEP-001** | 应用层 (Application) 只能依赖领域层 (Domain) 和端口层 (Ports) | MetaAgent 导入 IMemoryPort 接口 | MetaAgent 导入 SQLiteMemoryAdapter 具体实现 |
| **DEP-002** | 基础设施层 (Infrastructure) 实现端口层接口，允许依赖外部SDK | MemoryAdapter 实现 IMemoryPort 接口，并导入 better-sqlite3 | 基础设施层导入应用层服务 |
| **DEP-003** | 前端 (Frontend) 不直接调用任何 Agent，必须通过 Meta-Agent 或 API 网关 | Web UI 通过 JSON-RPC 调用 /api/concept/submit | Web UI 直接实例化 CodeGeneratorAgent |
| **DEP-004** | 端口层 (Ports) 必须是纯抽象的接口，不含任何实现逻辑 | IAgentRegistry 定义 find_agents_for_intent() 方法 | 在 IAgentRegistry 中实现具体的注册逻辑 |

### 分层依赖图

```
┌─────────────────────────────────────┐
│   Presentation Layer (UI)           │  ← VSCode Extension, Webview
│   可依赖: Application, Domain Ports │
└──────────────┬──────────────────────┘
               │ 依赖
┌──────────────▼──────────────────────┐
│   Application Layer                 │  ← IntentDispatcher, SessionManager
│   可依赖: Domain Ports, Models      │
└──────────────┬──────────────────────┘
               │ 依赖
┌──────────────▼──────────────────────┐
│   Domain Layer                      │  ← Intent, MemoryContext, Events
│   可依赖: 无 (纯业务逻辑)            │
└──────────────┬──────────────────────┘
               │ 实现
┌──────────────▼──────────────────────┐
│   Infrastructure Layer              │  ← MemoryAdapter, LLMAdapter
│   可实现: Domain Ports              │
│   可依赖: External SDKs             │
└─────────────────────────────────────┘
```

### ESLint 强制规则

已在 `.eslintrc.js` 中配置 `no-restricted-imports` 规则：

```javascript
'no-restricted-imports': ['error', {
  patterns: [
    {
      group: ['**/core/memory/EpisodicMemory'],
      message: '禁止直接导入记忆实现，请使用 IMemoryPort 接口'
    },
    {
      group: ['**/core/memory/PreferenceMemory'],
      message: '禁止直接导入记忆实现，请使用 IMemoryPort 接口'
    },
    {
      group: ['**/infrastructure/**'],
      message: '禁止从非适配器层导入基础设施代码'
    }
  ]
}]
```

### 验证命令

```bash
# 检查跨层违规导入
grep -r "import.*from.*infrastructure" src/core/application/  # 应无结果
grep -r "import.*from.*application" src/infrastructure/        # 应无结果

# 使用 madge 检查循环依赖
npx madge --circular --extensions ts src/
```

---

## 二、通信路径铁律 (Communication Path)

### 原则
**跨模块通信必须通过标准信道（EventBus / 端口接口），严禁模块间直接方法调用。**

### 规则矩阵

| 规则编号 | 规则内容 | 正确方式 | 禁止方式 |
|---------|---------|---------|---------|
| **COM-001** | 子 Agent 之间严禁直接通信 | 发布 KnowledgeGapDetected 事件，由 ProactiveEngine 处理 | CodeGenerator 直接调用 WebSearcher 搜索 |
| **COM-002** | 工具调用必须通过 ToolGateway | Agent 发起 Function Call → ToolGateway 校验 TaskToken → 执行 | Agent 内部直接 import os; os.system(cmd) |
| **COM-003** | 记忆读写必须通过 MemoryPortal 统一接口 | ConceptParser 调用 memory_portal.retrieve_concept() | 各模块直接操作 SQLite 或 ChromaDB |
| **COM-004** | 前端与核心通信仅使用 JSON-RPC 2.0 over WebSocket/HTTP | `{"jsonrpc":"2.0","method":"concept.submit",...}` | 直接通过 HTTP GET 触发内部方法 |

### 允许的直接调用

| 调用场景 | 是否允许 | 说明 |
|---------|---------|------|
| 同一模块内部方法调用 | ✅ 允许 | 如 IntentDispatcher 内部私有方法 |
| 通过端口接口调用 | ✅ 允许 | 如 `this.memoryPort.retrieveContext()` |
| 跨模块直接调用 | ❌ 禁止 | 如 ChatViewProvider 直接调用 EpisodicMemory.search() |
| 跨模块读取记忆 | ❌ 禁止 | 必须通过发布事件，由 MemoryAdapter 响应 |

### 正确示例

```typescript
// ✅ 正确：通过端口调用（端口是架构内的合法边界）
const context = await this.memoryPort.retrieveContext(intent);

// ✅ 正确：通过事件总线通信
this.eventBus.publish(new TaskCompletedEvent(intent, agentId, result, durationMs));

// ✅ 正确：订阅事件
this.eventBus.subscribe(AgentSelectedEvent, this.handleAgentSelected.bind(this));
```

### 禁止示例

```typescript
// ❌ 错误：直接调用记忆模块
const memories = await this.episodicMemory.search(query, { limit: 5 });

// ❌ 错误：直接调用其他模块的方法
this.sessionManager.addMessage(message);  // 应该发布事件

// ❌ 错误：Agent 之间直接调用
await codeGeneratorAgent.execute(searchResult);  // 应该通过 EventBus
```

---

## 三、端口纯度铁律 (Port Purity)

### 原则
**端口是系统边界的抽象契约，必须保持绝对纯粹。**

### 规则矩阵

| 规则编号 | 规则内容 | 要求 |
|---------|---------|------|
| **PORT-001** | 端口文件 (如 port/IMemoryPort.ts) 内只能包含抽象类或 Protocol 定义 | 检查：无 class 的具体实现 |
| **PORT-002** | 端口接口中使用的数据类型必须是领域模型 (如 Intent, MemoryContext) 或基础类型 | 不能出现 pandas.DataFrame 等特定库的数据结构 |
| **PORT-003** | 新增端口必须经过架构评审 | 防止端口泛滥和边界模糊 |

### 目录约束

```
src/core/ports/
├── IMemoryPort.ts          # ✅ 纯接口
├── IEventBus.ts            # ✅ 纯接口
├── ILLMPort.ts             # ✅ 纯接口
├── IAgentRegistry.ts       # ✅ 纯接口
└── index.ts                # ✅ 只导出接口
```

**禁止在 ports/ 目录下出现任何 class 定义。**

### 正确示例

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

---

## 四、记忆系统隔离铁律 (Memory Isolation)

### 原则
**四层记忆对应用户心智的不同侧面，必须物理或逻辑隔离，严禁信息污染。**

### 规则矩阵

| 规则编号 | 规则内容 | 职责边界 |
|---------|---------|---------|
| **MEM-001** | ConceptMemory 存储用户沉淀的项目概念和架构选择，只能由概念具象化引擎写入 | 思想 → 概念 |
| **MEM-002** | SkillMemory 存储成功的执行模式，由系统自动捕捉或用户手动创建 | 成功 → 技能 |
| **MEM-003** | EpisodicMemory 存储操作轨迹（指令、工具调用结果），只能由执行引擎写入 | 操作 → 轨迹 |
| **MEM-004** | KnowledgeBase 存储外部引入的知识摘要，由认知突破引擎管理 | 外部 → 内部 |
| **MEM-005** | 混合检索必须遵循四因子加权公式，禁止在不同记忆层之间复制数据以满足检索需求 | - |

### 记忆层架构图

```
┌──────────────────────────────────────────┐
│         四层记忆架构                      │
├──────────────────────────────────────────┤
│  ConceptMemory    │ 项目概念、架构决策     │  ← 概念具象化引擎写入
├──────────────────────────────────────────┤
│  SkillMemory      │ 成功模式、最佳实践     │  ← 自动捕捉/手动创建
├──────────────────────────────────────────┤
│  EpisodicMemory   │ 操作轨迹、任务历史     │  ← 执行引擎写入
├──────────────────────────────────────────┤
│  KnowledgeBase    │ 外部知识、文档摘要     │  ← 认知突破引擎管理
└──────────────────────────────────────────┘
              ↓
    HybridRetriever (四因子加权)
              ↓
        MemoryContext
```

### 正确示例

```typescript
// ✅ 正确：通过端口写入情景记忆
await this.memoryPort.recordTaskCompletion({
  intent,
  agentId: 'explain-code-agent',
  result: success,
  durationMs: elapsed
});

// ✅ 正确：混合检索遵循加权公式
const context = await this.memoryPort.retrieveContext(intent);
// 内部实现：score = α*recency + β*frequency + γ*relevance + δ*user_feedback
```

### 禁止示例

```typescript
// ❌ 错误：直接写入 EpisodicMemory
await this.episodicMemory.insert({...});  // 必须通过端口

// ❌ 错误：跨记忆层复制数据
const skills = this.episodicMemory.getAll().map(toSkill);  // 禁止
```

---

## 五、Agent行为准则 (Agent Behavior)

### 原则
**所有Agent必须遵守统一的自主性规范，确保行为可预测、可审计。**

### 规则矩阵

| 规则编号 | 规则内容 |
|---------|---------|
| **AG-001** | 每个 Agent 必须声明 supported_intents，只能处理系统已注册的意图类型。 |
| **AG-002** | 所有 Agent 必须继承 AutonomousAgent 基类，遵循 Think→Act→Observe 的标准循环。 |
| **AG-003** | Agent 执行工具调用时，必须使用 Function Calling 返回标准化的 tool_calls 数组，禁止通过解析文本内容决定工具调用。 |
| **AG-004** | Agent 无权决定信任级别。高风险工具（如写文件、执行命令）在执行前必须通过 ToolGateway 进行权限验证。 |
| **AG-005** | Agent 必须对意外错误进行捕获，并尝试通过 ErrorRecovery 模块自修复，最多重试 3 次后必须向用户报告失败，不得无限循环。 |
| **AG-006** | Agent 的 System Prompt 必须包含行为约束，明确禁止进行金钱交易、自主发布代码、执行危险命令等越权操作。 |

### Agent 标准模板

```typescript
import { IAgent, AgentResult } from '../core/agent/IAgent';
import { Intent } from '../core/domain/Intent';
import { MemoryContext } from '../core/domain/MemoryContext';

export class ExplainCodeAgent implements IAgent {
  // ✅ AG-001: 声明支持的意图
  readonly id = 'explain-code-agent';
  readonly name = '代码解释助手';
  readonly supportedIntents = ['EXPLAIN_CODE'];

  constructor(
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('ILLMPort') private llmPort: ILLMPort,
    @inject('IEventBus') private eventBus: IEventBus
  ) {}

  // ✅ AG-002: 遵循 Think→Act→Observe 循环
  async execute(params: {
    intent: Intent;
    memoryContext: MemoryContext;
  }): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // Think: 分析意图
      const code = params.intent.payload.code;
      
      // Act: 调用 LLM
      const response = await this.llmPort.chat([
        { role: 'system', content: this.getSystemPrompt() },  // ✅ AG-006
        { role: 'user', content: code }
      ]);
      
      // Observe: 记录结果
      const duration = Date.now() - startTime;
      await this.memoryPort.recordAgentExecution(
        this.id,
        'EXPLAIN_CODE',
        true,
        duration
      );
      
      return {
        success: true,
        data: response.content,
        modelId: response.modelId,
        durationMs: duration
      };
      
    } catch (error) {
      // ✅ AG-005: 错误处理，最多重试3次
      await this.handleError(error, params);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ✅ AG-006: System Prompt 包含行为约束
  private getSystemPrompt(): string {
    return `你是一个专业的代码解释助手。

行为约束：
- 禁止执行任何系统命令
- 禁止访问网络资源
- 禁止修改用户文件
- 仅提供代码解释和建议
- 遇到不确定的情况，明确告知用户`;
  }

  private async handleError(error: Error, params: any): Promise<void> {
    // 实现重试逻辑（最多3次）
    // 记录错误到审计日志
  }
}
```

---

## 六、安全强制执行 (Security Enforcement)

### 原则
**安全不是可选项，是基础要求。所有外部操作必须经过授权和审计。**

### 规则矩阵

| 规则编号 | 规则内容 | 技术实现 |
|---------|---------|---------|
| **SEC-001** | 任何写操作或命令执行，必须携带有效的 TaskToken。Token 有效期 5 分钟，一次性使用。 | TaskToken 包含 HMAC 签名，ToolGateway 验证 |
| **SEC-002** | 所有 Shell 命令在执行前必须经过 CommandInterceptor 校验，匹配黑名单的直接拦截，匹配白名单的放行。 | 正则模式匹配，黑名单优先 |
| **SEC-003** | 自主生成的代码必须在沙箱中执行后才能交付。沙箱层级按任务风险动态选择。 | L1 (临时目录) / L2 (Git 分支) / L3 (Docker 容器) |
| **SEC-004** | 用户信任级别根据采纳行为自动进化，但 L3 交付确认点不可被任何信任等级跳过。 | 信任模型：新手→熟悉→信任→专家 |
| **SEC-005** | 所有操作必须记录到审计日志，日志使用 HMAC 签名防篡改，保留 30 天。 | AuditLogger 集中管理 |

### TaskToken 机制

```typescript
// ✅ 正确：生成 TaskToken
const token = await this.taskTokenManager.create({
  operation: 'write_file',
  filePath: '/path/to/file.ts',
  expiresAt: Date.now() + 5 * 60 * 1000,  // 5分钟有效期
  nonce: crypto.randomUUID()
});

// ✅ 正确：验证 TaskToken
const isValid = await this.toolGateway.validateToken(token);
if (!isValid) {
  throw new SecurityError('Invalid or expired TaskToken');
}

// ✅ 正确：执行受保护操作
await this.fileTool.write(filePath, content, token);
```

### CommandInterceptor 黑名单

```typescript
const COMMAND_BLACKLIST = [
  /rm\s+-rf\s+\//,          // 禁止删除根目录
  /dd\s+if=\/dev\/zero/,    // 禁止磁盘填充
  /:\(\)\{\s*:\|\:&\s*\};:/, // 禁止 fork bomb
  /mkfs\./,                  // 禁止格式化
  /chmod\s+[0-7]*777/       // 禁止过度授权
];

const COMMAND_WHITELIST = [
  /^ls\s/,                   // 允许列出目录
  /^cat\s/,                  // 允许查看文件
  /^git\s+(status|log|diff)/ // 允许 Git 查询
];
```

### 沙箱层级

| 层级 | 适用场景 | 隔离程度 |
|------|---------|---------|
| **L1** | 低风险：读取文件、查询信息 | 临时目录隔离 |
| **L2** | 中风险：生成代码、修改配置 | Git 分支隔离 |
| **L3** | 高风险：执行命令、部署应用 | Docker 容器隔离 |

---

## 七、测试约束 (Testing Standards)

### 原则
**质量是自主Agent得以信任的基石。**

### 规则矩阵

| 规则编号 | 规则内容 | 指标要求 |
|---------|---------|---------|
| **TEST-001** | 所有新 Agent 和核心服务必须编写单元测试。 | 代码覆盖率 ≥80% |
| **TEST-002** | 工具调用链路必须编写集成测试，Mock 外部依赖但验证完整流程。 | 每个工具至少1个正常路径和1个异常路径的集成测试 |
| **TEST-003** | 安全机制必须编写专项测试。 | 验证伪造 TaskToken、执行危险命令等攻击场景被正确拦截 |
| **TEST-004** | 灰度切流前，必须通过 E2E 测试验证"概念→蓝图→执行→交付"全闭环链路。 | 首次熔炼场景测试用例 |

### 覆盖率门禁配置

```json
// package.json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      },
      "src/core/domain/**": {
        "branches": 90,
        "functions": 90,
        "lines": 90,
        "statements": 90
      },
      "src/core/application/**": {
        "branches": 85,
        "functions": 85,
        "lines": 85,
        "statements": 85
      }
    }
  }
}
```

### Mock 策略

```typescript
// ✅ 正确：Mock 端口接口
const mockMemoryPort: jest.Mocked<IMemoryPort> = {
  retrieveContext: jest.fn(),
  recordTaskCompletion: jest.fn(),
  recordAgentExecution: jest.fn()
};

// ❌ 错误：Mock 具体实现
const mockEpisodicMemory: jest.Mocked<EpisodicMemory> = { ... };  // 禁止
```

### 测试分类

| 测试类型 | 目标 | 示例 |
|---------|------|------|
| **单元测试** | 验证单个函数/类的逻辑 | Agent 意图解析、记忆检索算法 |
| **集成测试** | 验证模块间协作 | Agent → MemoryPort → Database |
| **安全测试** | 验证防护机制有效性 | TaskToken 伪造、命令注入 |
| **E2E 测试** | 验证完整用户流程 | 代码解释 → 记忆记录 → 推荐展示 |

---

## 🔍 合规性检查清单

### 代码审查检查清单

**每个 PR 必须通过以下检查：**

#### 依赖方向
- [ ] 无跨层直接导入（通过 ESLint 检查）
- [ ] Application 层未导入 Infrastructure
- [ ] Infrastructure 层未导入 Application
- [ ] UI 层仅依赖 Application 和 Ports

#### 通信路径
- [ ] 无 container.resolve() 在类内部使用
- [ ] 无直接调用 EpisodicMemory 等记忆模块
- [ ] 跨模块通信通过 IEventBus
- [ ] Agent 之间通过事件通信

#### 端口纯度
- [ ] 新端口接口放在 src/core/ports/
- [ ] 端口文件无 class 定义
- [ ] 端口使用领域模型作为参数类型

#### 依赖注入
- [ ] 依赖通过构造函数注入
- [ ] 组合根中对象创建顺序正确
- [ ] 单例使用 registerSingleton()

#### 命名与目录
- [ ] 命名符合规范（IPort、Adapter、Agent、Event）
- [ ] 文件放置在正确的目录
- [ ] Agent ID 使用 kebab-case

#### 安全
- [ ] 写操作携带 TaskToken
- [ ] 命令执行经过 CommandInterceptor
- [ ] 操作记录到 AuditLogger

#### 测试
- [ ] 单元测试覆盖新增代码
- [ ] 集成测试验证工具调用链路
- [ ] 安全测试验证防护机制
- [ ] 覆盖率不低于阈值

---

## 🛠️ 自动化检查工具

### ESLint 规则

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/core/memory/EpisodicMemory'],
          message: '禁止直接导入记忆实现，请使用 IMemoryPort 接口'
        },
        {
          group: ['**/core/memory/PreferenceMemory'],
          message: '禁止直接导入记忆实现，请使用 IMemoryPort 接口'
        },
        {
          group: ['**/infrastructure/**'],
          message: '禁止从非适配器层导入基础设施代码'
        }
      ]
    }]
  }
};
```

### madge 循环依赖检查

```bash
# 检查循环依赖
npx madge --circular --extensions ts src/

# 生成依赖图
npx madge --image deps.png src/
```

### dependency-cruiser 规则

```javascript
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    {
      name: 'no-infrastructure-to-application',
      comment: '基础设施层不得依赖应用层',
      severity: 'error',
      from: { path: 'src/infrastructure' },
      to: { path: 'src/core/application' }
    },
    {
      name: 'no-ui-to-infrastructure',
      comment: 'UI层不得直接依赖基础设施',
      severity: 'error',
      from: { path: 'src/ui' },
      to: { path: 'src/infrastructure' }
    }
  ]
};
```

---

## 📊 合规性评分体系

### 评分维度

| 维度 | 权重 | 评分标准 |
|------|------|---------|
| **依赖方向** | 20% | DEP-001 ~ DEP-004 全部通过得满分 |
| **通信路径** | 20% | COM-001 ~ COM-004 全部通过得满分 |
| **端口纯度** | 15% | PORT-001 ~ PORT-003 全部通过得满分 |
| **记忆隔离** | 15% | MEM-001 ~ MEM-005 全部通过得满分 |
| **Agent行为** | 15% | AG-001 ~ AG-006 全部通过得满分 |
| **安全执行** | 10% | SEC-001 ~ SEC-005 全部通过得满分 |
| **测试约束** | 5% | TEST-001 ~ TEST-004 全部通过得满分 |

### 评级标准

| 评级 | 分数范围 | 含义 |
|------|---------|------|
| ⭐⭐⭐⭐⭐ | 95-100% | 完全合规，可合并 |
| ⭐⭐⭐⭐ | 85-94% | 基本合规，轻微问题需修复 |
| ⭐⭐⭐ | 70-84% | 部分合规，重要问题需修复 |
| ⭐⭐ | <70% | 严重违规，拒绝合并 |

---

## 📝 实施状态

### ✅ 已实施的约束

1. **ESLint no-restricted-imports 规则** - 禁止直接导入 EpisodicMemory、PreferenceMemory、LLMTool
2. **适配器层例外** - infrastructure/adapters 允许导入具体实现
3. **Chat/Completion 目录豁免** - 待重构代码暂时降级为警告
4. **Commands 目录删除** - patterns 规则禁止引用已删除的目录
5. **TaskToken 机制** - SEC-001 已实现
6. **AuditLogger** - SEC-005 已实现
7. **CommandInterceptor** - SEC-002 已实现

### ⏳ 待实施的约束

1. **UI 层限制** - 禁止 ui/chat 目录导入 infrastructure
2. **Application 层限制** - 禁止 application 目录导入 infrastructure
3. **Infrastructure 层限制** - 禁止 infrastructure 导入 application/domain
4. **madge 循环依赖检查** - 集成到 CI/CD
5. **dependency-cruiser 规则** - 更细粒度的依赖检查
6. **测试覆盖率门禁** - 集成到 CI/CD
7. **ToolGateway 完整实现** - COM-002、AG-004
8. **沙箱执行系统** - SEC-003
9. **信任级别进化模型** - SEC-004
10. **E2E 测试框架** - TEST-004

---

## 🚀 下一步行动

### Phase 1: 紧急修复（本周）
1. 完善 ESLint 规则，覆盖所有跨层导入场景
2. 实现 ToolGateway 完整功能
3. 补充安全测试用例

### Phase 2: 自动化守护（下周）
1. 配置 madge 循环依赖检查
2. 配置 dependency-cruiser 细粒度规则
3. 集成到 CI/CD 流水线

### Phase 3: 测试完善（体验期）
1. 配置测试覆盖率门禁
2. 补充 E2E 测试覆盖关键流程
3. 添加对话自然度测试

---

## 📚 相关文档

- [小尾巴重构核心三原则](./CORE_PRINCIPLES.md) - 项目宪法
- [架构强制约束规范](./architecture-constraints.md) - 详细实施指南
- [架构合规性检查报告](./ARCHITECTURE_COMPLIANCE_REPORT.md) - 当前合规状态
- [意图驱动架构](./INTENT_DRIVEN_ARCHITECTURE.md) - 系统设计文档

---

**维护者**: 小尾巴团队  
**最后更新**: 2026-05-02  
**下次审查**: 2026-06-02（或重大架构变更后）

**批准人签字**: _________________  
**生效日期**: 2026-05-02
