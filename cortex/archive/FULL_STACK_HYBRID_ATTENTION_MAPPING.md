# Cortex 全栈 DeepSeek V4 混合注意力架构映射规范 v1.0

**Agent 调度 · 自主执行 · 安全检测 · 前端交互 · 模型选择**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🧠 **Phase 1-5 全栈优化**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、Agent 调度层：稀疏选择 + 轻度交互](#一agent-调度层稀疏选择--轻度交互)
2. [二、自主执行层：滑动窗口 + 压缩回放](#二自主执行层滑动窗口--压缩回放)
3. [三、Agent 设计层：深度思考 + 轻量交互](#三agent-设计层深度思考--轻量交互)
4. [四、安全层：注意力机制启发的风险检测](#四安全层注意力机制启发的风险检测)
5. [五、交互层：分层推送策略](#五交互层分层推送策略)
6. [六、模型选择策略：分级路由](#六模型选择策略分级路由)
7. [七、完整映射总览](#七完整映射总览)
8. [八、性能与成本收益预估](#八性能与成本收益预估)
9. [九、实施优先级](#九实施优先级)

---

## 一、Agent 调度层：稀疏选择 + 轻度交互

借鉴 CSA 的"**从大量候选中快速筛选最相关子集**"思想。

| 映射点 | CSA 原机制 | Cortex 调度映射 |
|--------|-----------|----------------|
| **稀疏选择** | Lightning Indexer 从全量 Token 中选 Top-1024 | Meta-Agent 从 Agent 注册表中快速筛选候选 Agent |
| **滑动窗口** | 保留未压缩的邻近 Token | 最近使用过的 Agent 优先进入候选池 |
| **压缩片段** | 对远距离 Token 压缩后检索 | 对不常用的 Agent 仅保留能力摘要索引 |

### 1.1 Agent 调度器优化

**第一级（粗筛）**：基于意图类型和 Agent 的能力声明，用规则匹配快速筛选候选 Agent（≤5 个）。

**第二级（精排）**：对候选 Agent 使用 **Wilson Lower Bound 评分**（成功率 + 响应速度 + 用户偏好），选出最佳。

**滑动窗口优先**：最近 3 次被调度的 Agent 自动进入候选池，额外加分。

**代码示例**：
```python
class AgentScheduler:
    def __init__(self):
        self.recent_agents: deque = deque(maxlen=3)  # 滑动窗口
    
    def select_agent(self, intent: str) -> SubAgent:
        # 1. 粗筛：基于意图匹配
        candidates = self.registry.find_by_intent(intent)
        
        # 2. 滑动窗口优先：最近使用的 Agent 加分
        for agent in candidates:
            if agent.agent_id in self.recent_agents:
                agent.score += 0.2
        
        # 3. 精排：Wilson Lower Bound 评分
        best_agent = max(candidates, key=lambda a: self.wilson_score(a))
        
        # 4. 更新滑动窗口
        self.recent_agents.append(best_agent.agent_id)
        
        return best_agent
    
    def wilson_score(self, agent: SubAgent) -> float:
        """计算 Wilson Lower Bound 评分"""
        successes = agent.stats.successes
        failures = agent.stats.failures
        n = successes + failures
        if n == 0:
            return 0.5
        z = 1.96  # 95% 置信度
        phat = successes / n
        return (phat + z*z/(2*n) - z * math.sqrt((phat*(1-phat)+z*z/(4*n))/n)) / (1+z*z/n)
```

---

## 二、自主执行层：滑动窗口 + 压缩回放

借鉴 CSA 的滑动窗口机制来优化 **Think-Act-Observe** 循环中的 Token 管理。

| 映射点 | CSA 原机制 | 执行层映射 |
|--------|-----------|-----------|
| **滑动窗口** | 保留未压缩的邻近 Token | 最近 N 轮 Think-Act 完整保留在上下文中 |
| **压缩片段** | 远距离 Token 压缩后检索 | 早期的循环步骤被压缩为结构化摘要 |
| **稀疏选择** | 从压缩片段中选 Top-K 注入 | 发生错误时，从历史压缩记录中检索相似场景 |

### 2.1 执行循环优化

**对话上下文结构**：
```text
[系统提示] (缓存)
[用户偏好 + 项目背景] (缓存)
[压缩的历史循环] ← 第1-5轮 Think-Act，压缩为摘要
[完整的最近循环] ← 第6-10轮 Think-Act，保留原文
[当前 Think 输入]
```

### 2.2 错误恢复增强

当 `ErrorRecovery` 触发时，检索压缩的历史循环记录，找到"**类似错误的成功修复模式**"作为少样本提示（Few-shot Prompt）注入当前修复尝试。

**代码示例**：
```python
async def error_recovery(self, error: Exception, task_context: TaskContext) -> Dict:
    # 1. 检索相似错误历史
    similar_errors = await self.memory_portal.retrieve_similar_errors(
        error_type=type(error).__name__,
        top_k=3
    )
    
    # 2. 构建 Few-shot Prompt
    few_shot_examples = "\n".join([
        f"错误: {e.error}\n修复方案: {e.solution}"
        for e in similar_errors
    ])
    
    # 3. 调用 LLM 生成修复方案
    prompt = f"""
    当前错误: {str(error)}
    
    历史相似错误及修复方案:
    {few_shot_examples}
    
    请生成修复方案。
    """
    
    response = await self.llm_client.chat_completion(messages=[{"role": "user", "content": prompt}])
    return json.loads(response.choices[0].message.content)
```

---

## 三、Agent 设计层：深度思考 + 轻量交互

借鉴 CSA/HCA 的分层处理思想，为 Agent 设计两种思考模式。

| 模式 | 借鉴来源 | 适用场景 | Token 消耗 |
|------|---------|---------|-----------|
| **轻量模式 (HCA 式)** | 激进压缩 + 全量交互 | 简单任务（文件操作、代码解释） | 低 |
| **深度模式 (CSA 式)** | 温和压缩 + 稀疏选择 + 滑动窗口 | 复杂任务（架构设计、Bug 修复） | 高 |

### 3.1 Agent 配置扩展

```python
class AutonomousAgent:
    thinking_config = {
        "light": {
            "model": "deepseek-v4-flash",
            "thinking": False,
            "context_strategy": "hca",      # 激进压缩离线记忆
            "max_history_rounds": 5          # 少量滑动窗口
        },
        "deep": {
            "model": "deepseek-v4-pro",
            "thinking": True,
            "reasoning_effort": "high",
            "context_strategy": "csa",       # 温和压缩 + 更多滑动窗口
            "max_history_rounds": 20
        }
    }
```

---

## 四、安全层：注意力机制启发的风险检测

借鉴 CSA 的稀疏选择机制，在安全检测中实现"**重点关注高风险操作**"。

| 映射点 | 安全层实现 |
|--------|-----------|
| **稀疏选择** | 对高风险操作（Shell 执行、文件写入、网络请求）进行 100% 审查；低风险操作（文件读取、代码搜索）自动放行 |
| **滑动窗口** | 持续监控最近 N 次操作的风险累积效应——即使单个操作是低风险的，组合起来也可能构成威胁 |
| **压缩片段** | 将历史审计日志压缩为风险特征向量，用于异常检测模型 |

### 4.1 组合风险评估增强

借鉴注意力机制中 **Query-Key 交互**的思想，检测当前操作（Query）与历史敏感操作（Key）的关联度。

**示例**：当 Agent 先读取 `.env` 文件（敏感操作），又尝试执行网络请求时，系统自动检测到数据流风险并触发 L2 决策点。

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

---

## 五、交互层：分层推送策略

借鉴 CSA/HCA 的分层处理思想，优化前端消息推送。

| 优先级 | 借鉴来源 | 推送内容 | 实现方式 |
|--------|---------|---------|---------|
| **P0 关键** | CSA 滑动窗口（就近关注） | 任务完成/失败、L2/L3 决策点、错误告警 | 即时推送 + 高亮卡片 |
| **P1 重要** | CSA 稀疏选择 | 任务进度更新、决策解释 | 实时推送到进度卡片 |
| **P2 可选** | HCA 激进压缩 | 主动建议、认知突破、记忆蒸馏完成通知 | 静默存入通知中心，用户闲时查看 |

**WebSocket 消息示例**：
```json
{
  "jsonrpc": "2.0",
  "method": "notification.push",
  "params": {
    "priority": "P0",
    "type": "task.completed",
    "content": "任务已完成",
    "timestamp": "2026-04-22T10:30:00Z"
  }
}
```

---

## 六、模型选择策略：分级路由

Token 预算分配进一步细化——根据任务复杂度，动态选择模型和上下文策略。

| 任务复杂度 | 模型 | 上下文策略 | 滑动窗口 | 压缩比率 | Token 预算 |
|-----------|------|-----------|---------|---------|-----------|
| **简单** | v4-flash | HCA 式 | 5轮 | 激进(128x) | 4K |
| **中等** | v4-pro (非思考) | CSA 式 | 10轮 | 温和(4x) | 16K |
| **复杂** | v4-pro (思考模式) | CSA 式 | 20轮 | 温和(4x) | 384K |
| **全闭环** | v4-pro (max reasoning) | CSA 式 | 30轮 | 温和(4x) + 保留关键原文 | 384K |

**代码示例**：
```python
class ModelRouter:
    def route(self, task_complexity: str) -> ModelConfig:
        if task_complexity == "simple":
            return ModelConfig(
                model="deepseek-v4-flash",
                context_strategy="hca",
                max_history_rounds=5,
                compression_ratio=128
            )
        elif task_complexity == "complex":
            return ModelConfig(
                model="deepseek-v4-pro",
                thinking=True,
                reasoning_effort="high",
                context_strategy="csa",
                max_history_rounds=20,
                compression_ratio=4
            )
        # ... 其他复杂度
```

---

## 七、完整映射总览

| DeepSeek V4 机制 | 记忆系统 | Agent 调度 | 自主执行 | 安全检测 | 前端交互 |
|-----------------|---------|-----------|---------|---------|---------|
| **CSA 温和压缩 (m=4)** | 对话压缩为摘要 | - | 早期循环压缩 | 审计日志压缩 | - |
| **CSA 稀疏选择 (1024)** | 在线记忆 Top-K 检索 | 候选 Agent 筛选 | 错误恢复检索相似案例 | 高风险操作聚焦 | 关键消息即时推送 |
| **CSA 滑动窗口** | 保留最近 N 轮原文 | 最近使用的 Agent 优先 | 最近循环完整保留 | 近 N 次操作风险累积监控 | - |
| **HCA 激进压缩 (128x)** | 知识库向量化 | 不常用 Agent 能力摘要 | - | - | 非关键通知静默存档 |
| **HCA 全量交互** | 离线记忆全量检索 | - | - | - | - |
| **Lightning Indexer** | FTS5 粗筛 + 向量精排 | 规则匹配 + Wilson 精排 | - | - | - |

---

## 八、性能与成本收益预估

| 优化措施 | 借鉴来源 | 预期效果 |
|---------|---------|---------|
| **对话压缩（温和 m=4）** | CSA | Token 消耗降低 40% |
| **知识库向量压缩（128x）** | HCA | 检索延迟降低 60% |
| **Lightning Indexer 分级检索** | CSA | 检索延迟降低 50%，召回率保持 >90% |
| **KV Cache 前缀优化** | KV Cache | API 成本降低 30%（缓存命中率 >60%） |
| **动态 Token 预算分配** | 分级路由 | 简单任务成本降低 50%，复杂任务成功率提升 20% |
| **滑动窗口 + 压缩历史** | CSA | 长对话任务成功率提升 25% |

---

## 九、实施优先级

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **Phase 1** | 滑动窗口 + 对话压缩（执行层优化） | 2天 |
| **Phase 2** | Lightning Indexer 分级检索（记忆 + 调度） | 3天 |
| **Phase 3** | Agent 轻量/深度双模式 + 动态 Token 预算 | 2天 |
| **Phase 4** | 组合风险评估 + 分层推送策略 | 2天 |
| **Phase 5** | KV Cache 前缀优化 + 定期记忆蒸馏 | 2天 |

**总工作量**: 11 天  
**预期总收益**: 
- Token 消耗降低 40-60%
- 检索延迟降低 50-60%
- API 成本降低 30%
- 长对话任务成功率提升 25%

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 全栈混合注意力架构规范
