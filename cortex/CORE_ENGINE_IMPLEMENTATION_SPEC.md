# Cortex 核心引擎实施规范 v1.0

**概念具象化 · 全自主执行 · 思维可视化 · 四层记忆 · 安全信任 · 主动建议**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 📋 **Phase 1 设计蓝图（待实施）**  
**维护者**: Cortex·架构守护者

---

## ⚠️ 重要说明

本文档定义了 Cortex 核心引擎的设计规范，**实际代码实现尚未完成**。当前项目仅完成了基础设施层的骨架搭建。

---

## 📋 目录

1. [一、概念具象化引擎](#一概念具象化引擎)
2. [二、全自主执行引擎](#二全自主执行引擎)
3. [三、思维可视化引擎](#三思维可视化引擎)
4. [四、四层记忆系统设计](#四四层记忆系统设计)
5. [五、安全与信任分级模型](#五安全与信任分级模型)
6. [六、知识获取与主动建议](#六知识获取与主动建议)
7. [七、全套 Agent 清单与配置](#七全套-agent-清单与配置)

---

## 一、概念具象化引擎

这是实现"用户不写代码"承诺的第一步，将模糊想法转化为可执行蓝图。

### 1.1 流程详解

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
完整蓝图: { tech_stack, architecture, features[P0/P1/P2], roadmap, decisions }
    ↓
L1 决策点界面：BlueprintCard（交互式确认/修改）
```

---

### 1.2 核心组件实现

#### **ConceptParser**
**职责**：解析用户自然语言，提取核心意图，识别缺失信息。

**技术实现**：
- 使用 DeepSeek V4 Pro 的 `response_format={"type": "json_object"}`
- System Prompt 包含严格的 JSON Schema 定义

**输出示例**：
```json
{
  "core_intent": "build a technical blog",
  "explicit_info": {
    "features": ["markdown support", "auto deployment"]
  },
  "missing_info": [
    "preferred frontend framework (React/Vue)?",
    "deployment target (Vercel/GitHub Pages)?"
  ],
  "suggested_questions": [
    "你更熟悉 React 还是 Vue？",
    "你是否需要评论功能？",
    "你希望部署到 Vercel 还是 GitHub Pages？"
  ]
}
```

**实现位置**：`core/concept_engine/concept_parser.py`

---

#### **MissingInfoInferrer**
**职责**：从四层记忆中推断用户未言明的偏好。

**技术实现**：
1. **检索记忆**：
   - Concept Memory：历史项目架构偏好
   - Skill Memory：常用技术栈模式
   - Episodic Memory：过往成功操作序列
2. **LLM 推断**：调用 DeepSeek V4 Pro，结合用户回答和记忆，生成推断结果。

**代码示例**：
```python
async def infer_missing_info(self, user_answers: Dict[str, str], memory_context: Dict) -> Dict[str, Any]:
    # 1. 检索记忆
    concept_prefs = await self.memory_portal.retrieve_concept_memory(user_id=self.user_id)
    skill_patterns = await self.memory_portal.retrieve_skill_memory(tags=["web_development"])
    
    # 2. 构建推断提示
    prompt = f"""
    用户回答了以下问题：{user_answers}
    
    历史偏好：{concept_prefs}
    成功模式：{skill_patterns}
    
    请推断用户未言明的技术选型偏好（如数据库、ORM、测试框架等）。
    """
    
    # 3. 调用 LLM
    response = await self.llm_client.chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model="deepseek-v4-pro",
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

**实现位置**：`core/concept_engine/missing_info_inferrer.py`

---

#### **BlueprintGenerator**
**职责**：生成结构化蓝图，严格遵循庞大的 JSON Schema。

**蓝图 JSON Schema 关键字段**：
```json
{
  "blueprint_id": "uuid",
  "project_name": "string",
  "tech_stack": {
    "frontend": "React 18 + Next.js",
    "backend": "Node.js + Express",
    "database": "PostgreSQL",
    "deployment": "Vercel"
  },
  "architecture": {
    "components": [
      {"name": "API Gateway", "type": "service", "dependencies": []},
      {"name": "User Service", "type": "service", "dependencies": ["Database"]}
    ]
  },
  "features": {
    "P0": ["User Authentication", "Blog Post CRUD"],
    "P1": ["Comment System", "RSS Feed"],
    "P2": ["Search Functionality", "Analytics"]
  },
  "roadmap": [
    {"phase": 1, "tasks": ["Setup Next.js", "Configure PostgreSQL"], "estimated_hours": 4},
    {"phase": 2, "tasks": ["Implement Auth", "Create Blog API"], "estimated_hours": 8}
  ],
  "decisions": [
    {
      "decision": "Choose PostgreSQL over MySQL",
      "reason": "Better JSONB support for flexible schema",
      "alternatives": ["MySQL", "MongoDB"]
    }
  ]
}
```

**实现位置**：`core/concept_engine/blueprint_generator.py`

---

## 二、全自主执行引擎

这是将蓝图变为现实的执行核心，赋予 Agent 真正的动手能力。

### 2.1 核心组件

#### **TaskDecomposer**
**职责**：接收确认的蓝图，拆解为有序的任务 DAG（有向无环图）。

**技术实现**：
- 使用 DeepSeek V4 的 **Prefix Completion (Beta)** 技术，确保任务分解的逻辑连贯性。
- 输出格式：`networkx.DiGraph` 或自定义 DAG 结构。

**DAG 节点示例**：
```python
class TaskNode:
    def __init__(self, task_id: str, description: str, agent_id: str, dependencies: List[str]):
        self.task_id = task_id
        self.description = description
        self.agent_id = agent_id  # 指定执行 Agent
        self.dependencies = dependencies  # 前置任务 ID
        self.status = "pending"  # pending, running, completed, failed
        self.parallel_group: Optional[int] = None  # 并行组 ID
```

**实现位置**：`core/execution_engine/task_decomposer.py`

---

#### **AutonomousAgent 基类**
**职责**：所有执行 Agent 的统一行为框架，遵循 Think-Act-Observe 循环。

**核心循环代码**（已在技术规范中定义，此处略）。

**关键特性**：
- **Think**：整合记忆上下文，调用 LLM（可选思考模式）。
- **Act**：通过 `ToolGateway` 发起工具调用。
- **Observe**：接收结果，反馈给 LLM，进入下一轮循环。
- **ErrorRecovery**：失败时启用 Thinking Mode (high/max) 分析错误日志，自动生成修复补丁并重试（最多 3 次）。

---

## 三、思维可视化引擎

这是构筑信任的关键，让用户能理解并介入 AI 的决策过程。

### 3.1 核心组件

#### **DecisionExplainer**
**职责**：为蓝图中每个关键决策生成人类可读的解释。

**实现方式**：
- 在 BlueprintGenerator 生成决策时，同时调用 LLM 生成解释文本。
- 前端展示：点击决策卡片，展开显示"原因"和"备选方案对比"。

**示例**：
```text
决策：选择 PostgreSQL 而非 MySQL
原因：PostgreSQL 的 JSONB 类型能更好地支持博客文章的灵活元数据（如标签、自定义字段），而 MySQL 的 JSON 支持相对较弱。
备选方案：
- MySQL：优势是生态成熟，但 JSON 查询性能较差。
- MongoDB：优势是原生 JSON，但缺乏关系型数据的完整性约束。
```

**实现位置**：`core/visualization_engine/decision_explainer.py`

---

#### **ThinkingStream**
**职责**：实时展示 DeepSeek 返回的 `reasoning_content`。

**实现方式**：
- WebSocket 推送：当 Agent 开启思考模式时，后端流式推送 `reasoning_content` 片段。
- 前端展示：可折叠卡片，默认收起，用户点击展开查看详细推理过程。

**WebSocket 消息示例**：
```json
{
  "jsonrpc": "2.0",
  "method": "stream.chunk",
  "params": {
    "task_id": "task_123",
    "chunk_type": "reasoning",
    "content": "我正在分析项目结构，发现缺少 package.json..."
  }
}
```

**实现位置**：`core/visualization_engine/thinking_stream.py`

---

#### **ProgressCard**
**职责**：实时任务卡片，展示全闭环进度。

**状态流转**：
```text
Planning → Coding → Testing → Fixing → Delivering
```

**展示内容**：
- 当前步骤状态（进行中/已完成/失败）
- 耗时（如 "Coding: 2m 30s"）
- 关键操作（如 "Generated 5 files"）
- 控制按钮：暂停 / 查看详情 / 手动修正

**实现位置**：前端组件 `ProgressCard.tsx` + 后端 `task.progress` 事件推送

---

### 3.2 三级决策点界面

| 决策点 | 前端组件 | 展示内容 | 用户操作 |
|--------|---------|---------|---------|
| **L1 蓝图确认** | `BlueprintCard` | 技术选型、架构组件、功能列表、实施计划 | 交互式逐项修改 / 确认 / 否决 |
| **L2 高风险操作** | `ConfirmDialog` | Diff 预览、命令预览、受影响文件列表 | 批准 / 拒绝 |
| **L3 交付确认** | `DeliveryReport` | 完整 Diff、测试报告、决策链溯源码 | 合并 / 修正 / 丢弃 |

---

## 四、四层记忆系统设计

记忆是让 Cortex 越用越聪明的基石，有四层明确的服务角色。

### 4.1 记忆分层

| 记忆类型 | 存储内容 | 作用 | 检索场景 |
|---------|---------|------|---------|
| **Concept Memory** | 项目概念、架构偏好、技术栈选择 | 新项目具象化时推断技术栈 | BlueprintGenerator |
| **Skill Memory** | 成功的执行模式（如"代码提交前检查"技能） | 自动复用成功经验 | SkillAmplifier |
| **Episodic Memory** | 每次工具调用、对话历史、操作轨迹 | 时间指代查询、上下文增强 | Think 阶段注入 |
| **Knowledge Base** | 主动从外部引入的技术摘要、最佳实践 | 认知突破建议 | ProactiveEngine |

---

### 4.2 混合检索公式

所有记忆检索统一采用**四因子加权评分公式**：

```python
Score = 0.40 * vector_similarity + 0.25 * keyword_match + 0.15 * time_decay + 0.20 * importance
```

**因子详解**：
- **vector_similarity (0.40)**：ChromaDB 向量相似度（余弦相似度）
- **keyword_match (0.25)**：BM25 关键词匹配得分
- **time_decay (0.15)**：时间衰减因子（`exp(-λ * days_since_created)`，λ=0.01）
- **importance (0.20)**：人工标记或自动评估的重要性评分（0-1）

**实现位置**：`core/memory/hybrid_retriever.py`

**代码示例**：
```python
def calculate_score(vector_sim: float, keyword_score: float, created_at: datetime, importance: float) -> float:
    days_since = (datetime.utcnow() - created_at).days
    time_decay = math.exp(-0.01 * days_since)
    
    score = (
        0.40 * vector_sim +
        0.25 * keyword_score +
        0.15 * time_decay +
        0.20 * importance
    )
    
    return score
```

---

## 五、安全与信任分级模型

安全设计从"二元开关"进化为"梯度信任"，在安全与效率间取得平衡。

### 5.1 核心安全机制

| 机制 | 说明 | 实现位置 |
|------|------|---------|
| **TaskToken** | 一次性令牌，5分钟有效，限定权限和文件范围 | `core/security/task_token.py` |
| **CommandInterceptor** | 黑白名单校验（拦截 `rm -rf /` 等危险命令） | `core/security/command_interceptor.py` |
| **沙箱执行** | L1（临时目录）/ L2（Git分支）/ L3（Docker容器） | `core/security/sandbox.py` |

---

### 5.2 信任分级矩阵

| 信任级别 | 触发条件 | 自动批准范围 | 降级条件 |
|---------|---------|-------------|---------|
| **新手 (默认)** | 初次使用 | 仅只读操作 | - |
| **熟悉** | 连续采纳 10 次建议 | + 文件写入（非破坏性） | 连续拒绝 3 次 |
| **信任** | 连续采纳 30 次 + 零回滚 | + Git 提交、Shell 执行（测试/构建） | 连续拒绝 3 次 |
| **专家** | 用户手动设置 | + 除删除/强制推送外的全部操作 | 连续拒绝 3 次 |

**关键原则**：
- **L3 交付确认永不跳过**：即使专家级别，也必须用户确认最终交付物。
- **信任衰减**：连续拒绝 3 次建议 → 降级一级。

**实现位置**：`core/security/trust_manager.py`

---

## 六、知识获取与主动建议

让 Cortex 学会"主动"，而非总是"被动"响应。

### 6.1 WebSearcher Agent

**职责**：网络搜索与知识归纳。

**安全策略**：
- **内容脱敏**：搜索前自动移除敏感信息（如 API Key、内部路径）。
- **可信源白名单**：仅搜索 StackOverflow、GitHub、官方文档等可信源。
- **成本控制**：每日搜索限额（如 50 次），结果缓存 24 小时。

**实现位置**：`agents/web_searcher.py`

---

### 6.2 ProactiveEngine (主动建议引擎)

**职责**：后台监控多个信号，在恰当时机向用户推送建议卡片。

**触发场景**：
1. **技能固化建议**：检测到用户重复某个操作序列 ≥3 次 → 推送"存为技能"建议。
2. **认知突破建议**：检测到有新技术能带来 >30% 的效率提升 → 推送"认知突破"建议。
3. **意图预测建议**：ThoughtMirror 预测用户下一步操作 → 推送"要我先跑一下测试吗？"建议。

**推送阈值**：
- 只有当预估价值足够高（如效率提升 >30% 或置信度 >70%）时才推送，避免信息噪音。

**实现位置**：`core/evolution/proactive_engine.py`

---

## 七、全套 Agent 清单与配置

所有 Agent 都有明确的能力和推荐配置。

| Agent | 核心职责 | 推荐模型 | 思考模式 | 信任级别要求 |
|-------|---------|---------|---------|-------------|
| **Meta-Agent** | 意图解析、蓝图生成、Agent调度 | V4-Pro | 需要时可开启 | L1 |
| **CodeExplainer** | 代码解释、逻辑分析、Bug诊断 | V4-Pro | 可选开启 | L1 |
| **CodeGenerator** | 代码生成、重构、功能实现 | V4-Pro | 默认开启(high) | L2 |
| **CompletionAgent** | 行内代码补全 (FIM) | V4-Flash | 不支持 | L1 |
| **SQLOptimizer** | SQL优化、索引建议 | V4-Pro | 默认开启(high) | L2 |
| **PlannerAgent** | 复杂任务分解与编排 | V4-Pro | 强制开启(max) | L2 |
| **GitAgent** | 分支/提交/冲突管理 | V4-Flash | 关闭 | L3 |
| **FileSystemAgent** | 文件搜索/整理/备份 | V4-Flash | 关闭 | L2 |
| **WebSearcher** | 网络搜索与知识归纳 | V4-Flash | 关闭 | L1 |
| **SystemAgent** | 健康检查、日志轮转 | V4-Flash | 关闭 | L4 |

**配置示例**（已在技术规范中定义，此处略）。

---

## 🏆 结语

本实施规范定义了 Cortex **Phase 1（核心闭环）** 的七大核心模块：

1. **概念具象化引擎**：ConceptParser → MissingInfoInferrer → BlueprintGenerator
2. **全自主执行引擎**：TaskDecomposer → AutonomousAgent (Think-Act-Observe) → ErrorRecovery
3. **思维可视化引擎**：DecisionExplainer → ThinkingStream → ProgressCard → 三级决策点
4. **四层记忆系统**：Concept/Skill/Episodic/Knowledge + 混合检索公式
5. **安全与信任分级**：TaskToken + CommandInterceptor + 沙箱 + 4级信任模型
6. **知识获取与主动建议**：WebSearcher + ProactiveEngine
7. **全套 Agent 清单**：10个领域专家的配置与分工

**所有开发者和 AI 助手在实施 Phase 1 功能时，必须严格遵循本规范。**

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 核心引擎实施规范
