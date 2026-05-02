# Cortex 记忆系统：DeepSeek V4 混合注意力架构映射规范 v1.0

**CSA 在线记忆 · HCA 离线记忆 · Lightning Indexer · 记忆蒸馏**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🧠 **Phase 1 核心算法**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、核心映射总览](#一核心映射总览)
2. [二、在线记忆：CSA 式检索策略](#二在线记忆csa-式检索策略)
3. [三、离线记忆：HCA 式检索策略](#三离线记忆hca-式检索策略)
4. [四、上下文注入策略](#四上下文注入策略)
5. [五、检索性能优化](#五检索性能优化)
6. [六、实施优先级](#六实施优先级)

---

## 一、核心映射总览

DeepSeek V4 的注意力机制为 Cortex 的记忆系统提供了直接的灵感。它们的核心思想——"**先压缩，后区分精读与略读**"——可以完整映射到记忆的存储、检索和注入策略上。

| DeepSeek V4 注意力机制 | 核心特征 | Cortex 记忆系统映射 | 负责层级 |
|-----------------------|---------|-------------------|---------|
| **CSA** (Compressed Sparse Attention) | 温和压缩(m=4) + 稀疏选择(1024) + 滑动窗口 | **在线记忆**：当前会话上下文、最近操作轨迹 | Episodic + TaskContext |
| **HCA** (Heavily Compressed Attention) | 激进压缩(128x) + 全量交互 | **离线记忆**：概念记忆、技能记忆、知识库 | Concept + Skill + Knowledge |

---

## 二、在线记忆：CSA 式检索策略

在线记忆对应 CSA 的"**细节保留 + 稀疏选择**"哲学。

### 2.1 滑动窗口（细节保留）

**作用**：对应 CSA 中保留的未压缩滑动窗口，确保近期交互细节不丢失。

**实现**：
- 在当前 Agent 的上下文中，保持最近 **N 轮对话**（默认 N=10）的完整原文不压缩。
- **N 的动态调整**：
  - 简单任务（如闲聊）：默认 N=5
  - 复杂任务（如代码重构）：默认 N=20

**代码示例**：
```python
class SlidingWindow:
    def __init__(self, max_size: int = 10):
        self.messages: deque = deque(maxlen=max_size)
    
    def add(self, message: Dict[str, str]):
        self.messages.append(message)
    
    def get_recent(self) -> List[Dict[str, str]]:
        return list(self.messages)
```

---

### 2.2 压缩片段（温和压缩）

**作用**：对应 CSA 中的 m=4 压缩，将旧对话从原始形式压缩为结构化摘要，减少 Token 占用。

**实现**：
- 对早于滑动窗口的对话，每隔 **m 轮**（默认 m=4）生成一个压缩摘要。
- **摘要结构**：
  ```json
  {
    "round_range": "3-6",
    "core_task": "解释auth模块",
    "key_decisions": ["确认使用JWT方案"],
    "involved_files": ["auth.py"]
  }
  ```

**压缩算法**：
```python
async def compress_dialogue(messages: List[Dict]) -> Dict:
    prompt = f"""
    请总结以下对话轮次 {messages[0]['round']} 到 {messages[-1]['round']} 的核心内容：
    {json.dumps(messages)}
    
    输出 JSON 格式：{"round_range": "...", "core_task": "...", "key_decisions": [...], "involved_files": [...]}
    """
    response = await llm_client.chat_completion(messages=[{"role": "user", "content": prompt}])
    return json.loads(response.choices[0].message.content)
```

---

### 2.3 检索策略：Lightning Indexer

**作用**：对应 CSA 中的稀疏选择机制，从大量压缩片段中，仅检索最相关的 Top-K 条（默认 K=5）注入上下文。

**实现**：
- 采用轻量级的混合索引，对所有压缩片段和滑动窗口内容进行实时筛选。
- **评分公式**：
  ```python
  Score = 0.6 * keyword_match + 0.4 * time_decay
  ```
- **动态 Top-K 机制**：根据意图复杂度调整 K 值：
  - 简单意图：K=3
  - 复杂意图：K=8

**代码示例**：
```python
def retrieve_online_memory(query: str, complexity: str) -> List[Dict]:
    # 1. 关键词匹配
    candidates = fts5_search(query)  # SQLite FTS5
    
    # 2. 时间衰减
    for candidate in candidates:
        age_days = (datetime.utcnow() - candidate.created_at).days
        candidate.score = 0.6 * candidate.keyword_score + 0.4 * math.exp(-0.1 * age_days)
    
    # 3. 动态 Top-K
    k = 8 if complexity == "complex" else 3
    return sorted(candidates, key=lambda x: x.score, reverse=True)[:k]
```

---

## 三、离线记忆：HCA 式检索策略

离线记忆对应 HCA 的"**激进压缩 + 全量交互**"哲学。

### 3.1 向量摘要（激进压缩）

**作用**：对应 HCA 的 128x 压缩，将整个项目知识库压缩为一个高维向量索引。

**实现**：
- 对每个概念记忆、技能定义、知识库文章，使用本地嵌入模型 **all-MiniLM-L6-v2**（384维）生成向量表示。
- 存入 **ChromaDB** 或 **SQLite BLOB**。
- **元数据过滤**：与当前项目无关的记忆直接过滤（如不同技术栈的技能），当前项目相关的记忆全部纳入向量检索范围。

**代码示例**：
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_memory(content: str) -> np.ndarray:
    return model.encode(content)

# 存入 ChromaDB
chroma_collection.add(
    embeddings=[embed_memory(skill_definition)],
    documents=[skill_definition],
    metadatas=[{"project_id": "proj_123", "tech_stack": "react"}]
)
```

---

### 3.2 四因子加权检索（全量交互）

**作用**：对应 HCA 中的全量交互——查询向量与所有压缩后的记忆进行相似度计算。

**实现**：
- 使用设计的四因子加权公式：
  ```python
  Score = 0.40 × vector_similarity + 0.25 × keyword_match + 0.15 × time_decay + 0.20 × importance
  ```
- **全量检索不等于全量注入**：取 Top-K（默认 K=10），且 Score < 阈值（默认 0.3）的记忆被过滤。

**代码示例**：
```python
def retrieve_offline_memory(query: str, project_id: str) -> List[Dict]:
    # 1. 向量检索
    query_vector = embed_memory(query)
    vector_results = chroma_collection.query(
        query_embeddings=[query_vector],
        where={"project_id": project_id},
        n_results=50
    )
    
    # 2. 四因子加权评分
    scored_results = []
    for result in vector_results:
        vector_sim = result['distance']  # ChromaDB returns distance, convert to similarity
        keyword_score = bm25_score(query, result['document'])
        time_decay = math.exp(-0.01 * result['metadata']['age_days'])
        importance = result['metadata']['importance']
        
        score = 0.40 * vector_sim + 0.25 * keyword_score + 0.15 * time_decay + 0.20 * importance
        if score > 0.3:
            scored_results.append({"document": result['document'], "score": score})
    
    # 3. Top-K
    return sorted(scored_results, key=lambda x: x['score'], reverse=True)[:10]
```

---

### 3.3 记忆蒸馏（定期再压缩）

**作用**：对应 HCA 的潜在空间映射——定期将多条相关记忆重映射为一个更精炼的表示。

**实现**：
- **后台任务**：定期执行（如每天凌晨）。
- **触发条件**：当同一概念下的情景记忆超过 5 条时。
- **蒸馏过程**：调用 LLM 进行冷数据归档，将多条操作记忆蒸馏为一条"概念记忆"或"经验总结"。
- **归档策略**：蒸馏后，原始情景记忆标记为"已归档"，保留在 Episodic Memory 中供深度回溯（如审计）；正常检索时优先返回蒸馏后的概念记忆。

**代码示例**：
```python
async def distill_memories(concept_id: str):
    # 1. 获取未归档的情景记忆
    episodic_memories = await db.get_episodic_memories(concept_id, archived=False)
    
    if len(episodic_memories) >= 5:
        # 2. 调用 LLM 蒸馏
        prompt = f"请总结以下5条操作记忆为一条概念记忆：{episodic_memories}"
        distilled = await llm_client.chat_completion(messages=[{"role": "user", "content": prompt}])
        
        # 3. 存入 Concept Memory
        await db.store_concept_memory(concept_id, distilled.choices[0].message.content)
        
        # 4. 标记原始记忆为已归档
        for mem in episodic_memories:
            await db.mark_archived(mem.id)
```

---

## 四、上下文注入策略

检索完成后，记忆注入 Agent 的上下文遵循分层结构（对应注意力机制的分层处理）。

### 4.1 注入优先级

1. **第一优先级 (Retained)**：系统提示 + 用户偏好（被 DeepSeek KV Cache 缓存，无需重复注入 Token）。
2. **第二优先级 (CSA)**：在线记忆检索结果（压缩摘要 + 近期对话原文）。
   - 滑动窗口内容直接追加到对话历史中供完整注意力计算。
   - 压缩片段以结构化 System Prompt 形式注入。
3. **第三优先级 (HCA)**：离线记忆检索结果（Top-K 概念/技能/知识）。
   - 若有与当前意图 >0.8 高度匹配的概念或技能定义，追加到 System Prompt 末尾。

### 4.2 注入格式

```text
## 项目背景 (Concept Memory)
[检索到的概念记忆摘要]

## 相关历史 (Compressed Episodic Fragments)
[CSA 检索到的压缩片段]

## 可用技能 (Skill Memory)
[匹配的技能列表及参数]

## 外部知识 (Knowledge Base)
[检索到的技术文档摘要]
```

### 4.3 Token 预算分配

| 内容 | 预算占比 | 说明 |
|------|---------|------|
| 系统提示 + 用户偏好 | 缓存 | 不计入动态预算（KV Cache） |
| 在线记忆（CSA 检索结果） | 40% | 压缩摘要 + 近期对话原文 |
| 离线记忆（HCA 检索结果） | 30% | Top-K 概念/技能/知识 |
| 当前输入 + 对话原文 | 30% | 用户最新指令 + 滑动窗口 |

**截断策略**：如果检索结果超过预算，优先截断低分数记忆。

---

## 五、检索性能优化

借鉴 DeepSeek V4 注意力机制中的 **Lightning Indexer** 设计，在 Cortex 中增加快速筛选层。

| 优化点 | 借鉴来源 | 实现方式 |
|--------|---------|---------|
| **Lightning Indexer** | CSA 的稀疏选择(1024 选 N) | 在进行昂贵的向量余弦相似度计算前，先用 **SQLite FTS5** 全文索引快速筛选候选集，将候选集从全量(10K)缩小到 Top 100 |
| **分级检索** | CSA 的滑动窗口（粗选） + 压缩片段（精选） | 第一级（在线）用滑动窗口+关键词快速召回最近 N 轮对话；第二级（离线）用向量相似度精选 Top-K 压缩记忆 |
| **缓存复用** | KV Cache 机制 | 将高频访问的记忆摘要放入 **Redis/内存缓存**，TTL=5分钟 |

**流程示意**：
```text
用户查询
  ↓
Lightning Indexer (SQLite FTS5 粗筛) → 候选集从 10K 缩小到 100
  ↓
向量精排 (ChromaDB 余弦相似度) → Top-K
  ↓
四因子加权评分 → 最终结果
  ↓
Redis 缓存 (TTL=5min)
```

---

## 六、实施优先级

| 阶段 | 内容 | 工作量 | 收益 |
|------|------|--------|------|
| **Phase 1** | 实现滑动窗口 + 压缩片段 | 2天 | 大幅减少上下文 Token 消耗 |
| **Phase 2** | 实现分级检索 (FTS5 粗筛 + 向量精排) | 3天 | 检索延迟降低 60% |
| **Phase 3** | 实现记忆蒸馏后台任务 | 3天 | 长期记忆质量提升 |
| **Phase 4** | 实现动态预算与缓存复用 | 2天 | 进一步降低 API 成本 |

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 记忆系统混合注意力架构规范
