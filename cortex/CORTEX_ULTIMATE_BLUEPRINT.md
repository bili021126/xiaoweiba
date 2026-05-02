# Cortex 框架终极设计蓝图 v1.0

**任务规划 · 文件系统 · Git管理 · 网络搜索 · 主动建议 · 系统监控 · 安全授权 · 交互设计**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🗺️ **Phase 0-5 全栈开发指南**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、任务规划与监督 Agent（Planning & Supervision）](#一任务规划与监督-agentplanning--supervision)
2. [二、文件系统 Agent（FileSystemAgent）](#二文件系统-agentfilesystemagent)
3. [三、Git 分支管理 Agent（GitAgent）](#三git-分支管理-agentgitagent)
4. [四、网络搜索归纳 Agent（WebSearcher）](#四网络搜索归纳-agentwebsearcher)
5. [五、主动建议引擎（Proactive Engine）](#五主动建议引擎proactive-engine)
6. [六、系统管理与健康监控（SystemAgent）](#六系统管理与健康监控systemagent)
7. [七、安全与授权体系（Security System）](#七安全与授权体系security-system)
8. [八、交互形态设计（Interaction Design）](#八交互形态设计interaction-design)
9. [九、Cortex 框架完整总结](#九cortex-框架完整总结)

---

## 一、任务规划与监督 Agent（Planning & Supervision）

### 1.1 定位

直接处理 Meta-Agent 认为过于复杂的多步任务。当用户意图涉及多个子任务且有依赖关系时，Meta-Agent 将意图委派给 Planner。

| 属性 | 值 |
|:---|:---|
| **id** | `planner_agent` |
| **supportedIntents** | `["plan_task", "execute_workflow"]` |
| **推荐模型** | `deepseek-v4-pro` |
| **思考模式** | 强制开启，`reasoning_effort=max` |

### 1.2 核心结构：执行计划

```python
ExecutionPlan:
    task_id: str
    description: str
    steps: list[PlanStep]
    dependencies: dict[str, list[str]]  # step_id → 依赖的前置步骤
    parallel_groups: list[list[str]]    # 可并行执行的步骤组

PlanStep:
    id: str
    agent: str                          # 目标 Agent
    intent: Intent                      # 该步骤的意图
    depends_on: list[str]               # 前置步骤 ID
    timeout_ms: int
    retry_policy: RetryPolicy
    rollback_on_failure: bool           # 失败时回滚
```

### 1.3 执行策略

- **线性执行**：步骤按顺序执行。
- **并行执行**：声明无依赖的步骤可并发执行（受 `AgentRunner` 并发池限制）。
- **条件分支**：根据前一步的输出决定下一步（如测试通过则部署，否则修复）。
- **回滚机制**：若步骤标记 `rollback_on_failure=true`，失败时执行 `GitTool` 恢复到该步骤执行前的检查点。

---

## 二、文件系统 Agent（FileSystemAgent）

### 2.1 定位

处理所有文件系统操作，包括搜索、批量重命名、备份清理、项目结构分析等。

| 属性 | 值 |
|:---|:---|
| **id** | `file_system_agent` |
| **supportedIntents** | `["search_files", "organize_files", "analyze_project"]` |
| **推荐模型** | `deepseek-v4-flash` |

### 2.2 工具集

| 工具 | 用途 |
|:---|:---|
| `list_directory(path, pattern)` | 列出目录内容，支持 glob 模式 |
| `search_files(pattern, content_pattern)` | 按文件名和内容搜索 |
| `batch_rename(operations)` | 批量重命名文件 |
| `analyze_project_structure()` | 分析项目目录结构，生成报告 |
| `calculate_directory_size(path)` | 计算目录大小，发现大文件 |
| `find_duplicates(directory)` | 查找重复文件 |
| `archive_files(files, output)` | 打包归档 |
| `backup_file(path)` | 创建带时间戳的备份 |

### 2.3 智能能力

- **项目结构理解**：分析目录树，理解项目架构（MVC、微服务等）。
- **清理建议**：自动检测临时文件、日志、缓存并建议清理。
- **批量操作预览**：执行批量操作前展示完整的影响范围。

---

## 三、Git 分支管理 Agent（GitAgent）

### 3.1 定位

Git 全部操作的专家，可处理复杂的分支管理、冲突解决、历史查询等场景。

| 属性 | 值 |
|:---|:---|
| **id** | `git_agent` |
| **supportedIntents** | `["git_commit", "git_branch", "git_resolve_conflict", "git_history"]` |

### 3.2 工具集

| 工具 | 用途 |
|:---|:---|
| `get_status()` | 查看工作区状态 |
| `get_diff(staged_only)` | 查看变更差异 |
| `create_branch(name, base)` | 创建分支 |
| `switch_branch(name)` | 切换分支 |
| `merge_branch(source, target)` | 合并分支 |
| `resolve_conflict(file, strategy)` | 使用指定策略解决冲突 |
| `get_history(file, limit)` | 查看文件/项目提交历史 |
| `create_tag(name, message)` | 创建标签 |
| `stash_changes(message)` | 暂存当前变更 |
| `pop_stash(index)` | 恢复暂存 |
| `rebase_branch(onto)` | 变基操作 |
| `cherry_pick(commits)` | 精选提交 |
| `generate_commit_message(diff)` | 智能生成提交信息 |

### 3.3 安全控制

- `push` 操作需用户明确确认。
- `force push` 和 `hard reset` 被默认拦截，需手动解除。

---

## 四、网络搜索归纳 Agent（WebSearcher）

### 4.1 定位

作为 Agent 的知识获取能力，解决本地记忆无法覆盖的最新信息需求。

| 属性 | 值 |
|:---|:---|
| **id** | `web_searcher` |
| **supportedIntents** | `["search_web", "research_topic"]` |
| **推荐模型** | `deepseek-v4-flash` |

### 4.2 工具集

| 工具 | 用途 |
|:---|:---|
| `search_web(query, num_results)` | 执行网络搜索 |
| `fetch_page(url)` | 获取网页内容 |
| `summarize_results(results)` | 使用 LLM 归纳搜索结果 |
| `cache_search(query, results, ttl)` | 缓存搜索（相同查询 24h 内不重复） |

### 4.3 隐私与成本控制

- **搜索前脱敏**：移除文件路径、API Key、用户名等。
- **域名白名单**：默认仅搜索可信源（Stack Overflow、GitHub、官方文档）。
- **每日限额**：可配置最大搜索次数，防止费用失控。

---

## 五、主动建议引擎（Proactive Engine）

### 5.1 定位

不是被动响应，而是主动监测上下文并推送建议。当用户打开文件、切换分支、或长时间编码时，自动触发建议评估。

### 5.2 监测通道

| 监测事件 | 触发条件 | 建议内容 |
|:---|:---|:---|
| `file.opened` | 用户打开了一个函数较多的文件 | 检索该文件的历史操作记忆，提示相关经验 |
| `branch.switched` | 用户切换到了 release 分支 | 提示最近的提交摘要 |
| `session.idle` | 用户已持续工作超过 1 小时 | 建议休息，或提交当前变更 |
| `pattern.detected` | 检测到重复操作模式 | 建议存为技能 |
| `dependency.outdated` | `package.json` 有可更新依赖 | 建议更新并展示更新日志 |

---

## 六、系统管理与健康监控（SystemAgent）

### 6.1 定位

管理 Cortex 自身的运行状态，包括性能监控、磁盘清理、日志管理和配置更新。

| 属性 | 值 |
|:---|:---|
| **id** | `system_agent` |
| **supportedIntents** | `["system_status", "cleanup", "update_config"]` |

### 6.2 能力矩阵

| 能力 | 描述 |
|:---|:---|
| **健康检查** | 检查记忆库大小、向量索引状态、LLM 连接 |
| **磁盘空间监控** | 检查 `~/.cortex/` 的磁盘占用，超过阈值时主动清理 |
| **记忆库统计** | 显示三类记忆的数量、大小、最近更新时间 |
| **性能报告** | 统计各 Agent 的成功率、平均响应时间 |
| **日志轮转** | 自动归档超过 7 天的审计日志 |
| **配置热更新** | 修改配置后无需重启即可生效 |

---

## 七、安全与授权体系（Security System）

### 7.1 TaskToken 机制

每个意图在调度时由 Meta-Agent 生成一次性任务令牌：

```python
TaskToken:
    token_id: str           # UUID
    task_id: str
    permissions: list[str]  # ["read_file", "write_file", "shell_exec", "git_write"]
    granted_at: int
    expires_at: int         # 默认 5 分钟
    scope:                  # 权限范围
        files: list[str]    # 允许访问的文件列表
        commands: list[str] # 允许执行的命令
```

### 7.2 信任分级

| 级别 | 权限 | 适用场景 |
|:---|:---|:---|
| **Trusted** | 完全自动执行，无二次确认 | 用户明确标记为信任的 Agent |
| **Enabled** | 读操作自动，写操作需 Diff 确认 | 默认级别 |
| **Restricted** | 所有操作需确认 | 新安装的 Agent |
| **Disabled** | 禁止使用 | 用户禁用 |

### 7.3 审计日志

所有关键操作记录到带 HMAC 签名的审计日志中，包含时间戳、操作类型、结果、耗时，可导出但不可篡改。

---

## 八、交互形态设计（Interaction Design）

### 8.1 终端主界面布局

```text
┌──────────────────────────────────────────────────────────────┐
│  Cortex · 私人编程管家                    [⚙️] [📊] [🔔]    │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│  会话列表   │   🤖 下午好！我注意到你打开了 user_service.py。    │
│            │   上次你修改这个文件时，顺便更新了单元测试。         │
│  📁 今天   │   需要我帮你运行一下测试确保没有破坏吗？             │
│   用户模块  │                                                 │
│   计算器    │   [运行测试] [不用了]                              │
│  📁 昨天   │                                                 │
│   API重构  │  ─────────────────────────────────────────────  │
│            │                                                 │
│  📁 更早   │   👤 帮我给这个函数写一个完整的单元测试              │
│   数据库迁移│                                                 │
│   日志系统  │                                                 │
│            │                                                 │
│  [+ 新会话] │  ────────────────────────────────────────────── │
│            │                                                 │
│            │  ┌─────────────────────────────────────────────┐│
│            │  │ 输入消息 (Enter发送, Shift+Enter换行)       ││
│            │  └─────────────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────────────┘
```

### 8.2 命令前缀系统

借鉴 Claude Code 的交互习惯，支持自然语言和命令前缀双模式：

| 前缀 | 功能 | 示例 |
|:---|:---|:---|
| `/explain` | 解释代码 | `/explain 这个函数的逻辑` |
| `/generate` | 生成代码 | `/generate 一个用户登录接口` |
| `/commit` | 生成提交信息 | `/commit` |
| `/search` | 网络搜索 | `/search React 19 新特性` |
| `/skill` | 执行技能 | `/skill 部署博客` |
| `/memory` | 查询记忆 | `/memory 我上周改了什么` |
| `/system` | 系统管理 | `/system status` |

### 8.3 语气变化系统

继承"小尾巴"的情绪养成机制，基于有效记忆数量动态调整语气：

| 阶段 | 触发条件 | 语气特征 |
|:---|:---|:---|
| **生疏期** | < 10 条有效记忆 | 礼貌、完整、"您好"、"请问您需要…" |
| **熟悉期** | 10-50 条有效记忆 | 自然、简洁、"你"、"咱们"、"上次那个…" |
| **默契期** | > 50 条有效记忆 | 随意、默契、"记得"、"又来改这个了？" |

---

## 九、Cortex 框架完整总结

### 9.1 定位

Cortex 是一个**独立的、终端原生的全能型 AI 管家框架**。它继承了"小尾巴"项目的灵魂（意图驱动、记忆进化、事件总线），但完全打破了 IDE 的限制，成为一个可嵌入任何前端的通用智能体内核。

### 9.2 核心架构

```text
Cortex = 意图驱动内核 + 可插拔 Agent 生态 + 进化型记忆系统 + 安全护栏
```

| 层级 | 组件 | 职责 |
|:---|:---|:---|
| **前端** | Terminal UI (Textual) / Web UI / IDE Plugin | 用户交互，流式渲染 |
| **调度层** | Meta-Agent + IntentParser + AgentSelector | 意图解析，Agent 调度 |
| **执行层** | AgentRunner + LoopController + SandboxManager | Agent 执行，闭环控制 |
| **能力层** | 17+ 子 Agent | 各自领域的专家能力 |
| **记忆层** | 操作记忆 + 知识记忆 + 偏好记忆 + 进化引擎 | 越用越聪明 |
| **基础设施** | EventBus + Tool Executor + Memory Portal | 解耦、安全、持久化 |

### 9.3 Agent 能力矩阵

| 类别 | Agent | 核心能力 |
|:---|:---|:---|
| **代码智能** | CodeExplainer | 代码解释、逻辑分析 |
| | CodeGenerator | 代码生成、重构 |
| | CompletionAgent | 行内补全（FIM） |
| | SQLOptimizer | SQL 分析与优化 |
| **项目管理** | FileSystemAgent | 文件搜索、整理、备份 |
| | GitAgent | 全功能 Git 操作 |
| | PlannerAgent | 复杂任务拆解与调度 |
| **知识获取** | WebSearcher | 网络搜索与归纳 |
| **系统管理** | SystemAgent | 健康监控、配置管理 |
| **对话交互** | ChatAgent | 闲聊、问答 |
| **自动化** | SkillExecutor | 技能执行 |
| | FullLoopAgent | 全闭环代码交付 |

### 9.4 DeepSeek V4 API 的能力映射

| API 能力 | Cortex 中的使用 |
|:---|:---|
| **Chat Completion** | 所有 Agent 的核心推理引擎 |
| **Thinking Mode** | Planner、CodeGenerator 的深度推理 |
| **Function Calling** | Agent 自主工具调用的唯一通道 |
| **FIM Completion** | CompletionAgent 的专用接口 |
| **Prefix Completion** | Meta-Agent 的确定性 JSON 输出 |
| **1M Context** | 记忆注入的物理基础 |
| **Context Caching** | 记忆经济的核心策略 |

### 9.5 关键创新点

1. **"小尾巴"宪法的继承**：职责边界、测试驱动、体验优先三条铁律继续统治新框架。
2. **全闭环能力**：赋予 Agent 从需求到可交付代码的完整自主权，同时通过多层护栏确保安全。
3. **私有化技能系统**：完全本地化的声明式自动化引擎，用户自己的技能永远属于自己。
4. **主动建议机制**：Agent 不止被动响应，更会像真正的管家一样在合适的时机主动提供帮助。

### 9.6 实施路线图

```text
阶段0 (1周):  骨架验证，ChatAgent + 终端输入输出
阶段1 (2周):  工具集成，Function Calling + 记忆记录与检索
阶段2 (2周):  多Agent调度，意图解析 + Agent评分选择
阶段3 (2周):  代码智能四件套 + 补全 + Git操作
阶段4 (2周):  全闭环 + 技能系统 + 主动建议
阶段5 (持续): 安全加固 + 性能优化 + 插件生态
```

---

**至此，Cortex 框架的完整设计已经全部完成。** 从核心架构到 17 个子系统，从记忆进化到安全护栏，从终端交互到全闭环自动化，每一部分都直接映射到 DeepSeek V4 API 的具体能力上，并且完整继承了"小尾巴"项目的设计哲学。

这份设计可以作为一个完整的蓝图，直接用于任何语言（推荐 Python + FastAPI + Textual）的开发实现。
