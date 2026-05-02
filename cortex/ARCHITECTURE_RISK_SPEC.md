# Cortex 架构风险控制总纲 v1.0

**哲学矛盾调和 · 工程风险防控 · 安全护栏设计 · 信任模型优化**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🛡️ **Phase 1-5 强制遵循**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

### 第一部分：哲学层矛盾调和
1. [一、Agent 自主性 vs 技能确定性](#一agent-自主性-vs-技能确定性)
2. [二、中心化调度 vs 去中心化调度](#二中心化调度-vs-去中心化调度)
3. [三、记忆系统的认识论矛盾](#三记忆系统的认识论矛盾)
4. [四、安全模型的信任悖论](#四安全模型的信任悖论)

### 第二部分：工程层风险防控
5. [五、信任模型领域化与主动挑战](#五信任模型领域化与主动挑战)
6. [六、Agent 间协作与假设记录](#六agent-间协作与假设记录)
7. [七、组合操作风险评估](#七组合操作风险评估)
8. [八、协商中断与"固执循环"检测](#八协商中断与固执循环检测)
9. [九、取消与回滚设计](#九取消与回滚设计)

### 第三部分：实施优先级
10. [十、实施优先级与路线图](#十实施优先级与路线图)

---

## 第一部分：哲学层矛盾调和

### 一、Agent 自主性 vs 技能确定性

#### 1.1 冲突本质

这是整个框架最深层的矛盾，反映了**工程哲学**与**智能哲学**的根本对立。

| 维度 | Agent 技术规范 (AutonomousAgent) | 技能系统规范 (SkillExecutor) |
|:---|:---|:---|
| **哲学基础** | 认知体（Cognitive Entity） | 声明式流水线（Declarative Pipeline） |
| **执行模式** | Think-Act-Observe 循环 | 线性步骤序列 (Step 1 → Step 2 → Step 3) |
| **自适应能力** | ✅ 可根据中间结果调整策略 | ❌ `on_failure: "stop"` 即停 |
| **失败处理** | 自主决定修复路径 | 预定义策略 (stop/skip/retry) |
| **协商中断** | ✅ 信心不足时触发 | ❌ 无此能力 |

**核心问题**：一个自主 Agent 能否被一个确定性的技能定义所约束？如果 Agent 在执行技能的第三步时发现了一个更好的方式，它应该遵循技能定义还是自己的判断？

#### 1.2 化解方向

**原则 1：SkillExecutor 不是 Agent，而是编排层**

```text
SkillExecutor = ToolGateway 之上的编排层 + 任务上下文管理器
```

- **SkillExecutor 不拥有推理能力**：它只是按 YAML 定义的顺序调用工具。
- **技能不能拥有智能**：技能只能编排工具调用，不能进行自主决策。
- **智能由调用方提供**：如果需要在技能执行中引入判断力，应该由调用技能的 Agent 在执行前评估、执行后验证。

**原则 2：增加 `strict_mode` 字段**

```yaml
name: "部署博客"
strict_mode: true  # true: 严格执行（失败即停），false: 允许 Agent 微调参数
```

- **`strict_mode: true`**：技能必须如定义般精确执行，任何偏差都视为失败。
- **`strict_mode: false`**：允许调用该技能的 Agent 根据上下文微调步骤参数（但不能改变步骤顺序或跳过步骤）。

**原则 3：技能中的 `call_llm` 为受限推理模式**

```python
# 技能中的 call_llm 步骤
- id: "analyze_error"
  tool: "call_llm"
  params:
    prompt: "分析以下错误日志..."
    max_tokens: 512
    temperature: 0.1
    tools: []  # 禁止 Function Calling
```

- **技能中的 LLM 调用是受限的**：它不能发起新的工具调用，只能做纯文本推理。
- **避免递归调用 Agent 导致失控**：技能内部的 LLM 调用不应被视为独立 Agent，而是一个受限的推理工具。

---

### 二、中心化调度 vs 去中心化调度

#### 2.1 冲突本质

当前设计中有三个层级涉及"执行"，但它们的职责边界模糊：

1. **Meta-Agent**：意图解析、Agent 调度
2. **Sub-Agent**：Think-Act-Observe 循环，自主调用工具
3. **SkillExecutor**：加载技能定义，按步骤执行工具调用

**问题在于**：Meta-Agent 的"调度"和 Sub-Agent 的"自主循环"之间存在重复的智能。

- 如果 Meta-Agent 分解得太细（如 "write_file auth.py"），Agent 的自主性就毫无意义。
- 如果分解得太粗（如 "实现用户认证模块"），Agent 必须在内部做大量的规划和推理——那为什么还需要 Meta-Agent 做分解？

#### 2.2 化解方向

**原则 1：明确 Meta-Agent 负责 What，Sub-Agent 负责 How**

```python
TaskContext = {
    "task_id": "task-uuid",
    "goal": "实现用户认证模块",  # 目标状态（What）
    "constraints": {              # 约束条件
        "tech_stack": ["FastAPI", "JWT"],
        "security_level": "high",
        "max_files": 5
    },
    "shared_data": {...},         # 共享数据（已生成的文件列表等）
    "agent_messages": [...]       # Agent 间消息
}
```

- **Meta-Agent**：负责 WHAT（做什么：目标分解、Agent 选择）
- **Sub-Agent**：负责 HOW（怎么做：具体的工具调用序列）

**原则 2：DAG 分解由 PlannerAgent 负责，而非 Meta-Agent**

```text
用户意图 → Meta-Agent (意图解析) → PlannerAgent (任务分解为 DAG) → AgentRunner (调度执行)
```

- **PlannerAgent 是专门的规划专家**：它将高级目标分解为可并行的任务 DAG。
- **Meta-Agent 不再直接分解任务**：它只负责任务的初始理解和最终验收。

---

### 三、记忆系统的认识论矛盾

#### 3.1 冲突本质

**宪法原则一**："只记'事'，不记'话'"——记忆系统应记录用户的实际操作，而非对话内容。

但另一方面，我们又希望记忆系统能够"理解"用户的思维模式，从操作中提炼出"概念"和"技能"。这产生了两个层面的张力：

- **操作记忆 (Episodic)**：记录原始事件（用户做了什么）
- **概念记忆 (Concept)**：存储抽象知识（用户知道了什么）
- **技能记忆 (Skill)**：编码操作模式（用户会做什么）

**问题**：从"操作"到"概念/技能"的向上蒸馏，是否违反了"只记事"的原则？

#### 3.2 化解方向

**原则 1：承认"操作→模式→思维"的抽象层级递进**

```text
操作记忆 (Episodic) → 技能记忆 (Skill) → 概念记忆 (Concept)
     ↓                      ↓                    ↓
  原始事件               可复用模板           思维模式/经验总结
```

- **每一层都是对下一层的合法抽象**：这不是"污染"，而是"信息加工"。
- **原始操作记录保持纯粹**：即使进行了向上蒸馏，原始的 Episodic Memory 仍然保持不变，可供审计和回溯。

**原则 2：扩展宪法解释：向上蒸馏是合法的信息加工**

> 宪法原则一扩展解释：
> 记忆系统内部的向上蒸馏（操作→模式→思维）是合法的信息加工，
> 只要它不污染原始操作记录的纯粹性。

**原则 3：思维镜像的结论存入概念记忆**

```python
concept_memory.store({
    "type": "thinking_pattern",
    "pattern": "用户在修改 user_service.py 时，80% 的概率会同时更新 test_user.py",
    "confidence": 0.85,
    "source_episodes": ["episode-123", "episode-456", ...],  # 溯源
    "created_at": timestamp
})
```

- **思维模式的结论是"概念"，不是"操作"**：它属于 Concept Memory，而非 Episodic Memory。
- **保留溯源信息**：每个概念记忆都应记录其来源的操作记忆 ID，确保可追溯性。

---

### 四、安全模型的信任悖论

#### 4.1 冲突本质

**信任分级模型**假设信任可以跨领域迁移：如果用户在代码生成领域达到了"信任"级别，那么他在 Git 推送领域也应该获得相应的信任。

但这产生了一个悖论：

- **越懂行的用户，系统越不信任他**：专业用户能识别 AI 的错误建议，因此采纳次数少，信任积累慢。
- **越需要保护的群体，反而越容易被给予更高权限**：新手用户因为无法判断建议质量，可能盲目采纳，信任积累快。

#### 4.2 化解方向

**原则 1：信任模型增加操作类型的继承关系**

```python
OperationTypeHierarchy = {
    "read_file": {"risk_level": 0, "parent": None},
    "write_file": {
        "risk_level": 1,
        "parent": None,
        "subtypes": {
            "write_file.sandbox": {"risk_level": 0.5},  # 沙箱内写文件
            "write_file.existing": {"risk_level": 1.5}  # 覆盖现有文件
        }
    },
    "shell_exec": {
        "risk_level": 2,
        "parent": None,
        "subtypes": {
            "shell_exec.readonly": {"risk_level": 1},   # 只读命令 (ls, cat)
            "shell_exec.build": {"risk_level": 1.5},    # 构建命令 (npm run build)
            "shell_exec.deploy": {"risk_level": 2.5}    # 部署命令 (rsync, scp)
        }
    },
    "git_push": {"risk_level": 3, "parent": "shell_exec"}
}
```

- **操作类型有父子关系**：`git_push` 继承自 `shell_exec`，因此在这两个领域的信任可以部分迁移。
- **风险等级量化**：每个操作类型都有明确的风险等级，用于计算信任迁移系数。

**原则 2：信任迁移增加相关性因子**

```python
def calculate_trust_migration(source_domain, target_domain):
    """
    计算信任迁移系数
    
    Args:
        source_domain: 源领域 (如 "code_generation")
        target_domain: 目标领域 (如 "deployment")
    
    Returns:
        migration_factor: 0.0 ~ 1.0，表示信任迁移的比例
    """
    # 计算两个领域共享的基础操作类型
    shared_operations = get_shared_operations(source_domain, target_domain)
    
    if not shared_operations:
        return 0.0
    
    # 相关性 = 共享操作的风险加权平均值
    correlation = sum(
        op.risk_level * op.trust_level 
        for op in shared_operations
    ) / sum(op.risk_level for op in shared_operations)
    
    return min(correlation, 1.0)
```

- **信任迁移不是全有或全无**：根据两个领域的相关性，决定迁移的比例。
- **无相关性的领域不迁移**：代码解释的信任不会迁移到数据库管理。

**原则 3：L3 交付确认永不跳过（代码层面强制）**

```python
class DeliveryConfirmation:
    def confirm(self, user_trust_level: TrustLevel) -> bool:
        """
        L3 交付确认：永不跳过
        
        即使用户是专家级别，也必须确认交付内容。
        这是安全底线，不可妥协。
        """
        # 无论信任级别多高，都必须显示 Diff 并等待用户确认
        show_diff_preview()
        user_response = wait_for_user_confirmation()
        
        return user_response == "approve"
```

---

## 第二部分：工程层风险防控

### 五、信任模型领域化与主动挑战

#### 5.1 信任模型领域化

**核心思路**：将信任从全局模型改为按操作领域分别积累的可配置矩阵。

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

**实施逻辑**：在 `ToolGateway.validate()` 中增加领域信任校验。

#### 5.2 主动挑战机制（Active Challenge Mechanism）

**作用**：解决信任模型只向上积累不向下重置的伦理性悖论，验证用户是否能在不确定时正确拒绝。

**技术实现**：
- 信任级别每次提升时，系统主动展示边界案例
- 用户必须正确判断何时应该拒绝，才能完成信任升级
- 如果用户错误地接受了高风险建议，信任级别不提升甚至降级

**挑战案例库**：
- 预定义 20+ 个边界案例，覆盖不同风险等级
- 根据用户的历史行为动态选择最相关的案例
- 用户可以随时请求重新挑战

---

### 六、Agent 间协作与假设记录

#### 6.1 任务上下文总线（TaskContext）

**核心思路**：新增轻量级临时通信信道，所有参与同一任务的 Agent 可从中获取上游结果、写入自身产出。

**数据结构**：
```python
class TaskContext:
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.status = "running"
        self.shared_data: Dict[str, Any] = {
            "generated_files": [],
            "test_files": [],
            "last_log": "",
            "decisions": {}
        }
        self.agent_messages: List[Dict] = []
        self.assumption_records: List[Dict] = []  # 假设记录
```

#### 6.2 假设记录机制（Assumption Recording）

**作用**：解决多 Agent 交互的涌现性风险，确保下游 Agent 可以检查上游假设是否仍然成立。

**技术实现**：
- 每个 Agent 在执行前记录以下假设：
  - `preconditions`: 前置条件（如"文件 A 必须存在"）
  - `file_dependencies`: 依赖的文件状态
  - `environment_assumptions`: 环境假设
- 下游 Agent 在执行前检查这些假设
- 交付时用户可查看完整决策链

---

### 七、组合操作风险评估

#### 7.1 滑动窗口风险监控

**借鉴 CSA 的滑动窗口机制**，在安全检测中实现"重点关注高风险操作"。

**代码示例**：
```python
class RiskDetector:
    def __init__(self):
        self.operation_window: deque = deque(maxlen=10)  # 滑动窗口
    
    def assess_risk(self, current_operation: Operation) -> RiskLevel:
        # 1. 检查当前操作风险等级
        if current_operation.risk_level == "high":
            return RiskLevel.HIGH
        
        # 2. 检查滑动窗口中的风险累积
        sensitive_ops = [op for op in self.operation_window if op.sensitivity > 0]
        if sensitive_ops and current_operation.type == "network_request":
            return RiskLevel.HIGH  # 数据泄露风险
        
        # 3. 更新滑动窗口
        self.operation_window.append(current_operation)
        
        return RiskLevel.LOW
```

**示例场景**：当 Agent 先读取 `.env` 文件（敏感操作），又尝试执行网络请求时，系统自动检测到数据流风险并触发 L2 决策点。

---

### 八、协商中断与"固执循环"检测

#### 8.1 协商中断机制

**作用**：当 Agent 信心不足时，主动请求人工干预，而不是盲目重试。

**触发条件**：
- 连续 3 次 Think-Act 循环未能取得进展
- LLM 返回的置信度低于阈值（< 0.6）
- 遇到未预见的错误类型

**实现方式**：
```python
if loop_count >= 3 and not progress_made:
    confidence = await self._estimate_confidence()
    if confidence < 0.6:
        raise NegotiationInterrupt(
            reason="Low confidence after multiple attempts",
            suggestions=["请提供更多上下文", "检查文件权限", "手动执行此步骤"]
        )
```

#### 8.2 "固执循环"检测

**作用**：检测 Agent 是否在同一个问题上反复失败而不改变策略。

**检测算法**：
- 监控最近 5 次循环的工具调用序列
- 如果序列相似度 > 80%，判定为"固执循环"
- 触发强制中断，请求人工干预

---

### 九、取消与回滚设计

#### 9.1 任务取消机制

**支持三种取消级别**：
- **软取消**：当前步骤完成后停止
- **硬取消**：立即终止当前操作
- **紧急取消**：杀死所有子进程，清理临时文件

**实现方式**：
```python
class TaskController:
    async def cancel(self, task_id: str, level: CancelLevel = "soft"):
        if level == "emergency":
            await self._kill_all_processes(task_id)
            await self._cleanup_temp_files(task_id)
        elif level == "hard":
            await self._terminate_current_operation(task_id)
        else:  # soft
            self._mark_for_cancellation(task_id)
```

#### 9.2 回滚机制

**Git 分支隔离**：所有写操作在临时分支上进行，用户确认后合并到主分支。

**文件系统快照**：对于非 Git 项目，在执行前创建文件系统快照，失败时恢复。

---

## 第三部分：实施优先级

### 十、实施优先级与路线图

| 优先级 | 风险/矛盾 | 性质 | 行动 | 预计工作量 |
|:---|:---|:---|:---|:---|
| P0 | Agent 自主性 vs 技能确定性 | 哲学层冲突 | 明确定义 SkillExecutor 为编排层；增加 strict_mode 字段 | 2 天 |
| P0 | 中心化调度 vs 去中心化调度 | 架构层冲突 | 明确 Meta-Agent 负责 What，Agent 负责 How；TaskContext 只传递目标和约束 | 2 天 |
| P0 | 信任模型领域化 | 安全层漏洞 | 实现 UserTrustProfile 和 AgentPermissionMatrix | 3 天 |
| P1 | 记忆系统抽象层级 | 认识论冲突 | 扩展宪法解释：操作→模式→思维的蒸馏是合法的；思维镜像存入 Concept Memory | 1 天 |
| P1 | 假设记录与可追溯性 | 工程层风险 | 实现 AgentAssumptionRecorder，下游 Agent 验证上游假设 | 2 天 |
| P1 | 主动挑战机制 | 伦理层悖论 | 实现 TrustChallengeSystem，信任升级时展示边界案例 | 2 天 |
| P2 | 跨领域信任迁移 | 体验层紧张 | 增加操作类型继承关系和相关性因子；L3 确认代码层面强制执行 | 2 天 |
| P2 | 组合操作风险评估 | 安全层增强 | 实现 RiskDetector 滑动窗口监控 | 2 天 |
| P2 | 协商中断与固执循环检测 | 可用性增强 | 实现 NegotiationInterrupt 和循环检测算法 | 2 天 |
| P3 | 取消与回滚设计 | 容错性增强 | 实现 TaskController 三级取消和 Git 分支隔离 | 3 天 |

**总工作量**: 21 天  
**实施阶段**: Phase 1-3（核心闭环开发期间同步完成）

---

## 结语

本规范从**哲学层矛盾调和**到**工程层风险防控**，形成了一个完整的风险控制总纲。它不仅是技术实现的指南，更是 Cortex 框架的"清醒剂"——提醒我们在追求智能化的同时，始终保持对系统局限性的认知。

**所有开发者和 AI 助手在实现相关功能时，必须严格遵循本规范。**

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 架构风险控制总纲
