# Cortex 核心引擎规范 v1.0

**概念具象化 · 全自主执行 · 思维可视化 · 任务规划 · 文件系统 · Git管理 · 网络搜索 · 主动建议 · 系统监控**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 📋 **Phase 1 设计蓝图（待实施）**  
**维护者**: Cortex·架构守护者

---

## ⚠️ 重要说明

本文档定义了 Cortex 核心引擎的设计规范，**实际代码实现尚未完成**。当前项目仅完成了基础设施层的骨架搭建。

---

## 📋 目录

### 第一部分：核心引擎组件
1. [一、概念具象化引擎](#一概念具象化引擎)
2. [二、全自主执行引擎](#二全自主执行引擎)
3. [三、思维可视化引擎](#三思维可视化引擎)
4. [四、四层记忆系统设计](#四四层记忆系统设计)

### 第二部分：任务规划与专业Agent
5. [五、任务规划与监督 Agent](#五任务规划与监督-agent)
6. [六、文件系统 Agent](#六文件系统-agent)
7. [七、Git 分支管理 Agent](#七git-分支管理-agent)
8. [八、网络搜索归纳 Agent](#八网络搜索归纳-agent)

### 第三部分：系统级功能
9. [九、主动建议引擎](#九主动建议引擎)
10. [十、系统管理与健康监控](#十系统管理与健康监控)
11. [十一、安全与授权体系](#十一安全与授权体系)
12. [十二、交互形态设计](#十二交互形态设计)

---

## 第一部分：核心引擎组件

### 一、概念具象化引擎

这是实现"用户不写代码"承诺的第一步，将模糊想法转化为可执行蓝图。

#### 1.1 流程详解

```text
用户输入："我想做一个XXX"
    ↓
ConceptParser (DeepSeek V4 Pro + JSON Output Mode)
    ↓
结构化概念对象: { core_intent, explicit_info, missing_info, suggested_questions[] }
    ↓
澄清交互：系统向用户追问最多3个问题
    ↓
MissingInfoInferrer (四层记忆检索 + LLM 推断)
    ↓
补全后的需求上下文
    ↓
BlueprintGenerator (DeepSeek V4 Pro + 庞大 JSON Schema)
    ↓
完整技术蓝图（包含文件结构、依赖、API定义等）
```

#### 1.2 关键机制

**全局目标函数配置**：
```python
class TaskContext:
    def __init__(self, task_id: str, goal: str, optimization_goal: str = "balanced"):
        self.task_id = task_id
        self.goal = goal
        self.optimization_goal = optimization_goal  # speed_first | quality_first | cost_first | balanced
```

**蓝图决策来源标注**：
```json
{
  "decisions": [
    {
      "decision": "Choose PostgreSQL over MySQL",
      "reason": "Better JSONB support for flexible schema",
      "alternatives": ["MySQL", "MongoDB"],
      "source": "knowledge_base_suggested",
      "confidence": 0.85
    }
  ]
}
```

---

### 二、全自主执行引擎

基于 Think-Act-Observe 循环的自主执行框架。

#### 2.1 标准执行模式

```python
class AutonomousAgent:
    async def execute(self, intent: Intent, context: TaskContext) -> AgentResult:
        max_iterations = 10
        iteration = 0
        
        while iteration < max_iterations:
            # Think: 分析当前状态，决定下一步行动
            thought = await self._think(context)
            
            # Act: 执行工具调用
            action = await self._act(thought)
            result = await self.tool_gateway.execute(action)
            
            # Observe: 观察结果，更新上下文
            observation = await self._observe(result)
            context.update(observation)
            
            # 检查是否完成
            if self._is_task_complete(context):
                return AgentResult(status="success", data=context.final_output)
            
            iteration += 1
        
        # 达到最大迭代次数，触发协商中断
        raise NegotiationInterrupt(
            reason="Max iterations reached",
            suggestions=["请提供更多指导", "简化任务范围"]
        )
```

#### 2.2 错误恢复机制

- **自动重试**：对于临时性错误（网络超时、文件锁），自动重试最多3次
- **策略调整**：如果连续失败，切换到备选方案
- **协商中断**：信心低于阈值时，请求人工干预

---

### 三、思维可视化引擎

让用户能够实时观察 AI 的思考过程。

#### 3.1 ThinkingStream 设计

```python
class ThinkingStream:
    def __init__(self):
        self.events: List[ThinkingEvent] = []
    
    def emit(self, event_type: str, content: str, metadata: Dict = None):
        """发射思考事件"""
        event = ThinkingEvent(
            type=event_type,  # "thought", "action", "observation", "decision"
            content=content,
            timestamp=datetime.utcnow(),
            metadata=metadata or {}
        )
        self.events.append(event)
        EventBus.publish("ThinkingStreamUpdated", event)
```

#### 3.2 前端展示

- **实时流式更新**：使用 WebSocket 推送思考事件
- **分层展示**：高级摘要 vs 详细日志（用户可切换）
- **可折叠时间线**：按 Think-Act-Observe 循环组织

---

### 四、四层记忆系统设计

#### 4.1 记忆层级

| 层级 | 名称 | 存储内容 | 检索方式 |
|------|------|---------|---------|
| L1 | Concept Memory | 用户偏好、技术栈选择、架构决策 | 关键词匹配 + 向量检索 |
| L2 | Skill Memory | 可复用的操作模式、YAML技能模板 | 意图匹配 + 成功率排序 |
| L3 | Episodic Memory | 历史任务记录、文件变更、对话摘要 | 时间序列 + 语义搜索 |
| L4 | Knowledge Base | 外部知识库、最佳实践、文档片段 | FTS5全文检索 + 向量检索 |

#### 4.2 显式价值标记接口

```python
class MemoryValueTagger:
    async def mark_as_important(self, memory_id: str, reason: str = ""):
        """用户主动标记记忆为重要"""
        await self.db.update_memory_importance(
            memory_id,
            importance_multiplier=2.0,
            user_tagged=True,
            tag_reason=reason
        )
    
    async def mark_as_irrelevant(self, memory_id: str, reason: str = ""):
        """用户主动标记记忆为不相关"""
        await self.db.update_memory_importance(
            memory_id,
            importance_multiplier=0.1,
            user_tagged=True,
            suppress_from_recommendations=True
        )
```

---

## 第二部分：任务规划与专业Agent

### 五、任务规划与监督 Agent

#### 5.1 定位

直接处理 Meta-Agent 认为过于复杂的多步任务。当用户意图涉及多个子任务且有依赖关系时，Meta-Agent 将意图委派给 Planner。

| 属性 | 值 |
|:---|:---|
| **id** | `planner_agent` |
| **supportedIntents** | `["plan_task", "execute_workflow"]` |
| **推荐模型** | `deepseek-v4-pro` |
| **思考模式** | 强制开启，`reasoning_effort=max` |

#### 5.2 核心结构：执行计划

```python
ExecutionPlan:
    task_id: str
    description: str
    steps: list[PlanStep]
    dependencies: dict[str, list[str]]  # step_id → 依赖的前置步骤
    parallel_groups: list[list[str]]    # 可并行执行的步骤组

PlanStep:
    id: str
    description: str
    agent_id: str  # 负责执行的 Agent
    expected_output: str
    timeout_seconds: int
```

#### 5.3 DAG 执行引擎

```python
class DAGExecutor:
    async def execute_plan(self, plan: ExecutionPlan) -> ExecutionResult:
        completed_steps = set()
        failed_steps = set()
        
        while len(completed_steps) + len(failed_steps) < len(plan.steps):
            # 找出所有前置条件已满足的步骤
            ready_steps = [
                step for step in plan.steps
                if step.id not in completed_steps 
                and step.id not in failed_steps
                and all(dep in completed_steps for dep in plan.dependencies.get(step.id, []))
            ]
            
            # 并行执行可并行的步骤组
            for group in plan.parallel_groups:
                parallel_steps = [s for s in ready_steps if s.id in group]
                if parallel_steps:
                    results = await asyncio.gather(
                        *[self._execute_step(step) for step in parallel_steps],
                        return_exceptions=True
                    )
                    
                    for step, result in zip(parallel_steps, results):
                        if isinstance(result, Exception):
                            failed_steps.add(step.id)
                        else:
                            completed_steps.add(step.id)
        
        return ExecutionResult(
            success=len(failed_steps) == 0,
            completed_steps=completed_steps,
            failed_steps=failed_steps
        )
```

---

### 六、文件系统 Agent

#### 6.1 职责

- 读取、写入、删除文件
- 目录遍历和文件搜索
- 文件差异对比（Diff）
- 批量文件操作

#### 6.2 安全限制

- **沙箱模式**：默认只能在项目根目录下操作
- **白名单扩展名**：只允许操作代码相关文件（.py, .js, .ts, .md等）
- **文件大小限制**：单次读取不超过 1MB
- **写前确认**：所有写操作必须经过 L3 交付确认

---

### 七、Git 分支管理 Agent

#### 7.1 职责

- 创建/切换/删除分支
- 提交变更（自动生成 Conventional Commits）
- 查看提交历史
- 合并分支（处理冲突）

#### 7.2 工作流程

```text
1. 任务开始时：创建特性分支 feature/task-xxx
2. 执行过程中：所有文件修改在特性分支上进行
3. 任务完成后：
   - 生成 Diff 预览
   - 用户确认后提交
   - 询问是否合并到主分支
```

#### 7.3 信任分级

| 操作 | 最低信任级别 |
|------|------------|
| `git status`, `git log` | novice |
| `git checkout`, `git branch` | familiar |
| `git commit` | familiar |
| `git merge` | trusted |
| `git push` | expert |

---

### 八、网络搜索归纳 Agent

#### 8.1 职责

- 执行 Web 搜索（通过搜索引擎 API）
- 抓取网页内容
- 提取关键信息
- 生成归纳总结

#### 8.2 使用场景

- 查询最新的技术文档
- 寻找第三方库的使用示例
- 调研竞品或最佳实践
- 验证 API 是否存在

#### 8.3 限制

- **速率限制**：每分钟最多 5 次搜索
- **域名白名单**：优先信任知名技术站点（GitHub, StackOverflow, 官方文档）
- **内容过滤**：自动过滤广告和无关内容

---

## 第三部分：系统级功能

### 九、主动建议引擎

#### 9.1 工作原理

```python
class ProactiveEngine:
    async def analyze_and_suggest(self, context: UserContext) -> List[Suggestion]:
        suggestions = []
        
        # 1. 检测重复操作模式
        patterns = await self.skill_detector.detect_patterns(context.recent_actions)
        for pattern in patterns:
            if pattern.frequency > 5 and pattern.success_rate > 0.8:
                suggestions.append(Suggestion(
                    type="skill_creation",
                    title=f"检测到重复模式：{pattern.name}",
                    description="是否将此操作保存为技能？",
                    confidence=pattern.success_rate
                ))
        
        # 2. 基于记忆检索相关建议
        related_memories = await self.memory_retriever.search(context.current_task)
        for memory in related_memories:
            if memory.relevance_score > 0.7:
                suggestions.append(Suggestion(
                    type="memory_recall",
                    title=f"您可能需要：{memory.summary}",
                    description=memory.detail,
                    confidence=memory.relevance_score
                ))
        
        # 3. 基于知识库的最佳实践
        best_practices = await self.knowledge_base.query_best_practices(context.tech_stack)
        for practice in best_practices:
            suggestions.append(Suggestion(
                type="best_practice",
                title=practice.title,
                description=practice.content,
                confidence=0.9
            ))
        
        return sorted(suggestions, key=lambda s: s.confidence, reverse=True)[:3]
```

#### 9.2 展示策略

- **非侵入式**：建议在侧边栏显示，不打断用户当前操作
- **可关闭**：用户可以永久关闭某类建议
- **反馈循环**：用户采纳/拒绝建议会更新引擎模型

---

### 十、系统管理与健康监控

#### 10.1 监控指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| LLM API 响应时间 | > 10s | Warning |
| 内存使用率 | > 80% | Warning |
| 数据库连接池 | < 20% 可用 | Critical |
| Agent 执行失败率 | > 10% | Warning |
| 磁盘空间 | < 1GB | Critical |

#### 10.2 健康检查端点

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if all_checks_pass() else "degraded",
        "components": {
            "llm_api": check_llm_health(),
            "database": check_db_health(),
            "memory_system": check_memory_health(),
            "agent_pool": check_agent_health()
        },
        "uptime": get_uptime(),
        "version": CORTEX_VERSION
    }
```

---

### 十一、安全与授权体系

#### 11.1 信任分级模型

| 级别 | 名称 | 条件 | 权限 |
|------|------|------|------|
| L0 | novice | 新用户 | 只读操作 |
| L1 | familiar | 连续采纳 10 次 | 文件写入（沙箱内） |
| L2 | trusted | 30 次采纳 + 零回滚 | Shell 命令（白名单） |
| L3 | expert | 50 次采纳 + 主动挑战通过 | Git 推送、数据库操作 |

#### 11.2 主动挑战机制

```python
class TrustChallengeSystem:
    async def trigger_challenge(self, user_id: str, from_level: str, to_level: str):
        """信任升级时的边界案例测试"""
        challenge_case = await self._generate_boundary_case(from_level, to_level)
        
        print(f"\n🔒 信任升级挑战：您即将从 '{from_level}' 升级到 '{to_level}'")
        print(f"请评估以下建议是否安全：\n{challenge_case.description}\n")
        
        user_response = await self._wait_for_user_decision()
        
        if user_response == challenge_case.correct_action:
            await self.db.upgrade_trust_level(user_id, to_level)
            print("✅ 挑战通过！信任级别已升级。")
        else:
            print(f"❌ 挑战失败。正确做法应该是：{'接受' if challenge_case.correct_action == 'accept' else '拒绝'}")
```

#### 11.3 TaskToken 授权机制

```python
class TaskToken:
    def __init__(self, task_id: str, permissions: List[str], expires_in: int):
        self.token_id = generate_uuid()
        self.task_id = task_id
        self.permissions = permissions  # ["read_file", "write_file", "shell_exec"]
        self.file_scope = []  # 允许操作的文件路径列表
        self.command_scope = []  # 允许执行的命令列表
        self.created_at = datetime.utcnow()
        self.expires_at = self.created_at + timedelta(seconds=expires_in)
        self.used = False
    
    def validate(self, operation: str, target: str = None) -> bool:
        """验证操作是否在授权范围内"""
        if self.used or datetime.utcnow() > self.expires_at:
            return False
        
        if operation not in self.permissions:
            return False
        
        if target and target not in self.file_scope and target not in self.command_scope:
            return False
        
        return True
```

---

### 十二、交互形态设计

#### 12.1 三种交互模式

| 模式 | 适用场景 | 特点 |
|------|---------|------|
| **对话模式** | 日常问答、代码解释 | 自然语言交互，流式响应 |
| **蓝图模式** | 复杂任务规划 | 可视化 DAG，逐步确认 |
| **技能模式** | 重复性操作 | 一键执行，参数可调 |

#### 12.2 L1/L2/L3 确认机制

- **L1 概念确认**：ConceptParser 输出后，用户确认理解是否正确
- **L2 蓝图确认**：BlueprintGenerator 输出后，用户审查技术方案
- **L3 交付确认**：执行完成后，用户审查 Diff 并批准写入

**原则**：L3 确认永不跳过，无论信任级别多高。

---

## 结语

本文档整合了 Cortex 核心引擎的所有关键组件，从概念具象化到全自主执行，从四层记忆到安全授权体系。它是 Phase 1-5 开发的**唯一真理源**。

**所有开发者和 AI 助手在实现相关功能时，必须严格遵循本规范。**

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 核心引擎规范
