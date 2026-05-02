# Cortex 架构深层矛盾调和与边界定义规范 v1.0

**自主性 vs 确定性 · 中心化 vs 去中心化 · 行为 vs 意义 · 信任迁移**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🛡️ **Phase 1-5 强制遵循**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、核心矛盾：Agent 自主性 vs 技能确定性](#一核心矛盾agent-自主性-vs-技能确定性)
2. [二、执行层语义混乱：谁在"思考"，谁在"执行"？](#二执行层语义混乱谁在思考谁在执行)
3. [三、记忆系统的认识论矛盾：记录"行为"还是记录"意义"？](#三记忆系统的认识论矛盾记录行为还是记录意义)
4. [四、安全模型的信任悖论](#四安全模型的信任悖论)
5. [五、修订优先级与实施计划](#五修订优先级与实施计划)

---

## 一、核心矛盾：Agent 自主性 vs 技能确定性

### 1.1 冲突本质

这是整个框架最深层的矛盾，反映了**工程哲学**与**智能哲学**的根本对立。

| 维度 | Agent 技术规范 (AutonomousAgent) | 技能系统规范 (SkillExecutor) |
|:---|:---|:---|
| **哲学基础** | 认知体（Cognitive Entity） | 声明式流水线（Declarative Pipeline） |
| **执行模式** | Think-Act-Observe 循环 | 线性步骤序列 (Step 1 → Step 2 → Step 3) |
| **自适应能力** | ✅ 可根据中间结果调整策略 | ❌ `on_failure: "stop"` 即停 |
| **失败处理** | 自主决定修复路径 | 预定义策略 (stop/skip/retry) |
| **协商中断** | ✅ 信心不足时触发 | ❌ 无此能力 |

**冲突点**：
- 当 Meta-Agent 决定"执行部署博客技能"时，它调用的是 `SkillExecutor`。`SkillExecutor` 加载 YAML，按步骤执行。但 `SkillExecutor` 本身是不是 Agent？
- 如果 `SkillExecutor` 是 Agent，它应该拥有 Think-Act-Observe 的自主性。如果不是，它只是一个脚本引擎——那为什么不让 CodeGenerator 直接执行部署？
- **一个自主 Agent 能否被一个确定性的技能定义所约束？**如果 Agent 在执行技能的第三步时发现了一个更好的方式，它应该遵循技能定义还是自己的判断？

### 1.2 化解方向

#### **原则 1：SkillExecutor 不是 Agent，而是编排层**

```text
SkillExecutor = ToolGateway 之上的编排层 + 任务上下文管理器
```

- **SkillExecutor 不拥有推理能力**：它只是按 YAML 定义的顺序调用工具。
- **技能不能拥有智能**：技能只能编排工具调用，不能进行自主决策。
- **智能由调用方提供**：如果需要在技能执行中引入判断力，应该由调用技能的 Agent（通常是 Meta-Agent 委派的某个 Agent）在执行前评估、执行后验证。

#### **原则 2：增加 `strict_mode` 字段**

```yaml
# 技能定义文件
name: "部署博客"
strict_mode: true  # true: 严格执行（失败即停），false: 允许 Agent 微调参数
```

- **`strict_mode: true`**：技能必须如定义般精确执行，任何偏差都视为失败。
- **`strict_mode: false`**：允许调用该技能的 Agent 根据上下文微调步骤参数（但不能改变步骤顺序或跳过步骤）。

#### **原则 3：技能中的 `call_llm` 为受限推理模式**

```python
# 技能中的 call_llm 步骤
- id: "analyze_error"
  tool: "call_llm"
  params:
    prompt: "分析以下错误日志..."
    max_tokens: 512
    temperature: 0.1
    # 关键限制：无工具调用能力
    tools: []  # 禁止 Function Calling
```

- **技能中的 LLM 调用是受限的**：它不能发起新的工具调用，只能做纯文本推理。
- **避免递归调用 Agent 导致失控**：技能内部的 LLM 调用不应被视为独立 Agent，而是一个受限的推理工具。

---

## 二、执行层语义混乱：谁在"思考"，谁在"执行"？

### 2.1 冲突本质

当前设计中有三个层级涉及"执行"，但它们的职责边界模糊：

1. **Meta-Agent**：意图解析、Agent 调度
2. **Sub-Agent**：Think-Act-Observe 循环，自主调用工具
3. **SkillExecutor**：加载技能定义，按步骤执行工具调用

**问题在于**：Meta-Agent 的"调度"和 Sub-Agent 的"自主循环"之间存在重复的智能。

- 如果 Meta-Agent 分解得太细（如 "write_file auth.py"），Agent 的自主性就毫无意义。
- 如果分解得太粗（如 "实现用户认证模块"），Agent 必须在内部做大量的规划和推理——那为什么还需要 Meta-Agent 做分解？

**这是两种调度哲学的混淆**：
- **中心化调度**：Meta-Agent 是唯一的大脑，Agents 是它的手
- **去中心化调度**：每个 Agent 都有自己的大脑，Meta-Agent 只是它们的协调者

### 2.2 化解方向

#### **原则 1：明确 Meta-Agent 负责 What，Sub-Agent 负责 How**

```text
Meta-Agent: 负责 WHAT（做什么：目标分解、Agent 选择）
Sub-Agent:  负责 HOW（怎么做：具体的工具调用序列）
```

- **Meta-Agent 分解到"功能模块"粒度**：如"实现用户认证模块"，而不是"写 auth.py 文件"。
- **Sub-Agent 内部自行决定如何实现该模块**：包括读取哪些文件、调用哪些工具、如何处理错误。

#### **原则 2：TaskContext 只传递目标状态和约束条件**

```python
TaskContext = {
    "task_id": "task-uuid",
    "goal": "实现用户认证模块",  # 目标状态
    "constraints": {              # 约束条件
        "tech_stack": ["FastAPI", "JWT"],
        "security_level": "high",
        "max_files": 5
    },
    "shared_data": {...},         # 共享数据（已生成的文件列表等）
    "agent_messages": [...]       # Agent 间消息
}
```

- **不传递具体的工具调用序列**：Meta-Agent 不应该告诉 Sub-Agent "先 read_file，再 write_file"。
- **只传递目标和约束**：Sub-Agent 根据目标和约束自行规划执行路径。

#### **原则 3：DAG 分解由 PlannerAgent 负责，而非 Meta-Agent**

```text
用户意图 → Meta-Agent (意图解析) → PlannerAgent (任务分解为 DAG) → AgentRunner (调度执行)
```

- **Meta-Agent 只做意图解析和 Agent 选择**：它不负责复杂的任务分解。
- **PlannerAgent 负责任务分解**：它将复杂任务分解为 DAG，并声明步骤间的依赖关系。
- **AgentRunner 负责调度执行**：它根据 DAG 的依赖关系并行或串行执行步骤。

---

## 三、记忆系统的认识论矛盾：记录"行为"还是记录"意义"？

### 3.1 冲突本质

| 来源 | 主张 | 冲突点 |
|:---|:---|:---|
| **宪法原则一** | 记忆只记"事"（操作），不记"话"（对话） | 操作记忆有明确的 taskType 和 summary |
| **技能记忆设计** | 从成功的操作模式中提取技能 | 超越了单纯的操作记录，是对操作序列的抽象和归纳 |
| **思维镜像设计** | 观察用户行为，学习用户的思维模式 | 试图理解用户的"为什么这样做"，远超"操作记忆"范畴 |

**冲突**：
- 宪法说"只记操作，不记对话"。但技能记忆捕捉的是"成功模式"，这已经超越了单纯的操作记录。
- 思维镜像更进一步，它试图理解用户的**思维模式**——这远远超出了"操作记忆"的范畴。
- 如果思维镜像要对用户行为进行"意义理解"，它应该把结论存在哪里？

### 3.2 化解方向

#### **原则 1：承认"操作→模式→思维"的抽象层级递进**

```text
操作记忆 (Episodic) → 技能记忆 (Skill) → 概念记忆 (Concept)
     ↓                      ↓                    ↓
  原始事件               可复用模板           思维模式/经验总结
```

- **操作记忆（Episodic）**：存储原始事件——"什么时间，什么 Agent，对什么文件，做了什么"
- **技能记忆（Skill）**：存储可复用的操作模板——"当要完成 X 任务时，按这个序列执行"
- **概念记忆（Concept）**：存储思考模式——"在遇到 Y 类问题时，用户倾向于 Z 方案，因为..."

#### **原则 2：扩展宪法解释：向上蒸馏是合法的信息加工**

```text
宪法原则一扩展解释：
记忆系统内部的向上蒸馏（操作→模式→思维）是合法的信息加工，
只要它不污染原始操作记录的纯粹性。
```

- **原始操作记录不可篡改**：Episodic Memory 中的记录一旦写入，永不修改。
- **蒸馏产物存储在更高层**：技能记忆和概念记忆是从操作记忆中提取的抽象，它们不替代原始记录。
- **审计时可追溯**：从技能或概念可以回溯到生成它的原始操作记录。

#### **原则 3：思维镜像的结论存入概念记忆**

```python
# 思维镜像生成的摘要
concept_memory.store({
    "type": "thinking_pattern",
    "pattern": "用户在修改 user_service.py 时，80% 的概率会同时更新 test_user.py",
    "confidence": 0.85,
    "source_episodes": ["episode-123", "episode-456", ...],  # 溯源
    "created_at": timestamp
})
```

- **思维镜像不创建新的记忆层**：它将结论存入 Concept Memory，类型为 `thinking_pattern`。
- **保留溯源信息**：每条思维模式都记录生成它的原始操作记录 ID，确保可追溯。

---

## 四、安全模型的信任悖论

### 4.1 冲突本质

| 来源 | 主张 | 冲突点 |
|:---|:---|:---|
| **信任分级模型** | 信任随采纳行为逐步积累 | 连续采纳 10 次 → 熟悉，30 次 → 信任 |
| **信任模型领域化** | 信任按操作领域分别积累 | 代码解释的信任不影响 Git 推送的信任 |
| **三级决策点** | L3 交付确认永不跳过 | 即使专家级别也必须确认 |

**冲突**：
- 如果信任按领域分别积累，那么一个在"代码解释"领域达到了"专家"级别的用户，在"Git 推送"领域仍然是"新手"。但用户感知的信任是一个整体——"我信任这个系统"。
- **信任是否可以从一个领域迁移到另一个相关领域？**如果用户信任系统在代码生成上自主操作（包括写文件和执行测试），那么当系统执行一个部署技能（包括写文件和网络操作）时，这些操作中的"写文件"部分是否应该自动获得信任？

### 4.2 化解方向

#### **原则 1：信任模型增加操作类型的继承关系**

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

- **操作类型有继承关系**：`git_push` 继承自 `shell_exec`，因此 `shell_exec` 的信任可以部分迁移到 `git_push`。
- **子类型有不同风险等级**：`write_file.sandbox` 的风险低于 `write_file.existing`。

#### **原则 2：信任迁移增加相关性因子**

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
    
    # 计算相关性因子
    if not shared_operations:
        return 0.0
    
    # 相关性 = 共享操作的风险加权平均值
    correlation = sum(
        op.risk_level * op.trust_level 
        for op in shared_operations
    ) / sum(op.risk_level for op in shared_operations)
    
    return min(correlation, 1.0)
```

- **信任可以部分迁移**：如果领域 A 和领域 B 共享相同类型的基础操作，则该基础操作的信任可以部分迁移。
- **迁移比例由相关性决定**：相关性越高，迁移比例越大。

#### **原则 3：L3 交付确认永不跳过（代码层面强制）**

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

- **L3 确认是安全底线**：无论信任级别多高，都必须显示 Diff 并等待用户确认。
- **代码层面强制执行**：在 `DeliveryConfirmation.confirm()` 方法中，不进行信任级别检查，直接要求用户确认。

---

## 五、修订优先级与实施计划

| 优先级 | 冲突/紧张点 | 性质 | 行动 | 预计工作量 |
|:---|:---|:---|:---|:---|
| **P0** | Agent 自主性 vs 技能确定性 | 哲学层冲突 | 明确定义 SkillExecutor 为编排层而非 Agent；增加 `strict_mode` 字段 | 2 天 |
| **P0** | 中心化调度 vs 去中心化调度 | 架构层冲突 | 明确 Meta-Agent 负责 What，Agent 负责 How；TaskContext 只传递目标和约束 | 2 天 |
| **P1** | 记忆系统抽象层级 | 认识论冲突 | 扩展宪法解释：操作→模式→思维的蒸馏是合法的；思维镜像结论存入 Concept Memory | 1 天 |
| **P2** | 跨领域信任迁移 | 体验层紧张 | 增加操作类型继承关系和相关性因子；L3 确认代码层面强制执行 | 2 天 |

**总工作量**: 7 天  
**实施阶段**: Phase 1-2（核心闭环开发期间同步完成）

---

## 六、结语

这些更深层的矛盾不是设计缺陷，而是框架从单一范式（代码助手）扩展到复合范式（思想熔炉）时不可避免的**范式摩擦**。它们反映了三个基本张力：

1. **确定性与自主性的张力**——技能代表可预测性，Agent 代表适应性
2. **集中与分散的张力**——Meta-Agent 代表全局优化，Sub-Agent 代表局部智能
3. **行为与意义的张力**——操作记忆代表客观记录，思维镜像代表主观理解

优秀的架构不是消除这些张力，而是**为每种张力定义清晰的边界和协作协议**。本规范即为这些边界的正式定义，所有后续开发必须严格遵循。

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 架构深层矛盾调和与边界定义已确立
