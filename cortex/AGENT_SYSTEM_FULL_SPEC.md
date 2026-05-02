# Cortex Agent 系统全栈规范 v1.0

**哲学 · 结构 · 行为 · 进化 · 交互 · 安全 · 代码智能矩阵**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 📋 **唯一真理源**  
**维护者**: Cortex·架构守护者

---

## 🌟 序言：从工具到思想熔炉的跨越

我们设计的不仅仅是一个代码助手，而是一个**遵循“宪法”原则、受“法典”约束、有清晰“大纲”、能自我进化，最终将你脑海中的概念直接熔炼成现实的思想伙伴**。

**重要参考文档**：
- [PHILOSOPHICAL_APPENDIX.md](./PHILOSOPHICAL_APPENDIX.md) - **架构哲学边界与隐喻祛魅宣言**：Cortex 的“自我认知宪章”，承认系统的局限性并建立制衡机制。

本规范将 Agent 的设计逻辑分解为六个层面：
1. **哲学层**：我们究竟在设计什么？
2. **结构层**：它是什么？——精密的层级调度体系
3. **行为层**：它如何工作？——Think-Act-Observe 自主循环
4. **进化层**：它如何成长？——从工具到思想熔炉的跨越
5. **交互与安全层**：确认型决策流程与信任分级
6. **代码智能矩阵**：四大核心 Agent 的详细规范

---

## 🧬 一、结构层：精密的层级调度体系

Cortex 的 Agent 体系分为三个角色：**Meta-Agent**（唯一入口与总调度）、**Sub-Agent**（领域专家库）和**支撑组件**（记忆、工具、安全）。

### 1.1 🔮 Meta-Agent：大脑与总调度

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

### 1.2 👥 Sub-Agent 专家库

所有 Sub-Agent 继承 `AutonomousAgent` 基类，遵循统一的 `Think-Act-Observe` 循环。

#### **代码类专家**
| Agent | 职责 | 推荐模型 | 思考模式 |
|-------|------|---------|---------|
| `CodeExplainer` | 代码解释、逻辑分析、Bug诊断 | V4-Pro | 可选开启 |
| `CodeGenerator` | 代码生成、重构、功能实现 | V4-Pro | 默认开启(high) |
| `CompletionAgent` | 行内代码补全（FIM） | V4-Flash | 不支持 |
| `SQLOptimizer` | SQL优化、索引建议、执行计划分析 | V4-Pro | 默认开启(high) |

#### **项目管理专家**
| Agent | 职责 | 推荐模型 | 思考模式 |
|-------|------|---------|---------|
| `FileSystemAgent` | 文件搜索、批量操作、项目结构分析 | V4-Flash | 关闭 |
| `GitAgent` | 分支管理、提交生成、冲突解决 | V4-Flash | 关闭 |
| `PlannerAgent` | 复杂任务分解、工作流编排 | V4-Pro | 强制开启(max) |

#### **系统与知识专家**
| Agent | 职责 | 推荐模型 | 思考模式 |
|-------|------|---------|---------|
| `WebSearcher` | 网络搜索、知识归纳 | V4-Flash | 关闭 |
| `ProactiveEngine` | 主动建议引擎 | V4-Flash | 关闭 |

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

## ✨ 二、行为层：Think-Act-Observe 自主循环

每个 Sub-Agent 在执行任务时，遵循标准的 **Think → Act → Observe** 循环，直至任务完成或达到最大循环次数。

### 2.1 🧠 Think（思考）

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

### 2.2 🛠️ Act（行动）

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

### 2.3 👁️ Observe（观察）

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

---

## 🚀 三、进化层：从“工具”到“思想熔炉”的跨越

这是让 Agent 从“被动的工具”变成“主动的学徒”的关键设计。Cortex 的终极能力不是被动响应，而是**主动进化**——学习你的思维模式、固化你的成功经验、拓展你的认知边界。

### 3.1 思维的延伸：意图预测（Thought Mirror）

**现状**：被动等待指令。  
**未来**：主动预测意图。

**实现方式**：
- **行为模式分析**：通过长期观察你的操作序列（如“打开文件 A → 搜索函数 B → 修改函数 C”），MetaAgent 学习你的工作流。
- **预判与建议**：在你刚打开一个文件时，Agent 可能就预判了你的下一步操作（如“你可能想运行测试”），并主动提供建议按钮。
- **思维可视化**：MetaAgent 的思维过程通过 `ThinkingStream` 实时展示，让你了解决策背后的逻辑（“我之所以推荐这个方案，是因为你上次说过喜欢简洁的代码”）。

**示例**：
```text
观察：你打开 user_service.py → 80%的概率接下来会跑 test_user.py
预测：Cortex 主动问："要我先跑一下测试吗？"
```

---

### 3.2 技能的拓展：自动捕捉与复用（Skill Memory）

**现状**：每次都要重新教。  
**未来**：一次学会，终身复用。

**实现方式**：
- **成功经验提取**：当 Agent 成功解决一个复杂问题（如“配置 CI/CD 流水线”）后，`SkillExtractor` 会自动捕捉操作序列，提炼成一个可复用的“技能模板”。
- **技能存储**：技能模板存储到 `SkillMemory`（SQLite + 向量索引），包含前置条件、执行步骤、预期结果。
- **自动匹配**：下次遇到类似问题，Agent 会从技能库中检索匹配的技能，并在征得你同意后，自动帮你完成。
- **社区共享**：你可以将技能导出，分享给团队或社区，形成“技能市场”。

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

---

### 3.3 认知的突破：主动引入新知识（Cognitive Breakthrough）

**现状**：知识边界固定。  
**未来**：主动打破边界。

**实现方式**：
- **前沿监测**：`KnowledgeUpdater` 定期爬取技术文章、文档、最佳实践摘要，更新到 `CognitiveKB`（认知知识库）。
- **关联推荐**：当你在做某个项目时，Agent 会发现能提升你当前项目效率的新技术或新范式（如“我注意到 WebAssembly 在边缘计算中的新应用，这可能比传统的 Serverless 更适合你的博客部署场景”）。
- **范式转移提醒**：当行业出现重大技术变革时，Agent 会主动推送“认知突破”建议，帮你打破知识的边界。

**示例**：
```text
外部信号：React 19 发布新 Hook `useOptimistic`
项目分析：你正在写一个表单提交逻辑，正好适合这个新 Hook
推送建议："React 19 的 useOptimistic 能简化你的代码40%，要看看吗？"
```

---

## 🏆 结语：你是创造者，Cortex 是你的执行者

**过去的工具服务于你的手，Cortex 服务于你的思想。**

我们设计的这套 Agent 体系，其终极目标不是替代你编码，而是**消除编码过程中的摩擦**，让你能够专注于**创造和决策**。

- **结构层**确保了系统的可扩展性和稳定性。
- **行为层**赋予了系统处理复杂任务的自主性。
- **进化层**让系统能够随着你的成长而成长，最终成为你思想的延伸。

**从今天起，你可以用远少于当前的代码量，获得可迭代的原型；但这个原型需要你的审查、修改和试错来打磨成真正符合你意图的成品。**

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 Agent 系统全栈规范
