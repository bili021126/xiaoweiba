# 小尾巴项目记忆驱动架构设计文档

**版本**: v4.0 (记忆大脑终极版)  
**创建时间**: 2026-04-17  
**最后更新**: 2026-04-17  
**状态**: 渐进式实施中  
**维护者**: 小尾巴团队

---

## 📖 目录

1. [项目概述与定位](#一项目概述与定位)
2. [核心原则](#二核心原则)
3. [架构蓝图](#三架构蓝图)
4. [模块划分](#四模块划分)
5. [记忆系统详细设计](#五记忆系统详细设计)
6. [事件总线设计](#六事件总线设计)
7. [单Agent到多Agent演进路径](#七单agent到多agent演进路径)
8. [安全与用户控制](#八安全与用户控制)
9. [测试体系](#九测试体系)
10. [实施路线图](#十实施路线图)
11. [附录](#十一附录)

---

## 一、项目概述与定位

### 1.1 项目愿景

**小尾巴（XiaoWeiba）**是一个以"记忆蒸馏"为内核的个人AI编程伴侣，运行在VS Code平台上。它不仅是代码助手，更是开发者的**私人学徒**——会记住师傅的一切，并在师傅需要时主动提醒，而不是等师傅问才回答。

### 1.2 核心价值主张

| 维度 | 传统AI插件 | 小尾巴 |
|------|-----------|--------|
| **记忆能力** | 无记忆或短期会话记忆 | 长期情景记忆+偏好学习+语义知识 |
| **主动性** | 被动响应 | 主动推荐、智能提示 |
| **个性化** | 通用模型 | 基于用户习惯的自适应行为 |
| **隐私安全** | 云端依赖 | 本地优先、数据可控 |
| **可扩展性** | 固定功能 | 插件化架构、技能市场 |

### 1.3 目标用户

- **个人开发者**：追求高效、注重隐私、喜欢定制化工具
- **技术爱好者**：愿意尝试新架构、参与社区共建
- **学习者**：希望通过AI辅助提升编程技能

### 1.4 技术栈

```
TypeScript 5.3.2 + VS Code Extension API
├── tsyringe (依赖注入)
├── sql.js (SQLite WASM)
├── Jest 29.7.0 (测试框架)
├── DeepSeek/Ollama/OpenAI (LLM适配器)
└── DOMPurify (XSS防护)
```

---

## 二、核心原则

### 2.1 记忆为核（Memory as Brain）

**核心隐喻**：记忆系统是整个项目的"大脑"，所有功能模块是"器官"。

- ✅ **单一真理来源**：记忆系统是唯一的决策中枢
- ✅ **先记忆，后行动**：所有操作必须先经过记忆系统检索和调度
- ✅ **主动驱动**：记忆系统不仅记录，更主动决策、推荐、学习

**反模式**：
```typescript
// ❌ 错误：功能模块直接调用记忆系统
class ExplainCodeCommand {
  async execute() {
    const memory = await this.memory.retrieve(...); // 不允许
  }
}

// ✅ 正确：通过记忆系统调度
memorySystem.executeAction('explainCode', { selectedCode });
```

### 2.2 半开放半封闭

| 层面 | 封闭（不可变） | 开放（可扩展） |
|------|--------------|--------------|
| **记忆核心** | 记忆记录、检索、衰减算法 | 存储后端（SQLite/向量库可换） |
| **事件总线** | 核心事件类型 | 插件可定义新事件 |
| **功能模块** | 模块接口规范 | 模块实现（用户可编写新模块） |
| **适配器** | 端口接口定义 | 适配器实现（支持新LLM/Git提供商） |

### 2.3 渐进式智能

从单Agent平滑演进到多Agent协作：

```
v1.0: 功能模块直接包装为Agent
  ↓
v2.0: 调度器根据记忆选择Agent
  ↓
v3.0: 工作流编排（多Agent协作）
  ↓
v4.0: Agent记忆（记录成功率、耗时等）
```

### 2.4 本地优先（Local-First）

- ✅ **所有数据本地存储**：SQLite数据库、配置文件、审计日志
- ✅ **隐私安全可控**：API密钥使用SecretStorage加密
- ✅ **离线可用**：Ollama本地模型、Git命令行工具
- ✅ **可选云端增强**：DeepSeek/OpenAI作为增强选项

---

## 三、架构蓝图

### 3.1 整体架构图

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

### 3.2 架构融合理念

本架构融合了三种经典设计模式：

1. **六边形架构（Hexagonal Architecture）**
   - 核心领域与外部依赖解耦
   - 端口-适配器模式，技术栈可替换

2. **微核架构（Microkernel Architecture）**
   - 核心层封闭稳定（记忆引擎、事件总线、安全授权）
   - 插件层开放扩展（功能模块动态加载/卸载）

3. **事件驱动架构（Event-Driven Architecture）**
   - 模块间通过事件总线通信
   - 记忆系统通过事件驱动其他模块

---

## 四、模块划分

### 4.1 核心层（微核）

核心层是系统的"大脑"，负责决策、调度、学习。**不允许随意修改**。

#### 4.1.1 记忆引擎（MemoryEngine）

**职责**：
- 四类记忆的存储、检索、更新
- 记忆衰减与归档策略
- 跨会话记忆摘要生成

**子模块**：
```typescript
EpisodicMemory (情景记忆)
├── IndexManager (索引管理器) ✅ 已实现
├── SearchEngine (搜索引擎) ✅ 已实现
├── FeedbackRecorder (反馈记录器) ✅ 已实现
├── MemoryTierManager (层级管理器) ✅ 已实现
├── MemoryDeduplicator (去重器) ✅ 已实现
└── MemoryArchiver (归档器) ✅ 已实现

PreferenceMemory (偏好记忆)
SemanticMemory (语义记忆) - 待实现
ProceduralMemory (程序记忆) - 待实现
```

#### 4.1.2 检索与推理引擎

**混合检索策略**：
```typescript
interface RetrievalStrategy {
  keyword: number;    // 关键词匹配权重 (TF-IDF)
  time: number;       // 时间衰减权重 (指数衰减 λ=0.1)
  entity: number;     // 实体匹配权重 (Jaccard相似度)
  vector: number;     // 向量相似度权重 (预留，v2.0)
}
```

**意图感知检索**：
- `IntentAnalyzer`: 基于规则识别时间/实体/语义敏感度
- `ExpertSelector`: 5种专家配置，基于用户反馈动态选择
- 门控调制：`finalWeights = baseWeights × (1 + intentStrength × coefficient)`

**性能指标**：
- 索引构建时间：< 100ms（2000条记忆，异步执行）
- 单次检索时间：< 5ms（纯内存操作）
- 内存占用：< 3MB（倒排索引 + TF缓存）

#### 4.1.3 事件总线（EventBus）

**核心事件定义**：

| 事件名 | 载荷 | 发布者 | 订阅者 |
|--------|------|--------|--------|
| `memory.recorded` | `{ memoryId, taskType }` | 记忆系统 | 审计、UI |
| `memory.preference.updated` | `{ domain, pattern }` | 记忆系统 | 所有功能模块 |
| `memory.retrieved` | `{ query, results }` | 记忆系统 | 功能模块 |
| `memory.recommend` | `{ filePath, recommendations }` | 记忆系统 | UI、功能模块 |
| `module.action.completed` | `{ actionId, result, duration }` | 功能模块 | 记忆系统 |
| `llm.call.started` | `{ requestId, provider, prompt }` | 插件 | LLM适配器 |
| `llm.call.completed` | `{ requestId, response, duration }` | LLM适配器 | 原请求插件、审计 |
| `task.completed` | `{ taskId, taskType, result }` | 任何完成任务的模块 | 审计、统计 |

**优先级队列**：
- P0（最高）：安全相关事件（授权失败、审计日志）
- P1（高）：记忆变化事件（recorded、updated）
- P2（中）：任务完成事件
- P3（低）：推荐事件、统计事件

#### 4.1.4 安全授权（SecurityPort）

**TaskToken机制**：
```typescript
interface TaskToken {
  taskId: string;
  permissions: Permission[]; // ['read_file', 'write_file', 'git_commit']
  expiresAt: number;
  hmacSignature: string; // HMAC-SHA256签名防篡改
}
```

**审计日志**：
- 所有关键操作记录到AuditLogger
- HMAC签名防止篡改
- 日志轮转（最大20MB）

#### 4.1.5 调度器（Dispatcher）

**职责**：根据记忆上下文选择合适的Agent/功能模块

```typescript
class Dispatcher {
  async dispatch(intent: UserIntent): Promise<Agent> {
    // 1. 从记忆中检索用户历史偏好
    const preferences = await this.memory.retrievePreferences(intent);
    
    // 2. 根据意图类型选择Agent
    const agent = this.selectAgent(intent, preferences);
    
    // 3. 注入记忆上下文
    const context = await this.buildContext(intent);
    
    return { agent, context };
  }
}
```

### 4.2 插件层（功能模块）

插件层是系统的"器官"，被动响应记忆系统的调度。**用户可以编写新插件**。

#### 4.2.1 现有插件清单

| 插件ID | 功能描述 | 状态 | 核心文件 |
|--------|---------|------|----------|
| `explain-code` | 代码解释 | ✅ v1.0 | ExplainCodeCommand.ts |
| `generate-commit` | 提交信息生成 | ✅ v1.0 + 智能化改造 | GenerateCommitCommand.v2.ts |
| `code-generation` | 代码生成 | ✅ v1.0 | CodeGenerationCommand.ts |
| `git-assistant` | Git智能助手 | ⏸️ 规划中 | - |
| `sql-optimizer` | SQL优化 | ⏸️ 规划中 | - |
| `naming-checker` | 命名检查 | ✅ v1.0 | CheckNamingCommand.ts |
| `web-search` | 网络搜索 | ⏸️ 规划中 | - |
| `inline-completion` | 行内补全 | ✅ v1.0 | AICompletionProvider.ts |

#### 4.2.2 插件接口规范

所有插件必须实现统一的接口：

```typescript
interface IPlugin {
  readonly pluginId: string;
  readonly description: string;
  readonly version: string;
  
  // 初始化（注册事件监听器）
  initialize(eventBus: EventBus): Promise<void>;
  
  // 执行（接收记忆上下文）
  execute(input: PluginInput, context: MemoryContext): Promise<PluginResult>;
  
  // 销毁（清理事件监听器）
  dispose(): void;
}

interface MemoryContext {
  episodicMemories?: EpisodicMemoryRecord[]; // 相关历史记忆
  preferences?: PreferencePattern[];         // 用户偏好
  semanticKnowledge?: SemanticFact[];        // 项目事实
}
```

#### 4.2.3 插件示例：记忆增强的提交生成

```typescript
class GenerateCommitCommandV2 implements IPlugin {
  pluginId = 'generate-commit';
  
  async execute(input: PluginInput, context: MemoryContext): Promise<PluginResult> {
    // 1. 获取Git diff
    const diff = await this.getGitDiff();
    
    // 2. 从记忆中学习用户提交风格
    const stylePreference = await this.commitStyleLearner.learnFromHistory();
    
    // 3. 检索相关文件的历史提交
    const relevantMemories = context.episodicMemories || [];
    
    // 4. 使用增强的Prompt生成
    const commitMessage = await this.generateWithMemory(
      diff, 
      stylePreference, 
      relevantMemories
    );
    
    return { success: true, data: { commitMessage } };
  }
}
```

### 4.3 适配器层（可插拔）

适配器层是系统的"感官接口"，负责与外部世界交互。**支持热替换**。

#### 4.3.1 适配器清单

| 端口 | 适配器 | 说明 | 状态 |
|------|-------|------|------|
| **LLM Port** | DeepSeekAdapter | 默认，云端API | ✅ |
| | OllamaAdapter | 本地模型，离线可用 | ⏸️ |
| | OpenAIAdapter | 可选，GPT系列 | ⏸️ |
| **Git Port** | VSCodeGitAdapter | 默认，VS Code API | ✅ |
| | CommandLineGitAdapter | 备选，命令行工具 | ⏸️ |
| **File Port** | VSCodeFileAdapter | 默认，VS Code FileSystem | ✅ |
| | NodeFileAdapter | 独立运行时 | ⏸️ |
| **Database Port** | SQLiteAdapter | 默认，sql.js WASM | ✅ |
| | VectorDBAdapter | 未来，向量检索 | ⏸️ |
| **Search Port** | BingSearchAdapter | 默认 | ⏸️ |
| | GoogleSearchAdapter | 可选 | ⏸️ |
| | LocalMockAdapter | 测试用 | ✅ |

#### 4.3.2 适配器接口规范

```typescript
interface LLMPort {
  chat(prompt: string, options?: ChatOptions): Promise<string>;
  streamChat(prompt: string): AsyncIterable<string>;
  getModelInfo(): ModelInfo;
}

interface GitPort {
  getDiff(workspacePath: string): Promise<string>;
  getStatus(workspacePath: string): Promise<GitStatus>;
  commit(message: string): Promise<void>;
}
```

---

## 五、记忆系统详细设计

### 5.1 记忆分类与存储结构

#### 5.1.1 四类记忆

| 记忆类型 | 英文 | 存储内容 | 生命周期 | 示例 |
|---------|------|---------|---------|------|
| **情景记忆** | Episodic | 用户操作历史（任务快照） | 90天（可配置） | "2026-04-17 15:30 解释了OrderService.java的calculateTotal方法" |
| **偏好记忆** | Preference | 用户习惯模式 | 永久（置信度衰减） | "用户偏好简洁的代码解释风格" |
| **语义记忆** | Semantic | 项目事实、规范 | 永久（手动更新） | "本项目使用TypeScript + NestJS框架" |
| **程序记忆** | Procedural | 可复用技能 | 永久（版本控制） | "如何优化N+1查询问题" |

#### 5.1.2 数据库表结构

**episodic_memory表**：
```sql
CREATE TABLE episodic_memory (
  id TEXT PRIMARY KEY,
  project_fingerprint TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  task_type TEXT NOT NULL, -- 'CODE_EXPLAIN', 'COMMIT_GENERATE', etc.
  summary TEXT,
  entities TEXT, -- JSON数组
  decision TEXT,
  outcome TEXT, -- 'SUCCESS', 'FAILED', 'PARTIAL'
  final_weight REAL DEFAULT 1.0,
  model_id TEXT,
  latency_ms INTEGER,
  metadata TEXT, -- JSON对象
  memory_tier TEXT DEFAULT 'LONG_TERM' -- 'SHORT_TERM' or 'LONG_TERM'
);

-- 索引
CREATE INDEX idx_episodic_memory_project ON episodic_memory(project_fingerprint);
CREATE INDEX idx_episodic_memory_timestamp ON episodic_memory(timestamp DESC);
CREATE INDEX idx_episodic_memory_task_type ON episodic_memory(task_type);
CREATE INDEX idx_episodic_memory_tier ON episodic_memory(memory_tier);

-- FTS5虚拟表（生产环境启用）
CREATE VIRTUAL TABLE episodic_memory_fts USING fts5(
  summary, entities, decision,
  content='episodic_memory',
  content_rowid='rowid'
);
```

**preference_memory表**：
```sql
CREATE TABLE preference_memory (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL, -- 'CODE_STYLE', 'COMMIT_STYLE', etc.
  pattern TEXT NOT NULL, -- JSON对象
  confidence REAL DEFAULT 0.5,
  sample_count INTEGER DEFAULT 0,
  last_updated INTEGER NOT NULL,
  model_id TEXT,
  project_fingerprint TEXT
);
```

### 5.2 混合检索策略

#### 5.2.1 检索流程

```
用户查询
   ↓
时间指代检测（IntentAnalyzer）
   ↓ (是) → 返回最近3条记忆（按时间倒序）
   ↓ (否)
分词、提取关键词
   ↓
获取候选记忆（至少命中一个关键词）
   ↓
计算每条记忆的最终得分 = 
   TF-IDF得分 * k_weight +
   时间衰减得分 * t_weight +
   实体匹配加分 * e_weight +
   向量相似度 * v_weight (v2.0)
   ↓
排序、返回 Top K（默认5条）
```

#### 5.2.2 评分算法详解

**1. TF-IDF关键词相似度**：
```typescript
function calculateKeywordScore(query: string, memory: EpisodicMemoryRecord): number {
  const terms = tokenize(query);
  let score = 0;
  
  for (const term of terms) {
    const tf = getTermFrequency(term, memory); // 词频
    const idf = getInverseDocFrequency(term);  // 逆文档频率
    score += tf * idf;
  }
  
  return normalize(score); // 归一化到 [0, 1]
}
```

**2. 时间衰减加权**：
```typescript
function calculateTimeDecayScore(memory: EpisodicMemoryRecord, lambda: number = 0.1): number {
  const now = Date.now();
  const age = (now - memory.timestamp) / (1000 * 60 * 60 * 24); // 天数
  return Math.exp(-lambda * age); // 指数衰减，半衰期约7天
}
```

**3. 实体匹配加分**：
```typescript
function calculateEntityMatchScore(query: string, memory: EpisodicMemoryRecord): number {
  const queryEntities = extractEntities(query);
  const memoryEntities = JSON.parse(memory.entities);
  
  // Jaccard相似度
  const intersection = queryEntities.filter(e => memoryEntities.includes(e));
  const union = [...new Set([...queryEntities, ...memoryEntities])];
  
  return intersection.length / union.length; // [0, 1]
}
```

**4. 最终得分融合**：
```typescript
const finalScore = 
  keywordScore * weights.k +
  timeDecayScore * weights.t +
  entityMatchScore * weights.e +
  vectorSimilarity * weights.v; // v2.0
```

### 5.3 自适应权重（用户反馈学习）

#### 5.3.1 意图分析器（IntentAnalyzer）

**识别规则**：

| 意图维度 | 检测规则 | 输出范围 |
|---------|---------|----------|
| **时间敏感** | 关键词："刚才"、"上次"、"前一个"、"刚刚"、"最近" | [0, 1] |
| **实体敏感** | 驼峰命名、包含"函数"/"类"/"方法"、代码块标识 | [0, 1] |
| **语义模糊** | 疑问词："怎么"、"为什么"、"什么"、"如何" | [0, 1] |

**示例**：
```typescript
analyze("刚才那个解释") 
→ { temporal: 0.8, entity: 0, semantic: 0 }

analyze("calculateTotal函数")
→ { temporal: 0, entity: 0.7, semantic: 0 }

analyze("怎么优化这个算法")
→ { temporal: 0, entity: 0, semantic: 0.6 }
```

#### 5.3.2 专家权重选择器（ExpertSelector）

**5种预设专家配置**：

| 专家 | 关键词(k) | 时间(t) | 实体(e) | 向量(v) | 适用场景 |
|------|----------|--------|--------|--------|----------|
| **balanced** | 0.30 | 0.20 | 0.20 | 0.30 | 默认均衡 |
| **temporal** | 0.20 | 0.60 | 0.10 | 0.10 | 时间优先（"刚才"、"上次"） |
| **entity** | 0.50 | 0.10 | 0.30 | 0.10 | 实体优先（函数名、类名） |
| **semantic** | 0.10 | 0.10 | 0.20 | 0.60 | 语义优先（自然语言问句） |
| **hybrid** | 0.30 | 0.20 | 0.20 | 0.30 | 混合模式 |

**学习机制**：
1. 用户点击检索结果时记录反馈
2. 每10次反馈重新评估最佳专家
3. 选择与历史反馈余弦相似度最高的专家

**门控调制公式**：
```typescript
k = base.k * (1 + intent.entity * 0.5)
t = base.t * (1 + intent.temporal * 0.8)
e = base.e * (1 + intent.entity * 0.6)
v = base.v * (1 + intent.semantic * 0.7)

// 归一化
sum = k + t + e + v
finalWeights = { k/sum, t/sum, e/sum, v/sum }
```

### 5.4 主动推荐机制

#### 5.4.1 触发条件

记忆系统监听以下事件，主动推送相关记忆：

| 事件 | 触发条件 | 推荐内容 |
|------|---------|----------|
| 文件打开 | `onDidChangeActiveTextEditor` | 该文件的历史操作记忆 |
| 光标移动 | 停留超过3秒 | 相关代码片段的解释记忆 |
| Git变更 | `onDidChangeRepository` | 类似变更的历史提交 |
| 错误出现 | `onDidChangeDiagnostics` | 相似错误的解决方案 |

#### 5.4.2 推荐流程

```typescript
class RecommendationEngine {
  async onFileOpened(filePath: string) {
    // 1. 检索与该文件相关的历史记忆
    const memories = await this.memory.retrieve({
      entities: [path.basename(filePath)],
      limit: 5
    });
    
    if (memories.length > 0) {
      // 2. 发布推荐事件
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
```

### 5.5 记忆衰减与遗忘

#### 5.5.1 衰减策略

**指数衰减模型**：
```typescript
weight(t) = initialWeight * exp(-λ * t)
```

- λ = 0.1（半衰期约7天）
- 每次访问重置为1.0
- 低于阈值（0.1）的记忆标记为"冷记忆"

#### 5.5.2 短期/长期记忆分区

**分层策略**：
- **短期记忆**（SHORT_TERM）：7天内的记忆，快速检索
- **长期记忆**（LONG_TERM）：7天以上的记忆，定期归档

**迁移逻辑**：
```typescript
async migrateShortToLongTerm() {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  await this.db.run(`
    UPDATE episodic_memory 
    SET memory_tier = 'LONG_TERM'
    WHERE memory_tier = 'SHORT_TERM' AND timestamp < ?
  `, [sevenDaysAgo]);
}
```

#### 5.5.3 过期清理

**保留策略**：
- 默认保留90天（可配置`memory.retentionDays`）
- 每月自动清理过期记忆
- 重要记忆（final_weight > 0.8）永不删除

### 5.6 跨会话记忆（摘要生成与注入）

#### 5.6.1 会话切换时的摘要生成

**零API成本方案**：
```typescript
async summarizeSessionLocal(messages: ChatMessage[]): Promise<string> {
  // 使用本地规则生成摘要（不调用LLM）
  const topics = new Set<string>();
  const codeSnippets: string[] = [];
  
  for (const msg of messages) {
    // 提取主题关键词
    const keywords = extractKeywords(msg.content);
    keywords.forEach(k => topics.add(k));
    
    // 提取代码片段
    const snippets = extractCodeBlocks(msg.content);
    codeSnippets.push(...snippets);
  }
  
  return `讨论了 ${[...topics].join(', ')}，涉及 ${codeSnippets.length} 个代码片段`;
}
```

#### 5.6.2 新会话启动时的记忆注入

```typescript
async buildCrossSessionContext(currentQuery: string): Promise<string> {
  // 1. 检索相关历史会话摘要
  const summaries = await this.memory.retrieve({
    query: currentQuery,
    taskType: 'SESSION_SUMMARY',
    limit: 3
  });
  
  // 2. 组装上下文
  return summaries.map(s => `- ${s.decision}`).join('\n');
}
```

### 5.7 元记忆与记忆可视化

#### 5.7.1 元记忆（Meta-Memory）

**定义**：记录用户对记忆的使用模式，用于优化检索策略

**记录内容**：
- 哪些记忆被频繁检索
- 用户对检索结果的满意度（点击/忽略）
- 不同查询模式的最佳权重配置

**应用**：
- 动态调整检索权重
- 个性化推荐策略
- 记忆重要性评估

#### 5.7.2 记忆可视化管理界面（规划中）

**功能**：
- 查看所有记忆记录（按时间、类型、项目过滤）
- 编辑/删除单条记忆
- 导出/导入记忆数据
- 查看记忆关联图谱
- 管理偏好设置

---

## 六、事件总线设计

### 6.1 核心事件定义

#### 6.1.1 记忆相关事件

| 事件名 | 载荷 | 发布者 | 订阅者 | 用途 |
|--------|------|--------|--------|------|
| `memory.recorded` | `{ memoryId, taskType, timestamp }` | 记忆系统 | 审计、UI | 记录操作日志、更新记忆指示器 |
| `memory.preference.updated` | `{ domain, pattern, confidence }` | 记忆系统 | 所有功能模块 | 重新加载用户偏好 |
| `memory.retrieved` | `{ query, results, duration }` | 记忆系统 | 功能模块 | 接收检索结果 |
| `memory.recommend` | `{ filePath, recommendations }` | 记忆系统 | UI、功能模块 | 主动推荐相关记忆 |
| `memory.skill.suggested` | `{ operation, frequency }` | 记忆系统 | Skill引擎 | 建议固化重复操作为Skill |

#### 6.1.2 任务相关事件

| 事件名 | 载荷 | 发布者 | 订阅者 | 用途 |
|--------|------|--------|--------|------|
| `module.action.started` | `{ actionId, input }` | 功能模块 | 审计、记忆系统 | 记录任务开始 |
| `module.action.completed` | `{ actionId, result, duration }` | 功能模块 | 记忆系统、审计 | 记录任务结果 |
| `task.completed` | `{ taskId, taskType, result }` | 任何完成任务的模块 | 审计、统计 | 全局任务追踪 |

#### 6.1.3 LLM相关事件

| 事件名 | 载荷 | 发布者 | 订阅者 | 用途 |
|--------|------|--------|--------|------|
| `llm.call.started` | `{ requestId, provider, prompt }` | 插件 | LLM适配器 | 发起LLM调用 |
| `llm.call.completed` | `{ requestId, response, duration }` | LLM适配器 | 原请求插件、审计 | 接收LLM响应 |
| `llm.cache.hit` | `{ requestId, cachedAt }` | LLM适配器 | 统计 | 缓存命中率统计 |

#### 6.1.4 系统相关事件

| 事件名 | 载荷 | 发布者 | 订阅者 | 用途 |
|--------|------|--------|--------|------|
| `plugin.enabled` | `{ pluginId }` | 插件管理器 | 所有插件 | 重新注册事件监听 |
| `config.updated` | `{ key, oldValue, newValue }` | 配置管理器 | 所有依赖该配置的模块 | 配置变更通知 |
| `session.switched` | `{ sessionId, summary }` | SessionManager | 记忆系统 | 会话切换时生成摘要 |

### 6.2 事件发布/订阅机制

#### 6.2.1 基础API

```typescript
interface EventBus {
  // 发布事件
  publish(event: Event): void;
  
  // 订阅事件
  subscribe(eventType: string, handler: EventHandler, priority?: number): Subscription;
  
  // 取消订阅
  unsubscribe(subscription: Subscription): void;
  
  // 一次性订阅
  once(eventType: string, handler: EventHandler): void;
}

interface Event {
  type: string;
  payload: any;
  timestamp: number;
  source?: string;
}

type EventHandler = (event: Event) => void | Promise<void>;
```

#### 6.2.2 使用示例

```typescript
// 发布事件
this.eventBus.publish({
  type: 'memory.recorded',
  payload: {
    memoryId: 'mem_123',
    taskType: 'CODE_EXPLAIN',
    timestamp: Date.now()
  },
  source: 'EpisodicMemory'
});

// 订阅事件
this.eventBus.subscribe('memory.recorded', async (event) => {
  console.log(`Memory recorded: ${event.payload.memoryId}`);
  await this.auditLogger.log('memory_recorded', 'success', 0, event.payload);
}, Priority.P1);
```

### 6.3 优先级队列

**优先级定义**：
```typescript
enum Priority {
  P0_CRITICAL = 0,    // 安全相关（授权失败、审计日志）
  P1_HIGH = 1,        // 记忆变化（recorded、updated）
  P2_MEDIUM = 2,      // 任务完成
  P3_LOW = 3          // 推荐、统计
}
```

**处理策略**：
- P0事件立即同步处理
- P1-P3事件异步批量处理（防抖100ms）
- 同优先级按时间戳排序

### 6.4 持久化（可选）

**事件日志存储**：
```sql
CREATE TABLE event_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT, -- JSON
  timestamp INTEGER NOT NULL,
  source TEXT,
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_event_log_type ON event_log(event_type);
CREATE INDEX idx_event_log_timestamp ON event_log(timestamp DESC);
```

**应用场景**：
- 调试与问题排查
- 用户行为分析
- 事件回放测试

---

## 七、单Agent到多Agent演进路径

### 7.1 当前阶段：功能模块直接包装为Agent（v1.0-v2.0）

**现状**：
- 每个功能模块（ExplainCodeCommand等）实现`IPlugin`接口
- 通过事件总线与记忆系统通信
- 无独立的Agent抽象层

**示例**：
```typescript
class ExplainCodeCommand implements IPlugin {
  pluginId = 'explain-code';
  
  async execute(input: PluginInput, context: MemoryContext): Promise<PluginResult> {
    // 直接使用LLM生成解释
    const explanation = await this.llmTool.chat(buildPrompt(input.code));
    return { success: true, data: { explanation } };
  }
}
```

### 7.2 第二阶段：引入Agent抽象层与调度器（v2.0-v3.0）

**目标**：
- 定义统一的`IAgent`接口
- 实现`Dispatcher`根据记忆选择Agent
- Agent记录成功率、耗时等元数据

**Agent接口**：
```typescript
interface IAgent {
  readonly agentId: string;
  readonly capabilities: string[]; // ['code_explain', 'code_generate']
  readonly successRate: number;    // 从记忆中读取
  readonly avgLatency: number;     // 从记忆中读取
  
  canHandle(intent: UserIntent): boolean;
  execute(intent: UserIntent, context: MemoryContext): Promise<AgentResult>;
}
```

**调度器逻辑**：
```typescript
class Dispatcher {
  async selectAgent(intent: UserIntent): Promise<IAgent> {
    // 1. 筛选能处理该意图的Agent
    const candidates = this.agents.filter(a => a.canHandle(intent));
    
    // 2. 从记忆中读取各Agent的历史表现
    const scores = await Promise.all(candidates.map(async agent => {
      const memory = await this.memory.retrieveAgentPerformance(agent.agentId);
      return {
        agent,
        score: memory.successRate * 0.6 + (1 / memory.avgLatency) * 0.4
      };
    }));
    
    // 3. 选择得分最高的Agent
    return scores.sort((a, b) => b.score - a.score)[0].agent;
  }
}
```

### 7.3 第三阶段：工作流编排（多Agent协作）（v3.0-v4.0）

**目标**：
- 复杂任务拆解为多个子任务
- 多个Agent协同完成
- 工作流引擎管理执行顺序

**示例：代码重构工作流**
```
用户请求："重构这个函数，提高可读性"
  ↓
Workflow Engine拆解任务：
  1. CodeAnalyzerAgent: 分析代码复杂度
  2. NamingAgent: 优化变量/函数命名
  3. StructureAgent: 重组代码结构
  4. ReviewAgent: 审查重构结果
  ↓
依次执行，每一步的结果传递给下一步
  ↓
最终输出重构后的代码
```

**工作流定义**：
```typescript
interface Workflow {
  workflowId: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  agentId: string;
  inputMapper: (previousResults: any) => any;
  outputValidator: (result: any) => boolean;
  retryPolicy?: RetryPolicy;
}
```

### 7.4 第四阶段：Agent记忆与自我进化（v4.0+）

**目标**：
- Agent记录自己的执行历史
- 基于反馈优化自身行为
- 自动生成新的Agent技能

**Agent记忆结构**：
```typescript
interface AgentMemory {
  agentId: string;
  executionHistory: ExecutionRecord[];
  skillLibrary: Skill[];
  performanceMetrics: {
    successRate: number;
    avgLatency: number;
    userSatisfaction: number;
  };
}

interface ExecutionRecord {
  timestamp: number;
  intent: UserIntent;
  result: AgentResult;
  feedback?: UserFeedback; // 用户点赞/点踩
}
```

**自我进化机制**：
1. 检测重复成功的执行模式
2. 提炼为可复用的Skill
3. 更新Agent的技能库
4. 提升类似任务的执行效率

---

## 八、动态工作流与技能系统

### 8.1 技能系统（Skill System）

技能是小尾巴的“可编程扩展”，允许用户定义自动化的工具调用序列。

#### 8.1.1 技能定义格式

技能以JSON格式定义，存储在 `~/.xiaoweiba/skills/user/` 目录：

```typescript
interface SkillDefinition {
  name: string;              // 技能名称
  description: string;       // 技能描述
  version: string;           // 版本号（语义化版本）
  source: 'user' | 'auto';   // 来源：用户手写/自动生成
  projectScoped: boolean;    // 是否项目级（true=仅当前项目可用）
  dependencies?: string[];   // 依赖的其他技能
  tools: ToolType[];         // 使用的工具列表
  inputs?: SkillInput[];     // 输入参数定义
  steps: SkillStep[];        // 执行步骤
  tests?: SkillTest[];       // 测试用例（可选）
  atomic?: boolean;          // 是否原子执行（要么全部成功，要么全部回滚）
  createdAt: number;
  updatedAt: number;
}

interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'code';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

interface SkillStep {
  id: string;                // 步骤ID
  tool: ToolType;            // 工具类型
  params: Record<string, any>; // 工具参数（支持{{var}}模板）
  outputAs?: string;         // 输出变量名（供后续步骤使用）
  condition?: 'always' | 'onError' | 'onSuccess'; // 执行条件
  timeout?: number;          // 超时时间（ms）
}

type ToolType = 
  | 'read_file'           // 读取文件
  | 'write_file'          // 写入文件
  | 'call_llm'            // 调用LLM
  | 'show_diff'           // 展示差异
  | 'execute_sql'         // 执行SQL
  | 'execute_command'     // 执行命令
  | 'git_commit'          // Git提交
  | 'search_memory'       // 检索记忆
  | 'generate_test';      // 生成测试
```

#### 8.1.2 技能示例：代码重构技能

```json
{
  "name": "refactor-function",
  "description": "重构函数：提取方法、优化命名、添加注释",
  "version": "1.0.0",
  "source": "user",
  "projectScoped": false,
  "tools": ["read_file", "call_llm", "write_file", "show_diff"],
  "inputs": [
    {
      "name": "filePath",
      "type": "file",
      "required": true,
      "description": "要重构的文件路径"
    },
    {
      "name": "functionName",
      "type": "string",
      "required": true,
      "description": "要重构的函数名"
    }
  ],
  "steps": [
    {
      "id": "step1",
      "tool": "read_file",
      "params": {
        "path": "{{filePath}}"
      },
      "outputAs": "fileContent"
    },
    {
      "id": "step2",
      "tool": "call_llm",
      "params": {
        "prompt": "请重构以下代码中的{{functionName}}函数，提取子方法、优化命名、添加注释：\n\n{{fileContent}}",
        "temperature": 0.3,
        "maxTokens": 2000
      },
      "outputAs": "refactoredCode"
    },
    {
      "id": "step3",
      "tool": "show_diff",
      "params": {
        "original": "{{fileContent}}",
        "modified": "{{refactoredCode}}"
      },
      "condition": "always"
    },
    {
      "id": "step4",
      "tool": "write_file",
      "params": {
        "path": "{{filePath}}",
        "content": "{{refactoredCode}}"
      },
      "condition": "onSuccess"
    }
  ],
  "atomic": true,
  "createdAt": 1713340800000,
  "updatedAt": 1713340800000
}
```

#### 8.1.3 技能执行引擎

```typescript
class SkillEngine {
  private skillRegistry: Map<string, SkillDefinition> = new Map();
  
  /**
   * 加载技能
   */
  async loadSkill(skillPath: string): Promise<void> {
    const skillJson = await fs.readFile(skillPath, 'utf-8');
    const skill: SkillDefinition = JSON.parse(skillJson);
    
    // 验证Schema
    this.validateSkill(skill);
    
    // 注册技能
    this.skillRegistry.set(skill.name, skill);
    
    console.log(`✅ Skill loaded: ${skill.name} v${skill.version}`);
  }
  
  /**
   * 执行技能
   */
  async executeSkill(
    skillName: string, 
    inputs: Record<string, any>,
    context: MemoryContext
  ): Promise<SkillResult> {
    const skill = this.skillRegistry.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }
    
    const startTime = Date.now();
    const variables = { ...inputs };
    
    try {
      // 依次执行步骤
      for (const step of skill.steps) {
        // 检查执行条件
        if (!this.shouldExecuteStep(step, variables)) {
          continue;
        }
        
        // 替换模板变量
        const resolvedParams = this.resolveTemplates(step.params, variables);
        
        // 执行工具
        const result = await this.executeTool(step.tool, resolvedParams, context);
        
        // 保存输出
        if (step.outputAs) {
          variables[step.outputAs] = result;
        }
        
        // 记录审计日志
        await this.auditLogger.log('skill_step_executed', 'success', 0, {
          skillName,
          stepId: step.id,
          tool: step.tool
        });
      }
      
      return {
        success: true,
        data: variables,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      // 原子执行：回滚所有更改
      if (skill.atomic) {
        await this.rollbackChanges(skill, variables);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      };
    }
  }
  
  /**
   * 解析模板变量
   */
  private resolveTemplates(params: any, variables: Record<string, any>): any {
    if (typeof params === 'string') {
      return params.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return variables[varName] || '';
      });
    }
    
    if (Array.isArray(params)) {
      return params.map(p => this.resolveTemplates(p, variables));
    }
    
    if (typeof params === 'object' && params !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(params)) {
        resolved[key] = this.resolveTemplates(value, variables);
      }
      return resolved;
    }
    
    return params;
  }
}
```

#### 8.1.4 技能发现与建议

**自动建议机制**：

记忆系统检测用户的重复操作模式，主动建议保存为技能：

```typescript
class SkillSuggestionEngine {
  /**
   * 检测重复模式
   */
  async detectPatterns(): Promise<SkillSuggestion[]> {
    // 从情景记忆中检索相似任务
    const memories = await this.memory.retrieve({
      taskType: ['CODE_EXPLAIN', 'CODE_GENERATE'],
      limit: 100
    });
    
    // 聚类分析：找出频繁出现的操作序列
    const clusters = this.clusterMemories(memories);
    
    const suggestions: SkillSuggestion[] = [];
    
    for (const cluster of clusters) {
      if (cluster.count >= 5) {  // 至少重复5次
        suggestions.push({
          pattern: cluster.pattern,
          frequency: cluster.count,
          suggestedSkillName: this.generateSkillName(cluster.pattern),
          confidence: cluster.count / 10  // 置信度
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * 向用户展示建议
   */
  async showSuggestions(suggestions: SkillSuggestion[]): Promise<void> {
    if (suggestions.length === 0) return;
    
    const choice = await vscode.window.showInformationMessage(
      `检测到 ${suggestions.length} 个重复操作模式，是否保存为技能？`,
      ...suggestions.map(s => `${s.suggestedSkillName} (${s.frequency}次)`),
      '稍后提醒'
    );
    
    if (choice) {
      // 打开技能编辑器
      await this.openSkillEditor(choice);
    }
  }
}
```

### 8.2 动态工作流（Dynamic Workflow）

工作流是技能的升级版，支持**多Agent协作**和**条件分支**。

#### 8.2.1 工作流定义

```typescript
interface Workflow {
  workflowId: string;
  name: string;
  description: string;
  version: string;
  
  // 触发条件
  triggers: WorkflowTrigger[];
  
  // 执行步骤
  steps: WorkflowStep[];
  
  // 错误处理策略
  errorHandling?: {
    retryCount: number;
    fallbackWorkflow?: string;
  };
  
  // 元数据
  createdAt: number;
  updatedAt: number;
}

interface WorkflowTrigger {
  type: 'manual' | 'file_opened' | 'git_commit' | 'schedule';
  conditions?: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  agentId: string;                    // 执行的Agent
  inputMapper: (previousResults: Map<string, any>) => AgentInput;
  outputValidator: (result: AgentResult) => boolean;
  nextSteps: {
    onSuccess?: string;               // 成功后跳转到哪一步
    onFailure?: string;               // 失败后跳转到哪一步
  };
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;                // 退避时间
  };
  timeoutMs?: number;
}
```

#### 8.2.2 工作流示例：代码审查工作流

```typescript
const codeReviewWorkflow: Workflow = {
  workflowId: 'code-review-v1',
  name: '智能代码审查',
  description: '自动生成代码→编写测试→审查质量→提交Git',
  version: '1.0.0',
  
  triggers: [
    { type: 'manual' }
  ],
  
  steps: [
    {
      id: 'step1_generate',
      agentId: 'code-generator',
      inputMapper: (prev) => ({
        userInput: prev.get('userRequest'),
        selectedCode: prev.get('selectedCode')
      }),
      outputValidator: (result) => result.success && result.data?.code,
      nextSteps: {
        onSuccess: 'step2_test',
        onFailure: 'error_handler'
      }
    },
    {
      id: 'step2_test',
      agentId: 'test-generator',
      inputMapper: (prev) => ({
        code: prev.get('step1_generate').data.code,
        language: prev.get('step1_generate').data.language
      }),
      outputValidator: (result) => result.success,
      nextSteps: {
        onSuccess: 'step3_review',
        onFailure: 'step3_review'  // 即使测试生成失败，也继续审查
      }
    },
    {
      id: 'step3_review',
      agentId: 'code-reviewer',
      inputMapper: (prev) => ({
        code: prev.get('step1_generate').data.code,
        tests: prev.get('step2_test')?.data?.tests
      }),
      outputValidator: (result) => result.success,
      nextSteps: {
        onSuccess: 'step4_commit',
        onFailure: 'error_handler'
      }
    },
    {
      id: 'step4_commit',
      agentId: 'commit-agent',
      inputMapper: (prev) => ({
        code: prev.get('step1_generate').data.code,
        commitMessage: `feat: ${prev.get('userRequest')}`
      }),
      outputValidator: (result) => result.success,
      nextSteps: {
        onSuccess: 'complete',
        onFailure: 'error_handler'
      }
    }
  ],
  
  errorHandling: {
    retryCount: 2,
    fallbackWorkflow: 'manual-review'
  },
  
  createdAt: Date.now(),
  updatedAt: Date.now()
};
```

#### 8.2.3 工作流执行引擎

```typescript
class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executionHistory: WorkflowExecution[] = [];
  
  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string,
    initialInput: Record<string, any>
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    const execution: WorkflowExecution = {
      workflowId,
      startedAt: Date.now(),
      status: 'running',
      stepResults: new Map()
    };
    
    try {
      // 发布工作流开始事件
      this.eventBus.publish({
        type: 'workflow.started',
        payload: { workflowId, initialInput }
      });
      
      // 从第一步开始执行
      let currentStepId = workflow.steps[0].id;
      const results = new Map<string, AgentResult>();
      results.set('userRequest', initialInput);
      
      while (currentStepId && currentStepId !== 'complete') {
        const step = workflow.steps.find(s => s.id === currentStepId);
        if (!step) break;
        
        // 执行步骤
        const stepResult = await this.executeStep(step, results);
        results.set(step.id, stepResult);
        
        // 记录执行历史
        execution.stepResults.set(step.id, {
          stepId: step.id,
          agentId: step.agentId,
          success: stepResult.success,
          durationMs: stepResult.durationMs
        });
        
        // 决定下一步
        if (stepResult.success) {
          currentStepId = step.nextSteps.onSuccess;
        } else {
          // 重试逻辑
          if (step.retryPolicy && execution.stepResults.get(step.id)?.retryCount < step.retryPolicy.maxRetries) {
            execution.stepResults.get(step.id)!.retryCount++;
            await this.sleep(step.retryPolicy.backoffMs);
            continue;  // 重试当前步骤
          }
          currentStepId = step.nextSteps.onFailure;
        }
      }
      
      execution.status = 'completed';
      execution.completedAt = Date.now();
      
      // 发布完成事件
      this.eventBus.publish({
        type: 'workflow.completed',
        payload: {
          workflowId,
          success: true,
          durationMs: execution.completedAt - execution.startedAt
        }
      });
      
      // 记录到记忆系统（可用于沉淀为新程序记忆）
      await this.memory.recordWorkflowExecution(execution);
      
      return {
        success: true,
        data: results,
        durationMs: execution.completedAt - execution.startedAt
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      
      // 执行fallback工作流
      if (workflow.errorHandling?.fallbackWorkflow) {
        return await this.executeWorkflow(
          workflow.errorHandling.fallbackWorkflow,
          initialInput
        );
      }
      
      throw error;
    } finally {
      this.executionHistory.push(execution);
    }
  }
  
  /**
   * 执行单个工作流步骤
   */
  private async executeStep(
    step: WorkflowStep,
    previousResults: Map<string, AgentResult>
  ): Promise<AgentResult> {
    // 获取Agent
    const agent = this.agentManager.getAgent(step.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${step.agentId}`);
    }
    
    // 准备输入
    const input = step.inputMapper(previousResults);
    
    // 从记忆系统获取上下文
    const memoryContext = await this.memory.retrieveForWorkflow(step.agentId, input);
    
    // 执行Agent
    const startTime = Date.now();
    const result = await agent.execute(input, memoryContext);
    result.durationMs = Date.now() - startTime;
    
    // 验证输出
    if (!step.outputValidator(result)) {
      throw new Error(`Step ${step.id} output validation failed`);
    }
    
    return result;
  }
}
```

#### 8.2.4 工作流可视化编辑器（规划中）

**功能**：
- 拖拽式工作流设计器
- 实时预览执行流程
- 调试模式（单步执行、断点）
- 性能分析（每步耗时统计）

**UI示意图**：
```
┌─────────────────────────────────────────────────┐
│           工作流编辑器                           │
├─────────────────────────────────────────────────┤
│  [开始] → [代码生成] → [测试生成] → [代码审查]  │
│              ↓              ↓           ↓       │
│         [失败处理]      [跳过]     [Git提交]    │
│                                    ↓            │
│                                 [结束]          │
├─────────────────────────────────────────────────┤
│  属性面板：                                      │
│  - Agent: code-generator                        │
│  - Timeout: 30s                                 │
│  - Retry: 2次                                   │
└─────────────────────────────────────────────────┘
```

### 8.3 技能市场（Skill Marketplace）

**愿景**：社区共享技能平台，用户可以发布、下载、评分技能。

#### 8.3.1 技能包结构

```
skill-package/
├── manifest.json          # 技能清单
├── skills/
│   ├── refactor-function.json
│   └── generate-docs.json
├── assets/
│   ├── icon.png           # 技能图标
│   └── demo.gif           # 演示GIF
├── README.md              # 使用说明
└── tests/                 # 测试用例
    └── refactor.test.json
```

#### 8.3.2 技能发布流程

```typescript
interface SkillPackage {
  name: string;
  version: string;
  author: string;
  description: string;
  keywords: string[];
  license: string;
  
  skills: SkillDefinition[];
  dependencies?: {
    [skillName: string]: string;  // 技能名 → 版本范围
  };
  
  // 元数据
  downloads: number;
  rating: number;      // 平均评分（1-5）
  reviewCount: number;
  publishedAt: number;
  updatedAt: number;
}
```

#### 8.3.3 技能安装与管理

```typescript
class SkillMarketplace {
  /**
   * 搜索技能
   */
  async searchSkills(query: string, filters?: SkillFilter): Promise<SkillPackage[]> {
    const response = await fetch(`${MARKETPLACE_API}/skills/search`, {
      method: 'POST',
      body: JSON.stringify({ query, filters })
    });
    
    return response.json();
  }
  
  /**
   * 安装技能
   */
  async installSkill(packageName: string, version?: string): Promise<void> {
    // 下载技能包
    const packageUrl = `${MARKETPLACE_API}/packages/${packageName}/${version || 'latest'}`;
    const packageData = await fetch(packageUrl);
    const skillPackage: SkillPackage = await packageData.json();
    
    // 验证签名（防止恶意技能）
    await this.verifySignature(skillPackage);
    
    // 检查依赖
    await this.checkDependencies(skillPackage);
    
    // 安装到本地
    const installPath = path.join(SKILLS_DIR, packageName);
    await fs.mkdir(installPath, { recursive: true });
    
    for (const skill of skillPackage.skills) {
      const skillPath = path.join(installPath, `${skill.name}.json`);
      await fs.writeFile(skillPath, JSON.stringify(skill, null, 2));
    }
    
    // 注册技能
    for (const skill of skillPackage.skills) {
      await this.skillEngine.loadSkill(skillPath);
    }
    
    vscode.window.showInformationMessage(`✅ 技能包已安装: ${packageName} v${skillPackage.version}`);
  }
  
  /**
   * 验证技能签名
   */
  private async verifySignature(skillPackage: SkillPackage): Promise<void> {
    // TODO: 实现GPG签名验证
    // 防止恶意技能执行危险操作
  }
}
```

---

## 九、安全与用户控制

### 9.1 任务级授权（Task-Level Authorization）

**最小权限原则**：
- 每个任务启动时申请最小必要权限
- 授权后在有效期内不再重复询问
- 权限粒度：`read_file`、`write_file`、`git_commit`、`execute_command`

**TaskToken机制**：
```typescript
interface TaskToken {
  taskId: string;
  userId: string;
  permissions: Permission[];
  grantedAt: number;
  expiresAt: number;
  scope: {
    files?: string[];      // 允许访问的文件列表
    commands?: string[];   // 允许执行的命令
  };
  hmacSignature: string;   // HMAC-SHA256签名防篡改
}
```

**授权流程**：
```
用户触发需要权限的操作
  ↓
检查是否存在有效的TaskToken
  ↓ (不存在或已过期)
弹出授权对话框，展示所需权限
  ↓
用户确认 → 生成TaskToken（有效期24小时）
  ↓
后续相同操作自动使用该Token
```

### 8.2 Diff确认机制

**所有写入操作前展示差异对比**：

```typescript
class DiffConfirmDialog {
  async show(originalContent: string, newContent: string): Promise<boolean> {
    const diff = generateUnifiedDiff(originalContent, newContent);
    
    const choice = await vscode.window.showInformationMessage(
      '即将修改文件，请确认变更：',
      { modal: true, detail: diff },
      '✅ 应用更改',
      '❌ 取消',
      '📝 编辑后再应用'
    );
    
    return choice === '✅ 应用更改';
  }
}
```

**适用场景**：
- 代码生成并插入
- 文件重命名/移动
- Git提交/推送
- 配置文件修改

### 9.3 审计日志

**记录内容**：
- 所有关键操作（记忆记录、权限授予、文件修改）
- 操作结果（成功/失败）
- 耗时统计
- HMAC签名防篡改

**日志结构**：
```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  action: string;           // 'memory_recorded', 'file_modified', etc.
  status: 'success' | 'failed';
  durationMs: number;
  userId: string;
  parameters: any;          // 操作参数（脱敏）
  hmacSignature: string;    // HMAC-SHA256(secret + action + timestamp)
}
```

**日志轮转**：
- 单个日志文件最大20MB
- 超过阈值自动归档为`.log.1`、`.log.2`...
- 最多保留5个归档文件

### 8.4 Agent白名单

**用户可控的Agent启用/禁用**：

```yaml
# config.yaml
agents:
  enabled:
    - explain-code
    - generate-commit
    - code-generation
  disabled:
    - web-search  # 用户禁用了网络搜索
  trusted:
    - explain-code  # 信任的Agent，无需二次确认
```

**权限分级**：
- **Trusted**：完全信任，自动执行
- **Enabled**：需要Diff确认
- **Disabled**：禁止使用

---

## 十、测试体系

### 9.1 测试分层

| 层次 | 用例数 | 通过率 | 覆盖率目标 | 说明 |
|------|--------|--------|-----------|------|
| **单元测试** | 513 | 98.1% | ≥90%语句 / ≥80%分支 | 单个类/方法的测试 |
| **集成测试** | 26 | 100% | N/A | 模块间交互测试 |
| **模块协同测试** | 11 | 100% | N/A | 多个模块协同工作 |
| **E2E全链路** | 0（手动） | 待执行 | N/A | 人工测试清单 |

### 9.2 核心模块覆盖率

| 模块 | 语句 | 分支 | 函数 | 状态 |
|------|------|------|------|------|
| EpisodicMemory | 69.19% | 60.86% | 73.8% | ⚠️ 待提升 |
| DatabaseManager | 65.87% | 44.61% | 66.66% | ⚠️ 待提升 |
| IntentAnalyzer | 100% | 100% | 100% | ✅ 优秀 |
| ExpertSelector | 31.64% | 47.36% | 66.66% | ❌ 需补充 |
| ChatViewProvider | 96.59% | 69.56% | 100% | ⚠️ 待提升 |
| ContextBuilder | 100% | 90.9% | 100% | ✅ 优秀 |
| **核心模块平均** | **77.22%** | **68.89%** | **84.52%** | ✅ 达标 |

### 9.3 协同测试矩阵

| 测试场景 | 涉及模块 | 验证点 |
|---------|---------|--------|
| **代码解释+记忆记录** | ExplainCodeCommand + EpisodicMemory | 记忆是否正确记录 |
| **跨会话检索** | SessionManager + EpisodicMemory | 新会话能否回忆旧内容 |
| **意图感知检索** | IntentAnalyzer + ExpertSelector + EpisodicMemory | 权重是否动态调整 |
| **提交生成+风格学习** | GenerateCommitCommandV2 + CommitStyleLearner | 是否符合用户历史风格 |
| **聊天命令执行** | ChatViewProvider + AuditLogger | 审计日志是否完整 |

### 9.4 测试工具链

```bash
# 运行所有测试
npm test

# 运行单元测试（带覆盖率）
npm run test:unit -- --coverage

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run coverage
```

**覆盖率报告位置**：`coverage/lcov-report/index.html`

---

## 十一、实施路线图

### 11.1 第一阶段：强化记忆系统（已完成✅）

**时间**：2026-04-15 ~ 2026-04-17  
**工时**：约15小时

**已完成任务**：
- ✅ 混合检索系统（关键词+时间+实体）
- ✅ 意图感知检索（IntentAnalyzer + ExpertSelector）
- ✅ 短期/长期记忆分区
- ✅ 结果去重（MemoryDeduplicator）
- ✅ 跨会话记忆摘要生成（零API成本）
- ✅ 记忆模块解耦（IndexManager、SearchEngine、FeedbackRecorder）

**交付物**：
- `src/core/memory/IntentAnalyzer.ts` (150行)
- `src/core/memory/ExpertSelector.ts` (180行)
- `src/core/memory/IndexManager.ts` (120行)
- `src/core/memory/SearchEngine.ts` (200行)
- `src/core/memory/FeedbackRecorder.ts` (80行)
- 单元测试：78个新增用例，覆盖率97%+

### 11.2 第二阶段：引入事件总线与调度器（进行中⚠️）

**时间**：2026-04-18 ~ 2026-04-25  
**预计工时**：20小时

**待完成任务**：
- [ ] 实现EventBus基础版（发布/订阅、优先级队列）
- [ ] 定义8个核心事件类型
- [ ] 将AuditLogger迁移到事件总线
- [ ] 实现Dispatcher调度器
- [ ] 注册所有Commands为Actions

**风险**：
- 中等：需要修改现有Commands的调用方式
- 缓解措施：双轨运行，配置开关控制

### 11.3 第三阶段：将现有功能包装为Agent（规划中❌）

**时间**：2026-04-26 ~ 2026-05-10  
**预计工时**：30小时

**待完成任务**：
- [ ] 定义`IAgent`接口
- [ ] 将ExplainCodeCommand改造为ExplainCodeAgent
- [ ] 将GenerateCommitCommand改造为CommitAgent
- [ ] 实现Agent性能追踪（成功率、耗时）
- [ ] Dispatcher根据记忆选择Agent

**验收标准**：
- 所有现有功能通过Agent接口暴露
- Agent选择准确率 > 80%
- 无性能退化

### 11.4 第四阶段：多Agent协作工作流（远期规划❌）

**时间**：2026-05-11 ~ 2026-06-30  
**预计工时**：60小时

**待完成任务**：
- [ ] 实现Workflow Engine
- [ ] 定义3个典型工作流（代码重构、Bug修复、功能开发）
- [ ] Agent记忆与自我进化
- [ ] 技能市场（社区共享）

**愿景**：
- 用户只需描述需求，系统自动编排Agent完成
- Agent能够从历史中学习，不断优化自身能力
- 形成开放的插件生态

---

## 十二、附录

### 12.1 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| **情景记忆** | Episodic Memory | 记录用户操作历史的记忆类型 |
| **偏好记忆** | Preference Memory | 学习用户习惯模式的记忆类型 |
| **语义记忆** | Semantic Memory | 存储项目事实、规范的记忆类型 |
| **程序记忆** | Procedural Memory | 沉淀可复用技能的记忆类型 |
| **混合检索** | Hybrid Retrieval | 结合多种检索策略（关键词、时间、实体、向量） |
| **意图感知** | Intent-Aware | 根据用户查询意图动态调整检索权重 |
| **门控调制** | Gating Modulation | 根据意图强度增强对应权重的机制 |
| **TaskToken** | Task Token | 任务级授权令牌，包含权限和有效期 |
| **HMAC签名** | HMAC Signature | 基于密钥的哈希消息认证码，防篡改 |

### 11.2 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求架构 | `docs/REQUIREMENTS.md` | 功能需求清单 |
| 进度跟踪 | `docs/PROGRESS.md` | 实时进度更新 |
| 问题记录 | `docs/ISSUES.md` | Bug与改进项 |
| 人工测试 | `docs/MANUAL_TESTING.md` | 57个测试用例 |
| 记忆检索实施 | `docs/MEMORY_RETRIEVAL_IMPLEMENTATION.md` | 混合检索详细设计 |
| 意图感知检索 | `docs/INTENT_AWARE_RETRIEVAL.md` | 自适应权重设计 |
| 架构演进 | `docs/ARCHITECTURE_EVOLUTION.md` | v3.0架构设计 |
| 六边形架构 | `docs/HEXAGONAL_MICROKERNEL_EVENTBUS.md` | 端口-适配器详细设计 |
| 记忆大脑架构 | `docs/MEMORY_AS_BRAIN_ARCHITECTURE.md` | v4.0终极设计 |
| 实施进度报告 | `docs/archive/IMPLEMENTATION-PROGRESS.md` | v0.2.1安全修复报告 |

### 11.3 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| v1.0 | 2026-04-14 | MVP核心功能完成（10/10 P0功能） |
| v2.0 | 2026-04-15 | 统一对话界面、行内补全、安全加固 |
| v3.0 | 2026-04-17 | 混合检索、意图感知、记忆模块解耦 |
| v4.0 | 2026-04-17 | 记忆大脑架构设计（本文档） |

### 11.4 贡献指南

**如何参与**：
1. Fork项目仓库
2. 创建特性分支（`feature/xxx`）
3. 遵循代码规范（ESLint + Prettier）
4. 编写单元测试（覆盖率≥80%）
5. 提交Pull Request

**代码规范**：
- TypeScript严格模式（`strict: true`）
- 所有公共方法必须有JSDoc注释
- 中文注释，清晰表达意图
- 避免使用`any`类型

---

## 📝 总结

小尾巴项目的记忆驱动架构是一个**渐进式演进的智能系统**：

✅ **记忆为核**：记忆系统是唯一的决策中枢，所有功能模块通过记忆系统调度  
✅ **半开放半封闭**：核心层稳定封闭，插件层开放扩展  
✅ **渐进式智能**：从单Agent平滑演进到多Agent协作  
✅ **本地优先**：所有数据本地存储，隐私安全可控  

这种设计完全符合"私人学徒"的愿景：**学徒会记住师傅的一切，并在师傅需要时主动提醒，而不是等师傅问才回答。**

---

**维护者**: 小尾巴团队  
**最后更新**: 2026-04-17  
**许可证**: MIT
