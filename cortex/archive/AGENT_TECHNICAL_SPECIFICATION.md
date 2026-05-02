# Cortex Agent 体系技术规范 v1.0

**结构 · 行为 · 进化 · 交互 · 安全**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 📋 **执行标准**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、结构层：层级调度体系](#一结构层层级调度体系)
2. [二、行为层：Think-Act-Observe 自主循环](#二行为层think-act-observe-自主循环)
3. [三、进化层：从工具到思想熔炉](#三进化层从工具到思想熔炉)
4. [四、交互层：确认型决策流程](#四交互层确认型决策流程)
5. [五、安全层：信任分级与安全护栏](#五安全层信任分级与安全护栏)
6. [六、Agent 生命周期](#六agent-生命周期)
7. [七、Agent 配置清单](#七agent-配置清单)
8. [八、与其他模块的协作](#八与其他模块的协作)

---

## 一、结构层：层级调度体系

Cortex 的 Agent 体系分为三个角色：**Meta-Agent**（唯一入口与总调度）、**Sub-Agent**（领域专家库）和**支撑组件**（记忆、工具、安全）。

### 1.1 Meta-Agent

**定位**：整个系统的"大脑"，负责理解意图 → 制定蓝图 → 调度专家 → 监控执行。

| 组件 | 职责 | 技术实现 |
|------|------|---------|
| `IntentParser` | 解析用户自然语言，提取核心意图、识别缺失信息 | DeepSeek V4 JSON Output Mode |
| `MissingInfoInferrer` | 从记忆库推断用户未言明的偏好（技术栈、架构偏好） | 四层记忆检索 + LLM 推断 |
| `BlueprintGenerator` | 生成结构化蓝图（技术选型、架构组件、功能列表、实施计划） | DeepSeek V4 + 蓝图的 JSON Schema |
| `AgentSelector` | 基于 Wilson Lower Bound 评分选择最佳 Sub-Agent | 历史成功率 + 响应速度 + 用户偏好 |

**调度流程**：
```text
用户输入 
  → IntentParser（理解意图）
  → MissingInfoInferrer（补全需求）
  → BlueprintGenerator（生成蓝图）
  → AgentSelector（选择Agent）
  → AgentRunner（调度执行）
```

**关键实现**：
- `core/concept_engine/intent_parser.py` - 意图解析器
- `core/concept_engine/missing_info_inferrer.py` - 缺失信息推断器
- `core/concept_engine/blueprint_generator.py` - 蓝图生成器
- `core/execution_engine/agent_selector.py` - Agent 选择器（Wilson Lower Bound 算法）

---

### 1.2 Sub-Agent 专家库

所有 Sub-Agent 继承 `AutonomousAgent` 基类，遵循统一的 `Think-Act-Observe` 循环。

| Agent | 职责 | 推荐模型 | 思考模式 |
|-------|------|---------|---------|
| `CodeExplainer` | 代码解释、逻辑分析、Bug诊断 | V4-Pro | 可选开启 |
| `CodeGenerator` | 代码生成、重构、功能实现 | V4-Pro | 默认开启(high) |
| `CompletionAgent` | 行内代码补全（FIM） | V4-Flash | 不支持 |
| `SQLOptimizer` | SQL优化、索引建议、执行计划分析 | V4-Pro | 默认开启(high) |
| `FileSystemAgent` | 文件搜索、批量操作、项目结构分析 | V4-Flash | 关闭 |
| `GitAgent` | 分支管理、提交生成、冲突解决 | V4-Flash | 关闭 |
| `PlannerAgent` | 复杂任务分解、工作流编排 | V4-Pro | 强制开启(max) |
| `WebSearcher` | 网络搜索、知识归纳 | V4-Flash | 关闭 |

**注册机制**：
```python
# agents/registry.py
class AgentRegistry:
    def register(self, agent: SubAgent):
        """注册 Agent 到专家库"""
        self.agents[agent.agent_id] = agent
    
    def find_agents_for_intent(self, intent: str) -> List[SubAgent]:
        """根据意图查找候选 Agent"""
        return [
            agent for agent in self.agents.values()
            if agent.supports_intent(intent)
        ]
```

---

## 二、行为层：Think-Act-Observe 自主循环

每个 Sub-Agent 在执行任务时，遵循标准的 **Think → Act → Observe** 循环，直至任务完成或达到最大循环次数。

### 2.1 Think（思考）

Agent 接收 `Intent` 和 `MemoryContext` 后：

1. **注入记忆上下文**：从 `MemoryPortal` 检索四层记忆，构建完整的消息序列。
   ```text
   [缓存层] 系统提示 + 用户偏好 + 项目背景
   [动态层] 本次检索的历史记忆 + 语义搜索结果
   [对话层] 当前任务 + 之前的 Think-Act-Observe 记录
   ```

2. **调用 LLM 推理**：根据任务复杂度选择模型（Flash/Pro）和是否开启思考模式（`reasoning_effort=high/max`）。

3. **决策输出**：LLM 返回两种结果——直接回复（`finish_reason=stop`）或发起工具调用（`tool_calls`）。

**代码示例**：
```python
async def think(self, intent: str, context: Dict[str, Any]) -> Dict[str, Any]:
    # 1. 检索记忆上下文
    memory_context = await self.memory_portal.retrieve_relevant(
        query=intent,
        top_k=5,
        filters={"project_id": context.get("project_id")}
    )
    
    # 2. 构建消息序列（利用 DeepSeek 上下文缓存）
    messages = [
        {"role": "system", "content": self.system_prompt},
        {"role": "user", "content": f"用户偏好: {memory_context.get('preferences', '')}"},
        {"role": "user", "content": f"项目背景: {memory_context.get('project_info', '')}"},
        {"role": "user", "content": f"当前任务: {intent}"}
    ]
    
    # 3. 调用 LLM
    response = await self.llm_client.chat_completion(
        messages=messages,
        model=self.config.model,
        reasoning_effort=self.config.thinking_mode.get("reasoning_effort") if self.config.thinking_mode.get("enabled") else None,
        tools=self.config.tools
    )
    
    return response
```

---

### 2.2 Act（行动）

当 LLM 决定调用工具时：

1. **ToolGateway 校验**：验证 `TaskToken`（权限、时效、范围），通过黑白名单检查。
2. **工具执行**：在沙箱中执行工具调用（文件操作在临时目录、Shell 命令受限）。
3. **审计记录**：参数（脱敏后）、结果、耗时、使用的 Token ID 等纳入签名日志。

**工具列表（标准化 Schema）**：

| 工具 | 功能 | 安全等级 |
|------|------|---------|
| `read_file` | 读取文件 | 低（只读） |
| `write_file` | 写入文件 | 高（需确认/信任） |
| `execute_shell` | 执行命令 | 极高（受限白名单） |
| `search_code` | 语义搜索代码库 | 低（只读） |
| `show_diff` | 展示变更差异 | 低（只读） |
| `git_commit` | Git 提交 | 高（需确认/信任） |

**代码示例**：
```python
async def act(self, tool_call: Dict[str, Any], task_token: str) -> Dict[str, Any]:
    # 1. ToolGateway 校验
    validated = await self.tool_gateway.validate(
        tool_call=tool_call,
        task_token=task_token,
        trust_level=self.user_trust_level
    )
    
    if not validated.approved:
        raise PermissionError(f"Operation denied: {validated.reason}")
    
    # 2. 工具执行（沙箱隔离）
    result = await self.tool_gateway.execute(
        tool_name=tool_call["name"],
        params=tool_call["arguments"],
        sandbox_level=self._determine_sandbox_level(tool_call)
    )
    
    # 3. 审计记录
    await self.audit_logger.log(
        action=tool_call["name"],
        params=self._sanitize_params(tool_call["arguments"]),
        result=result,
        token_id=task_token
    )
    
    return result
```

---

### 2.3 Observe（观察）

1. **获取结果**：工具执行成功或失败，返回结构化结果。
2. **反馈给 LLM**：将工具结果作为新消息追加到对话历史，Agent 继续 Think 阶段。
3. **循环控制**：`LoopController` 监控循环次数（默认最多 10 次），防止无限循环。
4. **错误恢复**：`ErrorRecovery` 在工具失败时分析错误日志，生成修复方案，自动重试（最多 3 次）。
5. **假设记录与可追溯性**：每个 Agent 在执行前应在 TaskContext 中记录自己的关键假设。

#### **假设记录机制（Assumption Recording）**

**作用**：解决多 Agent 交互的涌现性风险，确保下游 Agent 可以检查上游假设是否仍然成立。

**技术实现**：
- 每个 Agent 在执行前记录以下假设：
  - `preconditions`: 前置条件（如“文件 A 必须存在”）
  - `file_dependencies`: 依赖的文件状态（如“user_service.py 的版本必须是 v1.2”）
  - `environment_assumptions`: 环境假设（如“Node.js 版本 >= 18”）
- 下游 Agent 在执行前检查这些假设
- 交付时用户可查看完整决策链

**代码示例**：
```python
class AgentAssumptionRecorder:
    def __init__(self, task_context: TaskContext):
        self.task_context = task_context
    
    async def record_assumptions(self, agent_id: str, assumptions: Dict[str, Any]):
        """
        Agent 记录自己的关键假设
        
        Args:
            agent_id: Agent ID
            assumptions: 假设字典
                {
                    "preconditions": ["file_a_exists", "database_connected"],
                    "file_dependencies": {
                        "user_service.py": {"version": "v1.2", "checksum": "abc123"}
                    },
                    "environment_assumptions": {
                        "node_version": ">=18",
                        "os": "linux"
                    }
                }
        """
        assumption_record = {
            "agent_id": agent_id,
            "assumptions": assumptions,
            "recorded_at": datetime.utcnow(),
            "task_step": self.task_context.current_step_id
        }
        
        # 存入 TaskContext
        self.task_context.agent_messages.append({
            "type": "assumption_record",
            "data": assumption_record
        })
        
        # 同时持久化到数据库（供后续审计）
        await self.db.store_assumption_record(assumption_record)
    
    async def verify_assumptions(self, agent_id: str) -> List[str]:
        """
        Agent 验证上游假设是否仍然成立
        
        Returns:
            violated_assumptions: 被违反的假设列表
        """
        violated = []
        
        # 获取所有上游 Agent 的假设记录
        upstream_assumptions = [
            msg for msg in self.task_context.agent_messages
            if msg["type"] == "assumption_record" and msg["data"]["agent_id"] != agent_id
        ]
        
        for record in upstream_assumptions:
            assumptions = record["data"]["assumptions"]
            
            # 检查文件依赖
            for file_path, expected_state in assumptions.get("file_dependencies", {}).items():
                actual_checksum = await self._get_file_checksum(file_path)
                if actual_checksum != expected_state.get("checksum"):
                    violated.append(f"File {file_path} has been modified since {record['data']['agent_id']} assumed it.")
            
            # 检查环境假设
            for env_var, expected_value in assumptions.get("environment_assumptions", {}).items():
                actual_value = os.environ.get(env_var)
                if actual_value != expected_value:
                    violated.append(f"Environment variable {env_var} changed: expected {expected_value}, got {actual_value}.")
        
        return violated
```

**完整循环示例（代码生成）**：
```text
Think: "我需要理解项目结构" → tool_call: read_file("src/")
Act:   ToolGateway 验证 → 执行 → 返回文件列表
Observe: "项目使用 TypeScript + Express"

Think: "我可以生成代码了" → 直接生成代码
Act:   （无需工具调用）
Observe: 任务完成，返回结果
```

**代码示例**：
```python
async def execute(self, intent: str, context: Dict[str, Any]) -> AgentResult:
    loop_count = 0
    max_loops = self.config.max_loops  # 默认 10
    
    while loop_count < max_loops:
        loop_count += 1
        
        # Think
        response = await self.think(intent, context)
        
        # 如果 LLM 直接返回结果（无工具调用）
        if response.finish_reason == "stop":
            return AgentResult(success=True, data=response.content)
        
        # Act & Observe
        for tool_call in response.tool_calls:
            try:
                result = await self.act(tool_call, context["task_token"])
                # 将工具结果追加到对话历史
                context["conversation_history"].append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": str(result)
                })
            except Exception as e:
                # Error Recovery
                if loop_count <= 3:  # 最多重试 3 次
                    recovery_plan = await self.error_recovery.analyze(e)
                    context["conversation_history"].append({
                        "role": "system",
                        "content": f"Error occurred: {str(e)}. Recovery plan: {recovery_plan}"
                    })
                else:
                    return AgentResult(success=False, error=str(e))
    
    return AgentResult(success=False, error=f"Max loops ({max_loops}) exceeded")
```

---

## 三、进化层：从工具到思想熔炉

Cortex 的终极能力不是被动响应，而是**主动进化**——学习你的思维模式、固化你的成功经验、拓展你的认知边界。

### 3.1 思维镜像（Thought Mirror）

**核心能力**：观察你的行为，学习你的思维模式，预测你的意图。

| 组件 | 职责 | 实现方式 |
|------|------|---------|
| `BehaviorStateMachine` | 构建你的行为状态转移图 | 序列模式挖掘（PrefixSpan） |
| `IntentPredictor` | 三级意图预测 | L1(>90%置信)→静默执行, L2(>70%)→主动建议, L3(>50%)→定期报告 |
| `ThoughtTrailSummarizer` | 生成思维轨迹摘要 | LLM 分析你的操作序列 + 对话上下文 |

**示例**：
```text
观察：你打开 user_service.py → 80%的概率接下来会跑 test_user.py
预测：Cortex 主动问："要我先跑一下测试吗？"
```

**实现位置**：`core/evolution/thought_mirror/`

---

### 3.2 技能固化（Skill Amplifier）

**核心能力**：自动捕捉你的成功经验，将其编码为可复用的技能。

| 组件 | 职责 | 实现方式 |
|------|------|---------|
| `PatternDetector` | 检测重复的成功操作序列 | 监控 `TaskCompleted` 事件，识别高频模式 |
| `SkillTemplateGenerator` | 将模式编码为技能模板（YAML） | LLM 生成技能定义，包含步骤、参数、条件 |
| `TrialManager` | 管理技能的试用期 | 连续采纳5次→自动激活；连续拒绝3次→终止试用 |

**技能模板示例**：
```yaml
name: "代码提交前检查"
steps:
  - tool: "execute_shell"
    params: { command: "npm run lint" }
  - tool: "execute_shell"
    params: { command: "npm test" }
  - tool: "git_commit"
    params: { message: "自动生成的提交信息" }
```

**实现位置**：`core/evolution/skill_amplifier/`

---

### 3.3 认知突破（Cognition Breaker）

**核心能力**：主动引入外部知识，打破你的认知局限。

| 组件 | 职责 | 实现方式 |
|------|------|---------|
| `ExternalInfoSubscriber` | 订阅技术博客、GitHub Trending、Hacker News等信源 | RSS/API 定期拉取 |
| `GapAnalyzer` | 对比你的项目与外部前沿技术 | 语义匹配 + LLM 评估效率提升潜力 |
| `InsightPusher` | 主动推送认知建议卡片 | 只有当价值足够高（预估提升>30%）时才推送，避免信息噪音 |

**示例**：
```text
外部信号：React 19 发布新 Hook `useOptimistic`
项目分析：你正在写一个表单提交逻辑，正好适合这个新 Hook
推送建议："React 19 的 useOptimistic 能简化你的代码40%，要看看吗？"
```

**实现位置**：`core/evolution/cognition_breaker/`

---

## 四、交互层：确认型决策流程

交互从"对话式问答"升级为"**确认型决策**"，定义清晰的用户决策点。

### 4.1 三级决策点

| 决策点 | 触发时机 | 展示内容 | 用户选项 | 是否可跳过 |
|--------|---------|---------|---------|-----------|
| **L1 蓝图确认** | 概念具象化完成 | 技术选型、架构方案、功能列表 | 确认 / 修改 / 否决 | 专家模式可跳过 |
| **L2 高风险操作** | 涉及文件写入、网络请求、Git推送 | 操作预览、影响范围、风险等级 | 批准 / 拒绝 | 信任级别足够时自动批准 |
| **L3 交付确认** | 全自主执行完成 | Diff视图、测试报告、决策链追溯 | 合并 / 修正 / 丢弃 | **永不跳过** |

---

### 4.2 交互协议

使用 **JSON-RPC 2.0 over WebSocket/HTTP** 进行前后端通信。

**客户端 → 服务端**：
- `concept.submit`：提交模糊概念
- `blueprint.confirm`：确认/修改蓝图
- `task.pause / task.resume / task.cancel`：控制任务执行
- `chat.message`：发送对话消息

**服务端 → 客户端**：
- `concept.clarify`：要求用户澄清模糊需求
- `blueprint.generated`：推送生成的蓝图
- `task.progress`：实时推送任务执行进度
- `stream.chunk`：流式推送内容块
- `decision.explanation`：推送决策解释
- `notification.proactive`：推送主动建议

**WebSocket 消息示例**：
```json
{
  "jsonrpc": "2.0",
  "method": "task.progress",
  "params": {
    "task_id": "task_123",
    "agent_id": "code_generator",
    "status": "thinking",
    "progress_percent": 30,
    "current_step": "Analyzing project structure...",
    "timestamp": "2026-04-22T10:30:00Z"
  }
}
```

---

## 五、安全层：信任分级与安全护栏

### 5.1 信任分级模型

信任不是二元的"信任/不信任"，而是随使用逐步积累的梯度模型。

| 信任级别 | 触发条件 | 自动批准范围 |
|---------|---------|-------------|
| **新手 (默认)** | 初次使用 | 仅只读操作 |
| **熟悉** | 连续采纳 10 次建议 | + 文件写入（非破坏性） |
| **信任** | 连续采纳 30 次 + 零回滚事件 | + Git 提交、Shell 执行（测试/构建） |
| **专家** | 用户手动设置 | + 除删除/强制推送外的全部操作 |

**信任衰减**：连续拒绝 3 次建议 → 降级一级。

**实现位置**：`core/security/trust_manager.py`

---

### 5.2 安全护栏

| 控制点 | 机制 | 说明 |
|--------|------|------|
| `TaskToken` | 一次性令牌，5分钟有效，限定权限和文件范围 | 每次操作需携带，ToolGateway 验证 |
| `CommandInterceptor` | 黑名单拦截（`rm -rf /` 等）+ 白名单放行 | 命令执行前校验 |
| **沙箱执行** | L1（临时目录）/ L2（Git分支）/ L3（Docker容器） | 按任务风险选择隔离级别 |
| **审计日志** | HMAC-SHA256 签名，24小时轮转，保留30天 | 防篡改，可追溯 |

**TaskToken 示例**：
```python
class TaskToken:
    def __init__(self, user_id: str, permissions: List[str], expiry_minutes: int = 5):
        self.token_id = str(uuid.uuid4())
        self.user_id = user_id
        self.permissions = permissions  # ["read_file", "write_file"]
        self.expiry = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        self.signature = self._sign()
    
    def _sign(self) -> str:
        payload = f"{self.token_id}:{self.user_id}:{','.join(self.permissions)}:{self.expiry.isoformat()}"
        return hmac.new(SECRET_KEY, payload.encode(), hashlib.sha256).hexdigest()
```

---

## 六、Agent 生命周期

```text
[注册] → AgentRegistry.register(agent)
    ↓
[待命] → 等待 Meta-Agent 调度
    ↓
[激活] → AgentRunner 调用 agent.execute(intent, context)
    ↓
[执行] → Think-Act-Observe 循环（最多10次）
    ↓
    ├── 成功 → 返回 AgentResult 
    │           → 记录到 EpisodicMemory
    │           → 触发 SkillAmplifier 模式检测
    │           → 触发 ThoughtMirror 行为学习
    ↓
    └── 失败 → ErrorRecovery 尝试修复（最多3次）
              → 失败则标记 TaskFailed
              → 记录失败原因到审计日志
```

**关键事件**：
- `AgentRegisteredEvent` - Agent 注册成功
- `TaskStartedEvent` - 任务开始执行
- `TaskProgressEvent` - 任务进度更新
- `TaskCompletedEvent` - 任务成功完成
- `TaskFailedEvent` - 任务失败
- `SkillDetectedEvent` - 检测到可固化的技能模式

---

## 七、Agent 配置清单

每个 Sub-Agent 必须声明以下配置：

```typescript
interface AgentConfig {
  agent_id: string;                  // 唯一标识（snake_case）
  supported_intents: string[];       // 能处理的意图类型
  system_prompt: string;             // 角色定义 + 行为约束
  tools: ToolSchema[];               // 可用工具列表（Function Calling Schema）
  model: "v4-pro" | "v4-flash";     // 推荐模型
  thinking_mode?: {                  // 思考模式配置（可选）
    enabled: boolean;
    reasoning_effort?: "high" | "max";
  };
  max_loops: number;                 // 最大 Think-Act 循环次数（默认10）
  timeout_ms: number;                // 执行超时（默认5分钟）
  trust_level_required: number;      // 所需最低信任级别（1-4）
}
```

**配置示例（CodeGenerator）**：
```python
CODE_GENERATOR_CONFIG = AgentConfig(
    agent_id="code_generator",
    supported_intents=["generate_code", "refactor_code", "fix_bug"],
    system_prompt="你是一个专业的代码生成专家，擅长编写简洁、高效、可维护的代码。",
    tools=[
        {"name": "read_file", "description": "读取文件内容"},
        {"name": "write_file", "description": "写入文件内容"},
        {"name": "search_code", "description": "语义搜索代码库"}
    ],
    model="v4-pro",
    thinking_mode={
        "enabled": True,
        "reasoning_effort": "high"
    },
    max_loops=10,
    timeout_ms=300000,  # 5分钟
    trust_level_required=2  # 需要"熟悉"级别
)
```

---

## 八、与其他模块的协作

| 协作模块 | 交互方式 | 数据流 |
|---------|---------|--------|
| `MemoryPortal` | Agent 启动时注入上下文；任务完成后写入记忆 | `retrieve_context(intent)` → Agent → `record_event(task_result)` |
| `ToolGateway` | Agent 发起 Function Call → 网关校验 → 执行 → 返回结果 | `tool_call` → `validate(token)` → `execute()` → `audit_log()` |
| `EventBus` | Agent 发布事件（task.progress, task.completed, task.failed） | Agent → `publish(event)` → 前端渲染 / 记忆记录 |
| `AgentRegistry` | Meta-Agent 查询候选 Agent | `find_agents_for_intent(intent)` → `[Agent, ...]` |
| `LoopController` | AgentRunner 监控循环次数和超时 | `should_continue()` → true/false |

**协作流程图**：
```text
Meta-Agent
    ↓ (dispatch task)
AgentRunner
    ↓ (activate agent)
Sub-Agent
    ├── MemoryPortal (retrieve context)
    ├── LLM Client (think)
    ├── ToolGateway (act)
    │       ↓
    │   Sandbox Execution
    │       ↓
    │   Audit Logger
    └── EventBus (publish events)
            ↓
        Frontend / Memory System
```

---

## 🏆 结语

本技术规范定义了 Cortex Agent 体系的**六大核心维度**：

1. **结构**：层级调度（Meta-Agent + Sub-Agent 专家库）
2. **行为**：自主循环（Think-Act-Observe）
3. **进化**：从工具到伙伴（思维镜像、技能固化、认知突破）
4. **交互**：确认型决策（L1/L2/L3 三级确认）
5. **安全**：信任分级（新手→专家）+ 安全护栏（TaskToken、沙箱、审计）
6. **生命周期**：注册→待命→激活→执行→退役

**所有开发者和 AI 助手在实现 Agent 功能时，必须严格遵循本规范。**

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 技术规范
