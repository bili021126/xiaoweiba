# Cortex 架构风险防控与增强规范 v1.0

**结构性优化 · 工程可行性 · 演进路径 · 被遗忘的设计要点**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🛡️ **Phase 1 强制实施**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、信任模型领域化 (问题1)](#一信任模型领域化-问题1)
2. [二、Agent间协作 - 任务上下文总线 (问题2)](#二agent间协作---任务上下文总线-问题2)
3. [三、蓝图校验Agent - 防一步错步步错 (问题3)](#三蓝图校验agent---防一步错步步错-问题3)
4. [四、冷启动优化 (问题4)](#四冷启动优化-问题4)
5. [五、组合操作风险评估 (问题5)](#五组合操作风险评估-问题5)
6. [六、协商中断机制 (问题6)](#六协商中断机制-问题6)
7. [七、绞杀者模式 - 数据迁移适配器 (问题7)](#七绞杀者模式---数据迁移适配器-问题7)
8. [八、取消与回滚设计 (问题8)](#八取消与回滚设计-问题8)
9. [九、“固执循环”检测 (问题9)](#九固执循环检测-问题9)
10. [实施优先级](#实施优先级)

---

## 一、信任模型领域化 (问题1)

**核心思路**：将信任从全局模型改为按操作领域分别积累的可配置矩阵。

### 1.1 数据结构设计

**用户信任档案 (UserTrustProfile)**：
```json
{
    "user_id": "user_123",
    "trust_matrix": {
        "code_explain":    { "accepted": 15, "rejected": 1, "level": "familiar" },
        "code_generate":   { "accepted": 5,  "rejected": 0, "level": "novice" },
        "file_write":      { "accepted": 32, "rejected": 0, "level": "trusted" },
        "shell_exec":      { "accepted": 8,  "rejected": 2, "level": "novice" },
        "git_push":        { "accepted": 0,  "rejected": 0, "level": "novice" }
    }
}
```

**Agent权限矩阵 (AgentPermissionMatrix)**：
| Agent | 所需权限 | 最低信任级别 |
|-------|---------|-------------|
| `CodeExplainer` | `read_file` | novice |
| `CodeGenerator` | `read_file`, `write_file`, `shell_exec` | familiar |
| `GitAgent` | `write_file`, `git_commit` | familiar |
| `GitAgent` (推送) | `git_push` | trusted |

### 1.2 实施逻辑

在 `ToolGateway.validate()` 中增加领域信任校验：

```python
async def validate(self, agent_id: str, operation: str, user_id: str) -> ValidationResult:
    # 1. 获取用户在该领域的信任级别
    trust_profile = await self.trust_manager.get_profile(user_id)
    domain_trust = trust_profile.trust_matrix.get(agent_id, {"level": "novice"})
    
    # 2. 获取该操作所需的最低信任级别
    required_level = self.permission_matrix[agent_id][operation]
    
    # 3. 比较级别
    if self._level_to_int(domain_trust["level"]) < self._level_to_int(required_level):
        return ValidationResult(approved=False, reason=f"Insufficient trust level for {agent_id}")
    
    return ValidationResult(approved=True)
```

**UI支持**：用户在 Web UI 的信任管理面板可查看和手动调整每个领域的信任级别。

---

### 1.3 主动挑战机制（Active Challenge Mechanism）

**作用**：解决信任模型只向上积累不向下重置的伦理性悖论，验证用户是否能在不确定时正确拒绝。

**技术实现**：
- 信任级别每次提升时，系统主动展示边界案例
- 用户必须正确判断何时应该拒绝，才能完成信任升级
- 如果用户错误地接受了高风险建议，信任级别不提升甚至降级

**代码示例**：
```python
class TrustChallengeSystem:
    def __init__(self, db: TrustDatabase):
        self.db = db
    
    async def trigger_challenge(self, user_id: str, from_level: str, to_level: str):
        """
        当用户即将从 from_level 升级到 to_level 时，触发挑战
        
        Args:
            user_id: 用户 ID
            from_level: 当前信任级别
            to_level: 目标信任级别
        """
        # 1. 生成边界案例
        challenge_case = await self._generate_boundary_case(from_level, to_level)
        
        # 2. 向用户展示挑战
        print(f"\n🔒 信任升级挑战：您即将从 '{from_level}' 升级到 '{to_level}'")
        print(f"请评估以下建议是否安全：\n{challenge_case.description}\n")
        
        # 3. 等待用户响应
        user_response = await self._wait_for_user_decision()
        
        # 4. 验证用户决策
        correct_decision = challenge_case.correct_action  # "accept" or "reject"
        
        if user_response == correct_decision:
            # 用户正确判断，允许升级
            await self.db.upgrade_trust_level(user_id, to_level)
            print("✅ 挑战通过！信任级别已升级。")
        else:
            # 用户错误判断，阻止升级
            print(f"❌ 挑战失败。正确做法应该是：{'接受' if correct_decision == 'accept' else '拒绝'}")
            print("信任级别保持不变。建议您先了解更多关于此操作的风险。")
    
    async def _generate_boundary_case(self, from_level: str, to_level: str) -> ChallengeCase:
        """
        生成边界案例
        
        Examples:
            - 从 novice → familiar: 展示一个看似合理但有潜在风险的 Shell 命令
            - 从 familiar → trusted: 展示一个需要仔细审查的代码重构建议
            - 从 trusted → expert: 展示一个可能破坏数据库完整性的 SQL 优化
        """
        if from_level == "novice" and to_level == "familiar":
            return ChallengeCase(
                description="Agent 建议执行：`rm -rf node_modules && npm install`",
                risk_level="medium",
                correct_action="reject",  # 应该拒绝，因为 rm -rf 是危险操作
                explanation="虽然这个命令常用于重置依赖，但 rm -rf 是高风险操作，应该在熟悉级别之前保持谨慎。"
            )
        elif from_level == "familiar" and to_level == "trusted":
            return ChallengeCase(
                description="Agent 建议重构：将所有同步函数改为异步，涉及 50+ 文件",
                risk_level="high",
                correct_action="reject",  # 应该拒绝，因为大规模重构需要人工审查
                explanation="大规模重构应该在 L1 蓝图确认阶段进行，而不是自动批准。"
            )
        else:
            # 默认案例
            return ChallengeCase(
                description="Agent 建议删除未使用的导入语句",
                risk_level="low",
                correct_action="accept",
                explanation="这是低风险操作，可以安全接受。"
            )
```

**挑战案例库**：
- 预定义 20+ 个边界案例，覆盖不同风险等级
- 根据用户的历史行为动态选择最相关的案例
- 用户可以随时请求重新挑战

**实现位置**：`security/trust_challenge.py`

---

## 二、Agent间协作 - 任务上下文总线 (问题2)

**核心思路**：新增轻量级临时通信信道，所有参与同一任务的Agent可从中获取上游结果、写入自身产出。

### 2.1 数据结构：TaskContext

```python
class TaskContext:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.status = "running"  # waiting, running, completed, failed
        self.step_id: Optional[str] = None
        self.shared_data: Dict[str, Any] = {
            "generated_files": [],
            "test_files": [],
            "last_log": "",
            "decisions": {}
        }
        self.agent_messages: List[Dict] = []
    
    def add_message(self, from_agent: str, to_agent: str, message: str):
        self.agent_messages.append({
            "from": from_agent,
            "to": to_agent,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        })
```

### 2.2 实施逻辑

在 `AgentRunner` 中创建任务级上下文：

```python
async def execute_task(self, task: Task):
    # 1. 初始化 TaskContext
    context = TaskContext(task.id)
    
    # 2. 遍历任务 DAG
    for step in task.dag.topological_sort():
        context.step_id = step.id
        
        # 3. 注入上下文到 Agent
        agent = self.agent_registry.get(step.agent_id)
        result = await agent.execute(step.intent, context=context)
        
        # 4. 更新上下文
        context.shared_data["generated_files"].extend(result.generated_files)
        context.shared_data["last_log"] = result.log
        
        # 5. 发送消息给下游 Agent
        if step.next_agents:
            for next_agent_id in step.next_agents:
                context.add_message(
                    from_agent=step.agent_id,
                    to_agent=next_agent_id,
                    message=f"Step {step.id} completed. Files: {result.generated_files}"
                )
    
    # 6. 归档到 EpisodicMemory
    await self.memory_portal.store_episodic_memory(context.to_dict())
```

---

## 三、蓝图校验Agent - 防一步错步步错 (问题3)

**核心思路**：在 `BlueprintGenerator` 之后、L1决策点之前，插入一个独立审查节点。

### 3.1 新流程

```text
BlueprintGenerator → 蓝图校验Agent → 用户确认(L1)
```

### 3.2 蓝图校验Agent设计

**角色**：独立于 ConceptParser 和 BlueprintGenerator 的审查者。

**System Prompt 核心指令**：
> "你是一个严格的蓝图审查专家。请审查蓝图与用户原始意图的一致性、技术选型的可行性、实施计划的风险点。输出 JSON 格式：{ 'consistency_assessment': '...', 'potential_deviations': [...], 'risk_assessment': [...], 'suggestions': [...] }"

**触发条件**：
- 当核心意图匹配度低于阈值 (<0.8)
- 或检测到高风险偏差（如选择了用户不熟悉的复杂技术栈）

**UI呈现**：在 L1 确认时向用户高亮展示审查结果，让用户更早发现偏差。

---

## 四、冷启动优化 (问题4)

**四个措施**：

### 4.1 通用默认偏好预设

```python
default_preferences = {
    "web_project": {"framework": "React", "styling": "Tailwind", "deployment": "Vercel"},
    "api_server": {"framework": "FastAPI", "database": "SQLite", "deployment": "Self-hosted"},
    "cli_tool": {"language": "Python", "packaging": "pip"}
}
```

### 4.2 快速路径

当概念属于已知简单类型时，跳过完整的 `BlueprintGenerator`，直接由对应的 Sub-Agent 执行。

**判断标准**：
```python
if complexity < THRESHOLD and operation_type in SIMPLE_TYPES:
    return await direct_execute(agent_id, intent)
```

### 4.3 首次使用预期管理

在 Cold-start 模式下的首次概念具象化交互中，自动追加说明：
> "👋 这是我第一次帮你做这类事，所以会多问几个问题来确认细节。随着我们合作多了，我会更懂你的偏好，提问也会越来越少。"

### 4.4 主动学习引导

完成一个概念具象化流程后，主动向用户采集偏好：
> "我注意到你选择了 React + Tailwind。是否希望我将此作为未来 Web 项目的默认偏好？[是/否]"

并存入 `ConceptMemory` 的偏好字段。

---

## 五、组合操作风险评估 (问题5)

**核心思路**：为每个工具操作标记一个数据敏感等级，TaskToken 追踪数据流向。

### 5.1 数据敏感等级

| 操作 | 敏感等级 | 追踪行为 |
|------|---------|---------|
| `read_file(普通文件)` | 0 (公开) | 不追踪 |
| `read_file(.env, *.key)` | 2 (敏感) | 标记数据来源 |
| `read_memory(用户偏好)` | 1 (内部) | 标记数据来源 |
| `write_file(任意)` | - | 检查写入内容是否包含级别≥1的追踪标记 |
| `execute_shell(网络)` | - | 检查输出是否包含级别≥1的追踪标记 |

### 5.2 追踪机制

`TaskToken` 增加 `data_trail` 字段：

```python
class TaskToken:
    def __init__(self):
        self.data_trail: List[Dict] = []  # [{"uri": ".env", "sensitivity": 2}]
    
    def mark_read(self, uri: str, sensitivity: int):
        if sensitivity > 0:
            self.data_trail.append({"uri": uri, "sensitivity": sensitivity})
    
    def has_sensitive_source(self) -> bool:
        return any(item["sensitivity"] >= 1 for item in self.data_trail)
```

**ToolGateway 校验**：
当 Agent 尝试执行写入或网络操作时，检查 `task_token.has_sensitive_source()`。如果存在敏感源，则触发 L2 决策点（高风险操作确认），明确告知用户哪个数据源是敏感的。

---

## 六、协商中断机制 (问题6)

**核心思路**：在 Agent 的 Think-Act-Observe 循环中，增加一个 Confidence Gate，当信心不足时触发协商中断。

### 6.1 Confidence Gate 触发器

1. **LLM 自我报告**：在 System Prompt 中约定：“当你不确定当前决策是否正确时，以 JSON 格式返回你的评估结果：`{'确定的步骤': [...], '不确定的步骤': [{'选项A': '...', '选项B': '...'}]}`”
2. **行为指标**：连续 2 次 Observe 返回错误或空结果。
3. **工具执行异常**：ToolGateway 返回非预期结果（如文件不存在、命令被拦截）。

### 6.2 协商中断协议 (JSON-RPC 2.0)

**新方法**：
- `negotiation.request`：Agent 发起协商，携带多个方案供选择。
- `negotiation.response`：用户回复，选择方案或提供新的指令。
- `negotiation.cancel`：用户取消当前任务。

**UI呈现**：任务进度卡片中展示协商消息卡片，展示不确定的步骤和选项，用户点击选择后恢复执行。

---

## 七、绞杀者模式 - 数据迁移适配器 (问题7)

**核心思路**：在并行运行之前，优先完成数据迁移适配，确保用户无论走新旧系统，记忆都是连续的。

### 7.1 数据迁移适配器

实现 `LegacyMemoryAdapter`，实现 `IMemoryPortal` 接口：

```python
class LegacyMemoryAdapter(MemoryPortal):
    def __init__(self, old_db_path: str):
        self.old_db = sqlite3.connect(old_db_path)
    
    async def retrieve_concept_memory(self, user_id: str) -> Dict:
        # 读取旧系统格式，转换为新系统格式
        old_data = self.old_db.execute("SELECT * FROM preferences WHERE user_id=?", (user_id,))
        return self._convert_to_new_format(old_data)
```

### 7.2 灰度切流策略

| 阶段 | 用户范围 | 数据状态 |
|------|---------|---------|
| 内部测试 | 开发团队(白名单) | 新系统独立运行 |
| Alpha | 10%用户(随机分配) | 启用数据迁移适配器，用户可访问旧数据 |
| Beta | 50%用户(上次分配) | 适配器持续运行 |
| GA | 100% | 数据迁移适配器停止，旧数据已全部导入新系统 |

---

## 八、取消与回滚设计 (问题8)

**核心思路**：所有写操作先在临时工作区(Sandbox) 中执行，任务完成或用户确认后才合并。

### 8.1 隔离机制

**L1 (文件隔离)**：
- 在 `~/.cortex/sandboxes/<task_id>/` 下创建镜像工作区。
- Agent 的所有写操作指向镜像区。
- `task.cancel` → 直接删除整个沙箱目录。
- `task.completed` (L3确认) → 将最终产物复制/合并到用户工作区。

**L2 (Git分支隔离)**：
- 如果用户工作区是 Git 仓库，创建临时分支 `cortex/task-<uuid>`。
- Agent 的操作在分支上完成。
- `task.cancel` → 切回原分支，删除临时分支。
- `task.completed` (L3确认) → 展示 Diff，用户确认后合并。

### 8.2 取消流程细化

1. 用户发出 `task.cancel`
2. `AgentRunner` 向当前 Agent 发送中断信号
3. Agent 收到信号后，完成当前工具调用（不可中断），然后停止循环
4. `SandboxManager` 根据隔离级别销毁沙箱
5. 审计日志记录取消事件，记录已执行步骤和清理状态

---

## 九、“固执循环”检测 (问题9)

**核心思路**：在 `LoopController` 中增加策略相似度检测，发现“原地打转”时主动中断。

### 9.1 检测机制

**工具调用指纹记录**：
`LoopController` 持续记录 Agent 的每次循环动作，形成指纹日志（核心工具名+参数类型摘要，忽略具体值）。

**重复模式匹配**：
每次新循环前，检查指纹日志是否已有 ≥3 次相似操作模式。

**相似度算法**：
```python
similarity = (相同工具名调用次数 / 总循环次数) + (相同参数签名调用次数 / 总循环次数) / 2
```

当 `similarity > 0.8` 且 `≥3` 次循环时，触发告警。

### 9.2 触发后的行为

1. 记录告警：“检测到重复策略，可能陷入无效循环”
2. 主动触发协商中断，向用户呈现最近的循环日志和执行内容摘要
3. 用户可选择：继续（重置检测计数器） / 暂停手动调整 / 取消任务

---

## 实施优先级

| 优先级 | 问题 | 理由 |
|--------|------|------|
| **P0** | 问题2 (Agent协作)、问题5 (组合风险)、问题9 (固执循环) | 直接影响系统核心功能和安全 |
| **P1** | 问题6 (协商中断)、问题8 (取消回滚)、问题3 (蓝图校验) | 显著提升用户体验和可靠性 |
| **P2** | 问题1 (信任模型改造)、问题4 (冷启动)、问题7 (数据迁移) | 锦上添花，可在系统稳定后优化 |

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 风险防控与增强规范
