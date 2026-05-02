# Cortex 技能系统：私有自动化引擎规范 v1.0

**完全本地化 · 声明式定义 · 渐进式智能 · 安全沙箱**

**日期**: 2026-04-22  
**版本**: v1.0  
**状态**: 🛠️ **Phase 1-3 核心规范**  
**维护者**: Cortex·架构守护者

---

## 📋 目录

1. [一、核心定位：完全私有的个人自动化引擎](#一核心定位完全私有的个人自动化引擎)
2. [二、三层技能体系](#二三层技能体系)
3. [三、技能定义规范 (Skill Spec)](#三技能定义规范-skill-spec)
4. [四、技能执行引擎](#四技能执行引擎)
5. [五、自动沉淀机制（技能建议）](#五自动沉淀机制技能建议)
6. [六、技能存储结构](#六技能存储结构)
7. [七、与 Cortex 核心的集成](#七与-cortex-核心的集成)
8. [八、实施优先级](#八实施优先级)

---

## 一、核心定位：完全私有的个人自动化引擎

技能系统是 Cortex 的**用户私人自动化引擎**。它的核心哲学是：

> **你的技能，永远只属于你。**

- **完全本地化**：所有技能定义文件存储在用户本地，不上传、不共享、不采集。
- **声明式定义**：用户用简洁的声明式语言（YAML/JSON）描述"做什么"，无需编程。
- **渐进式智能**：系统能从用户的操作中学习模式，**建议**创建技能，但最终决定权永远在用户手中。
- **安全沙箱**：技能在受限环境中执行，受令牌审批、Diff确认、命令白名单多层防护。

---

## 二、三层技能体系

```text
┌─────────────────────────────────────────────────────────────┐
│                    技能系统 (Skill System)                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              第一层：用户手写技能 (Handcrafted)         │  │
│  │  用户自主创建，完全掌控，声明式定义。                   │  │
│  │  位置：~/.cortex/skills/user/                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              第二层：自动沉淀技能 (Auto-Distilled)      │  │
│  │  系统检测重复模式，建议创建。用户审核通过后启用的技能。  │  │
│  │  位置：~/.cortex/skills/auto/                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              第三层：动态组合工作流 (Dynamic Workflow)  │  │
│  │  多个技能临时串联，形成一次性的复杂任务流。              │  │
│  │  不持久化，由 Meta-Agent 在运行中动态编排。              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、技能定义规范 (Skill Spec)

### 3.1 完整 Schema

```yaml
# 技能定义文件：~/.cortex/skills/user/<skill-name>.yaml

# 基本信息
name: "deploy-blog"                 # 技能名称（唯一标识，snake_case）
description: "构建并部署我的博客到服务器"  # 技能描述
version: "1.0.0"                  # 语义化版本
author: "user"                       # 作者（默认当前用户）

# 作用域
scope: "global"                   # global（全局可用）| project（仅当前项目）
project_matcher: ""               # 如果 scope=project，可指定项目名/路径模式

# 触发方式
triggers:
  - type: "manual"                # manual | schedule | event
    # 如果是 schedule：
    # cron: "0 8 * * 1"           # 每周一早8点
    
    # 如果是 event：
    # event: "file.saved"
    # pattern: "src/blog/**/*.md"

# 输入参数（可选，由用户或LLM在执行时提供）
inputs:
  - name: "message"
    type: "string"
    description: "提交信息（可选）"
    required: false
    default: "自动构建部署"
  - name: "target_dir"
    type: "path"
    description: "博客源码目录"
    required: true

# 执行步骤
steps:
  - id: "build"
    tool: "execute_shell"          # 统一工具名称（遵循 Agent 技术规范）
    params:
      command: "npm run build"
      cwd: "{{ inputs.target_dir }}"
    timeout: 120000                # 超时时间（毫秒）
    on_failure: "stop"             # stop | skip | retry

  - id: "test"
    tool: "execute_shell"
    params:
      command: "npm test"
      cwd: "{{ inputs.target_dir }}"
    timeout: 60000
    on_failure: "stop"

  - id: "deploy"
    tool: "execute_shell"
    params:
      command: "rsync -avz dist/ user@server:/var/www/blog/"
      cwd: "{{ inputs.target_dir }}"
    timeout: 300000
    require_confirm: true           # 是否需要用户确认

  - id: "notify"
    tool: "notify"                  # 通知工具
    params:
      title: "部署完成"
      message: "博客已成功部署到服务器"
    on_failure: "skip"              # 通知失败不影响整体

# 后置清理
cleanup:
  - tool: "execute_shell"
    params:
      command: "rm -rf dist"
      cwd: "{{ inputs.target_dir }}"
```

### 3.2 可用工具类型

| 工具名 | 功能 | 关键参数 |
|-------|------|---------|
| `execute_shell` | 执行 Shell 命令 | `command`, `cwd`, `env` |
| `read_file` | 读取文件 | `path` |
| `write_file` | 写入文件 | `path`, `content` |
| `call_llm` | 调用 LLM（受限模式，无工具调用能力） | `prompt`, `system`, `temperature` |
| `show_diff` | 展示差异 | `original`, `modified` |
| `search_memory` | 检索记忆 | `query`, `limit` |
| `wait` | 等待（仅用于技能流程控制） | `duration_ms` |
| `notify` | 发送本地通知 | `title`, `message` |

### 3.3 变量模板

技能步骤中的参数支持模板变量，使用 `{{ 变量名 }}` 语法：

- **输入参数**：`{{ inputs.<param_name> }}`
- **步骤输出**：`{{ steps.<step_id>.output }}`（上一步的 stdout 或返回结果）
- **系统变量**：`{{ env.HOME }}`, `{{ env.PWD }}`, `{{ timestamp }}`, `{{ date }}`

---

## 四、技能执行引擎

### 4.1 执行流程

```text
用户触发技能
    ↓
Skill Engine 加载技能定义
    ↓
验证 Schema + 解析变量模板
    ↓
为每一步创建 TaskToken（写操作需授权）
    ↓
按顺序执行步骤
    ├── 执行前：检查前置条件
    ├── 执行中：实时反馈进度（通过 EventBus）
    │   ├── tool = shell → ShellTool 执行
    │   ├── tool = write_file → FileTool 执行 + Diff 确认
    │   └── tool = call_llm → LLMAdapter 执行
    ├── 执行后：保存步骤输出 → 供后续步骤引用
    └── 失败处理：根据 on_failure 规则（stop / skip / retry）
    ↓
执行 cleanup 步骤
    ↓
发布 SkillCompleted 事件
    ↓
操作记忆记录（task_type = "SKILL_EXECUTE"）
```

### 4.2 安全机制

- **每次执行申请令牌**：技能执行会为每一步写操作自动申请 `TaskToken`，有效期仅限当前技能执行期间。
- **写操作确认**：标记 `require_confirm: true` 的步骤，会在终端弹出确认框。
- **命令白名单**：`shell` 工具默认拦截危险命令（`rm -rf /`, `chmod 777`, `sudo ...` 等），用户可在全局配置中修改白名单。
- **审计日志**：技能执行的每一步都记录到审计日志中。

### 4.3 交互界面

在终端中，技能执行表现为一个**实时更新的任务卡片**：

```text
┌─────────────────────────────────────────────────────────────┐
│ 📦 技能：部署博客                                            │
│ 🟢 状态：执行中 (步骤 2/4)                                   │
├─────────────────────────────────────────────────────────────┤
│ ✅ 构建   完成 (12.3s)                                      │
│ 🔄 测试   运行中...                                         │
│ ⏳ 部署   等待中                                            │
│ ⏳ 通知   等待中                                            │
├─────────────────────────────────────────────────────────────┤
│ [查看详情] [暂停] [终止]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、自动沉淀机制（技能建议）

### 5.1 触发条件

系统后台持续监控用户的**操作模式**。当检测到以下情况时，触发技能建议：

- 同一操作序列（如 `修改文件 → 运行测试 → Git提交`）在 **7天内出现了3次以上**。
- 操作序列涉及 **3个或更多步骤**。
- 系统对该模式的**置信度超过 0.6**（由步骤一致性和频率计算）。

### 5.2 建议流程

```text
系统检测到重复模式
    ↓
后台生成技能草稿（自动提取步骤）
    ↓
用户下次打开终端时，显示通知卡片：
┌─────────────────────────────────────────────────────────────┐
│ 💡 技能建议                                                  │
│                                                             │
│ 我注意到你最近3次提交代码前都执行了：                         │
│   1. npm run lint                                           │
│   2. npm test                                               │
│   3. git add . && git commit                                │
│                                                             │
│ 要不要把它存为一个"提交前检查"技能？                           │
│                                                             │
│ [预览技能] [立即创建] [不再建议]                               │
└─────────────────────────────────────────────────────────────┘
    ↓
用户点击"预览技能"
    ↓
展示完整的技能 YAML 定义，用户可编辑
    ↓
用户确认 → 保存到 ~/.cortex/skills/auto/
    ↓
进入试用期（连续5次采纳后才自动应用）
```

### 5.3 试用期机制

自动沉淀的技能**默认进入试用期**：

- `trial: true`，`adopt_count: 0`
- 每次匹配到该技能时，提示"检测到匹配的「XXX」技能，是否执行？"而不是自动执行。
- 用户采纳 → `adopt_count++`
- 连续采纳 **5次** → 自动应用（不再询问）
- 用户连续拒绝 **3次** → 终止试用，标记为"不推荐"

---

## 六、技能存储结构

```text
~/.cortex/
└── skills/
    ├── user/                    # 用户手写技能
    │   ├── deploy-blog.yaml
    │   ├── code-review.yaml
    │   └── daily-backup.yaml
    │
    ├── auto/                    # 自动沉淀技能
    │   ├── pre-commit-check.yaml
    │   ├── format-on-save.yaml
    │   └── .meta/               # 元数据（试用期状态等）
    │       └── trials.json
    │
    └── archive/                 # 用户归档/禁用的技能
        └── old-docker-deploy.yaml
```

---

## 七、与 Cortex 核心的集成

```text
用户："执行部署博客技能"
    ↓
Meta-Agent 接收意图
    ↓
IntentParser → {"agent": "skill_executor", "skill": "deploy-blog"}
    ↓
AgentRunner 启动 SkillExecutor Agent
    ↓
SkillExecutor 加载 YAML → 验证 Schema → 执行步骤
    │
    ├── 每步执行 → 发布 step.started / step.completed 事件
    │               → 终端实时更新任务卡片
    │
    ├── 工具调用 → Tool Executor（TaskToken 校验 + 审计）
    │
    └── 完成 → 发布 SkillCompleted 事件
                → Memory Portal 记录操作记忆
                → 终端展示最终结果
```

---

## 八、实施优先级

| 阶段 | 内容 | 目标 |
|------|------|------|
| **P0（核心）** | 技能定义 Schema + 执行引擎（YAML → 步骤执行） | 用户可以手写并执行简单技能 |
| **P1（安全）** | TaskToken 授权 + 命令白名单 + Diff 确认 | 技能执行有安全护栏 |
| **P2（进化）** | 自动沉淀检测 + 技能建议 + 试用期机制 | 系统能建议技能 |
| **P3（生态）** | 技能测试功能 + 调试模式 + 版本管理 | 完整技能生命周期 |

---

**签名**: Cortex·架构守护者  
**日期**: 2026-04-22  
**版本**: v1.0 技能系统私有自动化引擎规范
