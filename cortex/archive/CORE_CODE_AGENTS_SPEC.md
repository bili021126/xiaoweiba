# Cortex 代码智能矩阵：四大核心 Agent 规范 v1.0

**代码解释 · 代码生成 · 代码补全 · SQL 优化**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🧠 **Phase 1-2 核心规范**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、代码解释 Agent（CodeExplainer）](#一代码解释-agentcodeexplainer)
2. [二、代码生成 Agent（CodeGenerator）](#二代码生成-agentcodegenerator)
3. [三、代码补全 Agent（CompletionAgent）](#三代码补全-agentcompletionagent)
4. [四、SQL 优化 Agent（SQLOptimizer）](#四sql-优化-agentsqloptimizer)
5. [五、四个 Agent 的横向对比](#五四个-agent-的横向对比)

---

## 一、代码解释 Agent（CodeExplainer）

**定位**：深度理解代码逻辑，用自然语言解释“这段代码做了什么、为什么这样写、有什么潜在问题”。

| 属性 | 值 |
|:---|:---|
| **id** | `code_explainer` |
| **supportedIntents** | `["explain_code", "analyze_logic", "find_bugs"]` |
| **推荐模型** | `deepseek-v4-pro`（需要深度推理） |
| **思考模式** | 可选开启，用于复杂函数或算法分析 |

### 1.1 System Prompt 核心指令

```text
你是一个代码解释专家。你的工作是：
1. 阅读给定的代码，理解其整体功能和关键逻辑。
2. 用清晰、有条理的自然语言解释代码。
3. 解释时先概述整体功能，再分步骤说明关键逻辑。
4. 如果发现潜在问题（安全漏洞、性能瓶颈、错误处理缺失），请明确指出。
5. 根据用户偏好{preference.verbosity}调整解释的详细程度。
```

### 1.2 工具集（Function Calling）

- `read_file(path)` - 读取相关文件以获取完整上下文
- `search_memory(query)` - 搜索历史解释记录作为参考
- `search_code(query)` - 语义搜索项目中的相关代码片段

### 1.3 执行流程

1. 接收 `intent`（包含 `filePath`, `selectedCode`, `language`）
2. 从 `context.episodic` 获取历史解释记录（注入 System Prompt 尾部）
3. 从 `context.semantic` 获取相关代码片段
4. 调用 DeepSeek 对话补全（必要时开启思考模式），流式输出解释
5. 发布 `TaskCompleted` 事件，记录操作记忆

---

## 二、代码生成 Agent（CodeGenerator）

**定位**：根据自然语言需求生成、重构或补全代码，支持多文件操作。

| 属性 | 值 |
|:---|:---|
| **id** | `code_generator` |
| **supportedIntents** | `["generate_code", "refactor_code", "implement_feature"]` |
| **推荐模型** | `deepseek-v4-pro`（复杂生成任务） |
| **思考模式** | 默认开启，`reasoning_effort=high` |

### 2.1 System Prompt 核心指令

```text
你是一个高级软件工程师。你的工作是：
1. 根据用户需求生成完整、可运行的代码。
2. 遵循最佳实践，包含必要的错误处理和类型注解。
3. 生成代码前，先用 `read_file` 了解现有项目结构和相关文件。
4. 生成后，如果需要，可以运行构建和测试来验证。
5. 所有文件写入前，必须通过 `show_diff` 展示变更，并获得用户确认。
6. 用户偏好：{preference.code_style}
```

### 2.2 工具集

| 工具 | 用途 |
|:---|:---|
| `read_file(path)` | 读取项目文件，了解上下文 |
| `write_file(path, content)` | 写入生成的代码（受安全护栏保护） |
| `show_diff(original, modified)` | 展示变更，请求确认 |
| `execute_shell(command)` | 运行构建、测试、lint |
| `search_code(query)` | 搜索项目中类似的实现作为参考 |
| `search_memory(query)` | 查询历史成功的生成模式 |

### 2.3 安全控制

- 写操作需持有有效 `TaskToken`（由 Meta-Agent 在调度时生成并注入 intent）
- 写入前必须调用 `show_diff`，用户确认后才实际写入
- Shell 命令受白名单限制

### 2.4 执行流程

```text
接收意图（包含需求和目标路径）
    ↓
检索记忆上下文（历史生成模式 + 项目知识）
    ↓
调用 LLM（思考模式）生成代码
    ↓
展示 Diff → 等待用户确认
    ↓
写入文件 → 运行构建/测试 → 失败则启动闭环修复
    ↓
记录操作记忆 + 更新语义记忆（新增文件的向量索引）
```

### 2.5 与全闭环联动

若用户请求的是模块级任务（如“创建一个用户管理模块”），`CodeGenerator` 可与 `LoopController` 协同工作，自动完成“编码→构建→测试→修复”的闭环。

---

## 三、代码补全 Agent（CompletionAgent）

**定位**：低延迟的行内代码补全，使用 DeepSeek FIM 专用接口。

| 属性 | 值 |
|:---|:---|
| **id** | `completion_agent` |
| **supportedIntents** | `["inline_completion"]` |
| **推荐模型** | `deepseek-v4-flash`（低延迟）或 `deepseek-v4-pro`（高精度） |
| **接口** | `POST https://api.deepseek.com/beta/completions`（FIM） |

### 3.1 与对话补全的本质区别

- 不使用 `chat/completions`，而是 `completions`（FIM 补全接口）
- 输入：代码前缀（`prompt`）和可选后缀（`suffix`）
- 输出：纯文本补全，不生成对话
- 延迟要求：< 500ms

### 3.2 执行流程

```python
def complete(prefix: str, suffix: str = "", language: str = "") -> str:
    response = client.completions.create(
        model="deepseek-v4-flash",   # 轻量模型，低延迟
        prompt=prefix,
        suffix=suffix,
        max_tokens=64,
        temperature=0.1,
        stop=["\n\n", "\r\n\r\n"],   # 遇到空行停止
        extra_headers={"base_url": "https://api.deepseek.com/beta"}
    )
    return response.choices[0].text
```

### 3.3 缓存策略

- 以 `(prefix_hash, suffix_hash)` 为键，缓存最近的补全结果
- TTL 5秒，避免重复请求

### 3.4 与记忆系统的集成

- 补全不触发操作记忆记录（原则一：只记“事”，不记“话”）
- 但可记录**采纳率**到偏好记忆中，用于评估用户对该模型的接受度

---

## 四、SQL 优化 Agent（SQLOptimizer）

**定位**：分析 SQL 语句性能，提供索引建议和改写优化。

| 属性 | 值 |
|:---|:---|
| **id** | `sql_optimizer` |
| **supportedIntents** | `["optimize_sql", "analyze_query_plan", "suggest_indexes"]` |
| **推荐模型** | `deepseek-v4-pro` |
| **思考模式** | 开启，`reasoning_effort=high` |

### 4.1 System Prompt 核心指令

```text
你是一个数据库性能优化专家。你的工作是：
1. 分析给定的 SQL 语句，识别性能瓶颈
2. 提供优化后的 SQL（或说明无需优化）
3. 建议合适的索引
4. 使用 `analyze_execution_plan` 工具查看实际执行计划
5. 解释优化原理，让用户理解为什么这样改更好
```

### 4.2 工具集

| 工具 | 用途 |
|:---|:---|
| `analyze_execution_plan(sql)` | 执行 EXPLAIN 分析查询计划 |
| `show_table_schema(table)` | 查看表结构和现有索引 |
| `read_file(path)` | 读取 ORM 模型定义或 SQL 文件 |
| `search_memory(query)` | 查询历史 SQL 优化记录 |

### 4.3 执行流程

```text
接收意图（包含待优化的 SQL）
    ↓
检索记忆上下文（历史优化记录 + 相关表结构知识）
    ↓
调用 LLM（思考模式）：
    1. 理解 SQL 意图
    2. 调用 analyze_execution_plan 查看执行计划
    3. 调用 show_table_schema 获取表结构
    4. 分析瓶颈（全表扫描、缺失索引、子查询等）
    5. 生成优化后的 SQL + 索引建议
    ↓
流式输出优化报告（包含优化前后对比）
    ↓
记录操作记忆（总结优化内容，提取表名、SQL 类型等实体）
```

### 4.4 输出示例

```markdown
## SQL 优化报告

### 原始 SQL
```sql
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC;
```

### 执行计划分析
- 类型：ALL（全表扫描）
- 扫描行数：500,000
- 耗时：2.3秒

### 优化建议
1. **添加索引**：`CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);`
2. **优化后 SQL**（无需修改，添加索引后即可优化）

### 预期提升
- 扫描行数：500,000 → 10
- 预估耗时：2.3秒 → 0.02秒
```

---

## 五、四个 Agent 的横向对比

| 维度 | 代码解释 | 代码生成 | 代码补全 | SQL 优化 |
|:---|:---|:---|:---|:---|
| **模型** | V4-Pro | V4-Pro | V4-Flash | V4-Pro |
| **思考模式** | 可选 | 默认开启 | 不需要 | 默认开启 |
| **接口类型** | Chat Completion | Chat Completion | FIM Completion | Chat Completion |
| **工具调用** | read_file, search_* | read/write_file, shell, show_diff | 无（纯补全） | EXPLAIN, show_schema |
| **记忆记录** | 是 | 是 | 否 | 是 |
| **安全护栏** | 无（只读） | 写保护+Diff确认 | 无 | 无（只读分析） |
| **闭环能力** | 无 | 可与LoopController联动 | 无 | 无 |

这四者共同构成了 Cortex 的**代码智能矩阵**，覆盖了从理解、生成、补全到优化的全生命周期。每个 Agent 都可以独立工作，也可以被元 Agent 根据意图自动调度。
