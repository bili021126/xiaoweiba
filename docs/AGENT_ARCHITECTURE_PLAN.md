# 多Agent协作架构规划

**创建时间**: 2026-04-17  
**版本**: v1.0 (规划阶段)  
**状态**: 📋 设计中（Phase 3待实施）

---

## 一、核心愿景

记忆系统作为"调度中枢"，Agent作为"可插拔的专用大脑"。就像一个项目经理（记忆系统）可以召集不同领域的专家（Agent）来协助完成任务。

---

## 二、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   记忆系统（中央调度中枢）                              │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    记忆引擎（存储、检索、推理）                   │  │
│  │  - 情景/偏好/语义/程序记忆                                       │  │
│  │  - 混合检索 + 自适应权重                                         │  │
│  │  - 意图识别 + 主动推荐                                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    调度器（Dispatcher）                          │  │
│  │  - 根据用户意图和记忆上下文，决定调用哪个 Agent/功能模块          │  │
│  │  - 管理 Agent 的注册、路由、负载                                  │  │
│  │  - 聚合多个 Agent 的结果                                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    事件总线（记忆驱动）                          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Agent 层（可插拔，可扩展）                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ 代码解释   │ │ 提交生成   │ │ 代码生成   │ │ SQL优化    │         │
│  │ Agent     │ │ Agent      │ │ Agent      │ │ Agent      │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ 网络搜索   │ │ 代码审查   │ │ 测试生成   │ │ 重构建议   │         │
│  │ Agent     │ │ Agent      │ │ Agent      │ │ Agent      │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│                              ↓                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐  ...                    │
│  │ 未来专业   │ │ 未来专业   │ │ 未来专业   │                         │
│  │ Agent A    │ │ Agent B    │ │ Agent C    │                         │
│  └────────────┘ └────────────┘ └────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        适配器层（可插拔）                               │
│   LLM适配器 │ Git适配器 │ 文件适配器 │ 数据库适配器 │ 搜索适配器      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、渐进式演进路径

### 第一阶段：当前状态（已完成 ✅）
- **记忆系统**: EpisodicMemory、PreferenceMemory已实现
- **事件总线**: EventBus已实现（Phase 1）
- **服务注册中心**: MemorySystem已实现（Phase 1）
- **功能模块**: Commands直接调用记忆API

**特点**：
- 单Agent模式（功能模块没有独立智能）
- 调度逻辑简单（根据命令直接路由）

### 第二阶段：引入Agent抽象层（Phase 3待实施）

#### 2.1 定义Agent接口
```typescript
interface IAgent {
  readonly metadata: AgentMetadata;
  execute(input: AgentInput, memoryContext: MemoryContext): Promise<AgentResult>;
  isAvailable(): boolean | Promise<boolean>;
  getCapabilities(): AgentCapability[];
  dispose?(): void | Promise<void>;
}
```

#### 2.2 将现有Commands包装为Agents
```typescript
class ExplainCodeAgent implements IAgent {
  readonly metadata = {
    id: 'explain-code',
    name: '代码解释专家',
    capabilities: [
      { name: 'explain', description: '解释代码逻辑', priority: 10 }
    ],
    registeredAt: Date.now()
  };

  async execute(input: AgentInput, context: MemoryContext): Promise<AgentResult> {
    // 原有ExplainCodeCommand逻辑
    // 但接受memoryContext参数
    const memories = context.episodicMemories;
    const prefs = context.preferenceRecommendations;
    
    // 使用记忆增强Prompt
    const prompt = this.buildPrompt(input.selectedCode, memories, prefs);
    const result = await llmTool.call({ messages: [{ role: 'user', content: prompt }] });
    
    return {
      success: true,
      data: result.data,
      durationMs: result.durationMs
    };
  }
}
```

#### 2.3 AgentManager管理所有Agent
```typescript
@injectable()
export class AgentManager {
  private agents: Map<string, IAgent> = new Map();
  
  registerAgent(id: string, agent: IAgent): void {
    this.agents.set(id, agent);
  }
  
  findAgentsByCapability(capabilityName: string): IAgent[] {
    // 根据能力查找匹配的Agent
  }
}
```

### 第三阶段：调度器根据记忆选择Agent（Phase 4待实施）

```typescript
class Dispatcher {
  constructor(
    private memorySystem: MemorySystem,
    private agentManager: AgentManager
  ) {}

  async dispatch(userIntent: Intent, input: AgentInput): Promise<AgentResult> {
    // 1. 检索相关记忆（用户偏好、历史成功率）
    const memoryContext = await this.memorySystem.retrieveForIntent(userIntent);
    
    // 2. 根据记忆选择合适的Agent
    const preferredAgentId = memoryContext.preferredAgent || 
                             this.selectAgentByCapability(userIntent);
    const agent = this.agentManager.getAgent(preferredAgentId);
    
    if (!agent) {
      throw new Error(`No agent found for capability: ${userIntent}`);
    }
    
    // 3. 执行
    const result = await agent.execute(input, memoryContext);
    
    // 4. 记录结果，用于下次选择
    await this.memorySystem.recordAgentUsage(preferredAgentId, userIntent, result.success);
    
    return result;
  }
}
```

### 第四阶段：多Agent协作（工作流编排）（Phase 5远期规划）

```typescript
// 记忆系统可以编排多个Agent
const workflow = {
  steps: [
    { agent: 'code-generator', input: userRequest },
    { agent: 'test-generator', input: '${step1.output}' },
    { agent: 'code-reviewer', input: '${step1.output}' }
  ]
};

const results = await dispatcher.executeWorkflow(workflow);
```

---

## 四、记忆系统如何支持多Agent演进

| 记忆类型 | 当前作用 | 多Agent扩展 |
|---------|---------|------------|
| **情景记忆** | 记录用户操作 | 记录哪个Agent执行了任务、成功率、耗时 |
| **偏好记忆** | 用户偏好（如代码风格） | 用户偏好的Agent（如"总是用代码生成Agent A"） |
| **语义记忆** | 项目事实 | Agent的能力描述、适用场景 |
| **程序记忆** | 重复操作模式 | Agent组合模式（如"代码生成→测试生成"固定流程） |
| **新增：Agent记忆** | - | 记录Agent性能指标（成功率、平均耗时、最后使用时间） |

### Agent记忆结构
```typescript
interface AgentPerformanceMemory {
  agentId: string;
  taskType: string;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  lastUsed: number;
}
```

记忆系统可以根据这些数据动态调整Agent选择策略：
- 成功率低于60%的Agent不再被优先选择
- 响应时间过长的Agent降级使用
- 用户明确拒绝过的Agent降低优先级

---

## 五、事件总线的角色（记忆驱动）

所有Agent之间的通信、Agent与记忆系统之间的通信都通过事件总线完成。

| 事件 | 发布者 | 订阅者 | 用途 |
|------|-------|-------|------|
| `agent.register` | Agent管理器 | 记忆系统 | 注册Agent的能力 |
| `agent.selected` | 调度器 | 记忆系统 | 记录哪个Agent被选中 |
| `agent.execution.completed` | Agent | 记忆系统、审计 | 记录执行结果 |
| `workflow.started` | 调度器 | 记忆系统 | 记录工作流开始 |
| `workflow.completed` | 调度器 | 记忆系统 | 记录工作流结果，可用于沉淀为新程序记忆 |

---

## 六、安全与用户控制

### 6.1 任务级授权
Agent执行敏感操作（写文件、执行命令）仍需用户y/n确认。

### 6.2 Agent白名单
用户可配置哪些Agent允许运行（默认所有已安装的Agent都允许，但可禁用）。

```json
{
  "xiaoweiba.agentWhitelist": {
    "explain-code": true,
    "generate-commit": true,
    "code-generation": true,
    "sql-optimization": false  // 禁用SQL优化Agent
  }
}
```

### 6.3 审计日志
所有Agent调用、工作流执行都记录到审计日志：
```typescript
await auditLogger.log('agent_execution', 'success', durationMs, {
  parameters: {
    agentId: 'explain-code',
    taskType: 'CODE_EXPLAIN',
    modelId: 'deepseek',
    tokenUsage: { input: 100, output: 200 }
  }
});
```

---

## 七、实施优先级与工时估算

| 阶段 | 任务 | 预计工时 | 优先级 |
|------|------|---------|--------|
| Phase 3 | 定义IAgent接口和AgentManager | 2h | High |
| Phase 3 | 将ExplainCodeCommand包装为Agent | 2h | High |
| Phase 3 | 将GenerateCommitCommand包装为Agent | 2h | Medium |
| Phase 3 | 更新extension.ts使用AgentManager | 1h | High |
| Phase 3 | 补充单元测试 | 3h | High |
| Phase 4 | 实现Dispatcher调度逻辑 | 4h | Medium |
| Phase 4 | 实现Agent性能记忆 | 2h | Low |
| Phase 5 | 工作流编排引擎 | 8h | Future |

**总计**: Phase 3需要10小时，Phase 4需要6小时，Phase 5需要8小时

---

## 八、与现有架构的兼容性

### 8.1 向后兼容
- 现有Commands可以继续工作，无需立即迁移
- 逐步将Commands包装为Agents，不影响已有功能
- MemorySystem的executeAction可以同时支持Commands和Agents

### 8.2 平滑过渡
```typescript
// 过渡期：MemorySystem同时支持两种模式
async executeAction(actionId: string, input: any): Promise<any> {
  // 尝试作为Agent执行
  const agent = this.agentManager.getAgent(actionId);
  if (agent) {
    const memoryContext = await this.retrieveRelevant(actionId, input);
    return await agent.execute(input, memoryContext);
  }
  
  // 降级为传统Command执行
  const action = this.actions.get(actionId);
  if (action) {
    const memoryContext = await this.retrieveRelevant(actionId, input);
    return await action.handler(input, memoryContext);
  }
  
  throw new Error(`Action or Agent "${actionId}" not found`);
}
```

---

## 九、总结

### 核心价值
1. **记忆系统依然是核心**：它决定调用哪个Agent、如何组合Agent、如何学习Agent的表现
2. **渐进式智能**：从单Agent到多Agent协作，每一步都可独立部署
3. **扩展性**：新增Agent只需实现IAgent接口并注册，记忆系统自动感知
4. **半开放半封闭**：记忆核心封闭（算法不可变），Agent开放（可插拔）

### 下一步行动
1. **立即启动Phase 3**：定义IAgent接口和AgentManager
2. **优先迁移ExplainCodeCommand**：验证Agent模式的可行性
3. **补充单元测试**：确保Agent架构的可靠性
4. **更新文档**：记录Agent架构设计决策

---

**备注**: 本规划文档基于Phase 1完成的EventBus和MemorySystem基础设施，为未来的多Agent协作预留了完整的演进路径。
