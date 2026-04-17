# 以记忆为核心驱动的融合架构 - 终极设计

**创建时间**: 2026-04-17  
**版本**: v4.0 (记忆大脑)  
**状态**: 设计中（渐进式实施）

---

## 一、核心定位：记忆系统是"大脑"，其他模块是"器官"

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                    │
│         聊天面板 │ 命令面板 │ 右键菜单 │ 行内补全 │ 状态栏             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        记忆系统（核心大脑）                             │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      记忆引擎 (MemoryEngine)                     │  │
│  │  - 情景记忆（Episodic）: 记录用户操作历史                         │  │
│  │  - 偏好记忆（Preference）: 学习用户习惯                           │  │
│  │  - 语义记忆（Semantic）: 存储项目事实、规范                        │  │
│  │  - 程序记忆（Procedural）: 沉淀可复用技能                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      检索与推理引擎                              │  │
│  │  - 混合检索（关键词+时间+实体+向量）                             │  │
│  │  - 自适应权重（用户反馈学习）                                    │  │
│  │  - 意图识别（时间/实体/语义）                                    │  │
│  │  - 主动推荐（基于当前上下文）                                    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      记忆驱动的事件总线                          │  │
│  │  - 记忆变化 → 发布事件 → 触发其他模块行为                         │  │
│  │  - 其他模块行为 → 记录到记忆 → 影响后续决策                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        功能模块（被动响应）                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ 代码解释   │ │ 提交生成   │ │ 代码生成   │ │ Git操作    │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ SQL优化    │ │ 命名检查   │ │ 网络搜索   │ │ 行内补全   │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        适配器层（可插拔）                               │
│   LLM适配器 │ Git适配器 │ 文件适配器 │ 数据库适配器 │ 搜索适配器      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心隐喻

| 组件 | 生物学类比 | 职责 |
|------|-----------|------|
| **记忆系统** | 大脑 | 决策中枢、行为驱动器、学习引擎 |
| **功能模块** | 器官（手/眼/口） | 被动执行，接收大脑指令 |
| **事件总线** | 神经系统 | 传递信号，协调各器官 |
| **适配器** | 感官接口 | 与外部世界交互（LLM/Git/File） |

---

## 二、记忆系统如何驱动一切

### 2.1 核心原则：先记忆，后行动

所有用户操作和系统行为都遵循以下流程：

```
用户输入 / 系统事件
        ↓
记忆系统检索相关记忆（历史、偏好、规范）
        ↓
记忆系统决定：
  - 是否需要主动提示？
  - 应该调用哪个功能模块？
  - 注入哪些上下文到 Prompt？
        ↓
功能模块执行（使用记忆提供的上下文）
        ↓
执行结果返回记忆系统
        ↓
记忆系统更新（记录新记忆、更新偏好置信度、调整权重）
        ↓
记忆系统决定下一步（如询问用户是否采纳、推荐相关操作）
```

**关键区别**：
- ❌ 旧模式：功能模块主动调用记忆系统
- ✅ 新模式：记忆系统调度功能模块

### 2.2 示例：代码解释的完整流程（记忆驱动版）

```
1. 用户选中代码，触发"解释代码"意图
        ↓
2. 记忆系统检索：
   - 最近3条关于该文件的记忆（情景）
   - 用户偏好的解释风格（简洁/详细）（偏好）
   - 该项目的代码规范（语义）
        ↓
3. 记忆系统组装上下文，注入 Prompt
        ↓
4. 调用 LLM 适配器生成解释
        ↓
5. 解释结果返回，记忆系统判断：
   - 是否与历史解释相似？若是，提示"你之前问过类似问题"
   - 是否包含用户曾关注的关键词？若是，高亮提示
        ↓
6. 展示解释，并记录新记忆：
   - 任务类型: CODE_EXPLAIN
   - 实体: 提取的函数名、类名
   - 决策: 用户是否采纳（后续反馈）
        ↓
7. 记忆系统更新偏好：如果用户这次修改了解释内容，记录修正模式
```

### 2.3 示例：主动推荐（记忆驱动）

```
1. 用户打开文件 `OrderService.java`
        ↓
2. 记忆系统自动检索与该文件相关的历史记忆：
   - 发现用户上周在该文件里修复过 N+1 查询问题
   - 发现用户偏好使用 Stream 而不是 for-loop
        ↓
3. 记忆系统主动发布事件: `memory.recommend`
        ↓
4. UI 模块订阅该事件，在状态栏显示提示：
   "你之前在这个文件里优化过 N+1 查询，本次修改需要注意类似问题"
        ↓
5. 用户点击提示，记忆系统提供详细信息
```

---

## 三、记忆系统与事件总线的融合

事件总线不再是独立的通信层，而是**记忆系统的延伸**。记忆系统通过事件总线发布"记忆变化"，其他模块订阅并响应。

### 3.1 核心事件定义

| 事件 | 发布者 | 订阅者 | 用途 |
|------|--------|--------|------|
| `memory.recorded` | 记忆系统 | 审计、UI | 记录操作日志、更新记忆指示器 |
| `memory.preference.updated` | 记忆系统 | 所有功能模块 | 重新加载用户偏好（如代码风格） |
| `memory.retrieved` | 记忆系统 | 功能模块 | 接收检索结果，用于 Prompt 构建 |
| `memory.recommend` | 记忆系统 | UI、功能模块 | 主动推荐相关记忆 |
| `memory.skill.suggested` | 记忆系统 | Skill 引擎 | 建议固化重复操作为 Skill |
| `module.action.completed` | 功能模块 | 记忆系统 | 记录任务结果，更新记忆 |

### 3.2 关键设计原则

**功能模块不能直接调用记忆系统的 API（除了极少数情况），而是通过事件总线向记忆系统请求服务。**

```typescript
// ❌ 错误：功能模块直接调用记忆系统
class ExplainCodeCommand {
  async execute() {
    const memory = await this.memory.retrieve(...); // 不允许
    // ...
  }
}

// ✅ 正确：通过事件总线请求
class ExplainCodeCommand {
  async execute() {
    // 发布检索请求事件
    eventBus.publish({
      type: 'memory.request.retrieve',
      payload: { query: 'code explanation preference' }
    });
    
    // 等待记忆系统响应
    const context = await this.waitForResponse('memory.response.retrieve');
    // ...
  }
}
```

**这保证了记忆系统对所有行为的可见性和控制权。**

---

## 四、记忆系统的内部结构（强化版）

为了不让记忆系统太弱，需要强化其内部能力：

### 4.1 核心能力矩阵

| 能力 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| **多模态记忆** | 支持文本、代码片段、截图、终端日志 | 远期 | ❌ |
| **记忆关联** | 实体关系图谱，支持路径查询 | 中期 | ⚠️ |
| **记忆衰减与遗忘** | 基于时间、访问频率、用户反馈自动调整权重 | 短期 | ✅ 部分实现 |
| **记忆冲突检测** | 当新记忆与旧偏好冲突时，主动询问用户 | 中期 | ❌ |
| **记忆导出/导入** | 支持跨设备同步（加密） | 短期 | ✅ 已实现 |
| **记忆可视化** | 提供管理界面，用户可查看、编辑、删除记忆 | 中期 | ❌ |
| **记忆版本控制** | 支持回滚到之前的记忆状态 | 远期 | ❌ |
| **元记忆** | 记录用户对记忆的使用模式，用于优化检索策略 | 中期 | ❌ |

### 4.2 检索与推理引擎增强

#### 混合检索策略

```typescript
interface RetrievalStrategy {
  keyword: number;    // 关键词匹配权重
  time: number;       // 时间衰减权重
  entity: number;     // 实体匹配权重
  vector: number;     // 向量相似度权重（预留）
}

class AdaptiveRetriever {
  async retrieve(query: string, context: any): Promise<Memory[]> {
    // 1. 意图识别
    const intent = this.analyzeIntent(query);
    
    // 2. 动态调整权重
    const weights = this.calculateWeights(intent, context);
    
    // 3. 多路召回
    const keywordResults = await this.keywordSearch(query, weights.keyword);
    const timeResults = await this.timeDecaySearch(query, weights.time);
    const entityResults = await this.entityMatch(query, weights.entity);
    
    // 4. 融合排序
    return this.rerank([...keywordResults, ...timeResults, ...entityResults]);
  }
}
```

#### 主动推荐引擎

```typescript
class RecommendationEngine {
  async onFileOpened(filePath: string) {
    // 检索与该文件相关的历史记忆
    const memories = await this.memory.retrieve({
      entities: [filePath],
      limit: 5
    });
    
    if (memories.length > 0) {
      // 发布推荐事件
      this.eventBus.publish({
        type: 'memory.recommend',
        payload: {
          filePath,
          recommendations: memories.map(m => ({
            title: m.summary,
            action: 'view_details',
            memoryId: m.id
          }))
        }
      });
    }
  }
}
```

---

## 五、与现有代码的融合路径（不破坏当前功能）

当前小尾巴的记忆系统（EpisodicMemory、PreferenceMemory）已经具备基础能力，但处于"被动存储"状态。融合的目标是让记忆系统**主动驱动**。

### 5.1 第一阶段：让记忆系统成为"服务注册中心"（2h）

将所有功能模块（ExplainCodeCommand 等）的调用入口注册到记忆系统。

**改造前**：
```typescript
// 命令直接调用
vscode.commands.registerCommand('xiaoweiba.explainCode', () => 
  explainCodeCommand.execute()
);
```

**改造后**：
```typescript
// 命令先经过记忆系统
vscode.commands.registerCommand('xiaoweiba.explainCode', () => {
  memorySystem.executeAction('explainCode', { selectedCode });
});

// 记忆系统注册动作
memorySystem.registerAction('explainCode', async (input, context) => {
  return await explainCodeCommand.execute(input, context);
});
```

### 5.2 第二阶段：记忆系统自动注入上下文（4h）

在 `executeAction` 内部，记忆系统先检索相关记忆，再调用真正的 handler。

```typescript
class MemorySystem {
  private actions: Map<string, ActionHandler> = new Map();
  
  registerAction(actionId: string, handler: ActionHandler): void {
    this.actions.set(actionId, handler);
  }
  
  async executeAction(actionId: string, input: any): Promise<any> {
    // 1. 检索相关记忆
    const memoryContext = await this.retrieveRelevant(input);
    
    // 2. 获取 handler
    const handler = this.actions.get(actionId);
    if (!handler) {
      throw new Error(`Action ${actionId} not registered`);
    }
    
    // 3. 调用 handler，注入记忆上下文
    const result = await handler(input, memoryContext);
    
    // 4. 记录动作结果到记忆
    await this.recordAction(actionId, input, result);
    
    // 5. 发布完成事件
    this.eventBus.publish({
      type: 'module.action.completed',
      payload: { actionId, result }
    });
    
    return result;
  }
  
  private async retrieveRelevant(input: any): Promise<MemoryContext> {
    // 根据输入类型检索不同记忆
    if (input.selectedCode) {
      return {
        preferences: await this.preferenceMemory.retrieve('code_explain_style'),
        recentEpisodes: await this.episodicMemory.retrieve({
          entities: extractEntities(input.selectedCode),
          limit: 3
        })
      };
    }
    return {};
  }
  
  private async recordAction(actionId: string, input: any, result: any): Promise<void> {
    await this.episodicMemory.record({
      taskType: actionId.toUpperCase(),
      summary: this.summarize(input, result),
      outcome: result.success ? 'SUCCESS' : 'FAILED'
    });
  }
}
```

**Handler 签名变更**：
```typescript
type ActionHandler = (input: any, memoryContext: MemoryContext) => Promise<any>;

// 示例：ExplainCodeCommand 改造
class ExplainCodeCommand {
  async execute(input: any, context: MemoryContext): Promise<any> {
    // 使用记忆注入的上下文
    const prompt = this.buildPrompt(input.selectedCode, context);
    const explanation = await this.llmPort.chat(prompt);
    
    return { success: true, explanation };
  }
}
```

### 5.3 第三阶段：主动推荐（4h）

记忆系统监听编辑器事件（文件打开、光标移动等），主动检索相关记忆。

```typescript
class MemorySystem {
  constructor(private vscodeApi: VSCodeAPI) {
    // 监听文件打开事件
    this.vscodeApi.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await this.onFileOpened(editor.document.uri.fsPath);
      }
    });
  }
  
  private async onFileOpened(filePath: string) {
    // 检索与该文件相关的历史记忆
    const memories = await this.episodicMemory.retrieve({
      entities: [path.basename(filePath)],
      limit: 5
    });
    
    if (memories.length > 0) {
      // 发布推荐事件
      this.eventBus.publish({
        type: 'memory.recommend',
        payload: {
          filePath,
          recommendations: memories.map(m => ({
            title: m.summary,
            timestamp: m.timestamp,
            memoryId: m.id
          }))
        }
      });
    }
  }
}

// UI 模块订阅推荐事件
class StatusBarModule {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe('memory.recommend', this.showRecommendation);
  }
  
  private showRecommendation = (event: any) => {
    const { filePath, recommendations } = event.payload;
    vscode.window.setStatusBarMessage(
      `💡 记忆提示：${recommendations[0].title}`,
      5000
    );
  };
}
```

---

## 六、架构的"半开放半封闭"体现

| 层面 | 封闭（不可变） | 开放（可扩展） |
|------|--------------|--------------|
| **记忆核心** | 记忆记录、检索、衰减算法 | 存储后端（SQLite/向量库可换） |
| **记忆驱动的事件总线** | 核心事件类型 | 插件可定义新事件 |
| **功能模块** | 模块接口（必须实现 execute 并接受 memoryContext） | 模块实现（用户可编写新模块） |
| **记忆应用策略** | 记忆优先原则（所有操作必须先经过记忆系统） | 用户可配置哪些操作受记忆影响 |

---

## 七、迁移计划总结

| Phase | 任务 | 工时 | 交付物 |
|-------|------|------|--------|
| **1** | 记忆系统成为服务注册中心 | 2h | registerAction/executeAction API |
| **2** | 自动注入上下文 | 4h | MemoryContext 结构、retrieveRelevant 实现 |
| **3** | 主动推荐引擎 | 4h | 文件监听、memory.recommend 事件 |
| **4** | 功能模块改造 | 8h | 所有 Commands 改为接受 memoryContext |
| **5** | 事件总线完善 | 4h | 6个核心事件、订阅机制 |
| **6** | 测试与优化 | 4h | 集成测试、性能基准 |

**总工时**: 26小时

---

## 八、总结

记忆系统不是配角，而是小尾巴的"**大脑**"：

✅ **所有用户操作都通过记忆系统调度**  
✅ **所有功能模块都是记忆系统的"执行器"**  
✅ **记忆系统不仅记录，更主动决策、推荐、学习**  

这种设计完全符合"私人学徒"愿景：**学徒会记住师傅的一切，并在师傅需要时主动提醒，而不是等师傅问才回答。**

---

**维护者**: AI Assistant  
**最后更新**: 2026-04-17  
**参考**: 
- [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
- [MEMORY_DRIVEN_ARCHITECTURE.md](./MEMORY_DRIVEN_ARCHITECTURE.md)
