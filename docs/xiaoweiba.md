# 文档清单

1. **小尾巴（xiaoweiba）需求开发文档** —— 功能需求、非功能需求、开发计划、测试要求
2. **小尾巴（xiaoweiba）企业级架构设计文档** —— 架构原则、模块划分、安全模型、可观测性、容错与运维
3. **小尾巴（xiaoweiba）底层实现设计说明书** —— 数据模型、数据库表结构、核心接口、错误码、算法伪代码

以下为三份文档的完整内容。

------

# 文档一：小尾巴（xiaoweiba）需求开发文档

**版本**：1.0
**发布日期**：2026-04-14
**项目名称**：小尾巴（xiaoweiba）
**项目类型**：VS Code 插件
**目标用户**：个人开发者（架构预留多租户扩展）
**关联文档**：《企业级架构设计文档》、《底层实现设计说明书》

------

## 1. 项目背景与目标

### 1.1 背景

现有 AI 编程工具（如 Copilot、Cursor）均为通用助手，无法记住用户的个人习惯、技术偏好和历史决策。开发者在日常工作中需要重复解释相同概念、反复纠正 AI 的建议，效率低下且体验割裂。

### 1.2 项目目标

打造一个以“记忆蒸馏”为内核、以“私人学徒”为形态的个人 AI 编程伴侣。具备以下能力：

- **短期**：提供主流 AI 编程工具的全部基础功能（代码解释、生成、测试、SQL 优化、提交生成等）。
- **中期**：通过情景记忆、偏好记忆、语义记忆三层架构，逐步学习用户的编程习惯，形成个性化模型。
- **长期**：从用户行为中提炼认知报告，主动提问帮助用户反思，最终实现编程人格的可导出、可迁移、可传承。

### 1.3 核心原则

| 原则                   | 说明                                                         |
| :--------------------- | :----------------------------------------------------------- |
| 半开放半封闭，安全优先 | 用户可配置模型、可编写技能，但所有操作受安全护栏约束；写入操作必须 Diff 确认 |
| 记忆为核，功能为端口   | 所有功能模块均以记忆系统为底座                               |
| 渐进式智能             | 观察 → 提炼 → 外化 → 反思                                    |
| 可解释性               | 任何建议附带依据                                             |
| 如无必要勿增实体       | 砍掉多 Agent、Skill 市场、全自动 CI、初期向量 RAG            |

------

## 2. 用户角色与使用场景

### 2.1 用户角色

- **唯一用户**：开发者本人（当前版本）。架构预留多租户字段，但初期不实现多用户管理。

### 2.2 核心使用场景

| 场景         | 描述                                                        |
| :----------- | :---------------------------------------------------------- |
| 代码解释     | 选中代码 → 右键/命令 → 获得自然语言解释                     |
| 代码生成     | 输入需求 → AI 生成代码 → Diff 确认 → 写入文件               |
| 单元测试生成 | 选中方法 → 生成测试用例（遵循项目测试框架）                 |
| SQL 优化     | 选中 SQL → 连接数据库获取执行计划 → 生成优化报告 → 应用修改 |
| 命名检查     | 检查变量/类/方法命名是否符合规范                            |
| 生成提交信息 | 分析 git diff → 生成 Conventional Commits 格式信息          |
| 技能沉淀     | 重复操作达到阈值 → 系统建议保存为技能 → 用户确认            |
| 动态工作流   | 复杂任务 → LLM 组合现有技能 → 用户确认后执行                |

------

## 3. 功能需求（按优先级）

### 3.1 P0（必须实现）

| ID   | 功能           | 描述                                                         | 验收标准                         |
| :--- | :------------- | :----------------------------------------------------------- | :------------------------------- |
| F01  | 代码解释       | 选中代码后调用 LLM 返回解释，在 Webview 中流式展示           | P95 响应 <3s，支持 Markdown 格式 |
| F02  | 生成提交信息   | 分析当前 Git 暂存区变更，生成符合 Conventional Commits 的信息 | 用户可编辑后提交                 |
| F03  | 情景记忆记录   | 每次任务完成后自动记录：时间、任务类型、摘要、涉及实体、决策、结果、权重 | 记录成功率达 99.9%               |
| F04  | 简单偏好匹配   | 记录用户显式选择（如 SQL 优化方案），下次同类任务时优先推荐  | 推荐命中率 >60%（冷启动后）      |
| F05  | 内置最佳实践库 | 预置常见编码规范、SQL 优化原则等，作为冷启动兜底             | 覆盖 10+ 常见场景                |
| F06  | 用户手写技能   | 用户创建 JSON 格式的技能文件，定义工具调用序列               | 技能可被识别、加载、执行         |
| F07  | Diff 确认      | 所有写入操作前展示 Git 风格差异对比，用户确认后才写入        | 无例外                           |
| F08  | 记忆导出/导入  | 支持将全部记忆导出为 JSON 文件（非加密），以及导入恢复       | 导出导入后数据一致               |
| F09  | 任务级授权     | 任务启动时申请最小权限（读文件、读配置、调用 LLM），用户 y/n 确认 | 授权后任务内不再重复询问         |
| F10  | 项目指纹隔离   | 基于 Git 远程 URL 和工作区路径生成项目唯一标识，记忆按项目隔离 | 不同项目记忆不串                 |

### 3.2 P1（重要，按顺序实现）

| ID   | 功能           | 描述                                                         | 验收标准                       |
| :--- | :------------- | :----------------------------------------------------------- | :----------------------------- |
| F11  | 代码生成       | 根据自然语言需求或 PRD 生成代码，支持 Diff 确认后写入        | 生成代码语法正确，符合项目风格 |
| F12  | 单元测试生成   | 为选中方法生成单元测试，自动识别测试框架（Jest、JUnit 等）   | 测试可运行且通过率 >80%        |
| F13  | SQL 优化       | 连接数据库获取 EXPLAIN，结合表结构生成优化报告，支持应用修改 | 优化建议可落地                 |
| F14  | 命名检查       | 检查当前选中命名是否符合项目规范（内置 + 用户自定义）        | 高亮不规范命名，提供修正建议   |
| F15  | 沉淀技能建议   | 检测重复操作模式（程序记忆累积分数超阈值），弹窗建议保存为技能 | 建议准确率 >70%                |
| F16  | 技能试用期     | 新生成的技能默认每次询问是否使用，连续 5 次采纳后自动应用    | 用户可随时终止试用             |
| F17  | 动态工作流组合 | 用户输入复杂任务，LLM 根据本地技能摘要生成执行计划（技能数 ≤5） | 计划合理，执行成功             |
| F18  | 多模型支持     | 配置文件支持多个 LLM 提供商，用户手动切换                    | 切换后新调用使用新模型         |
| F19  | 公司标准集成   | 用户指定本地标准文件（Markdown/YAML），系统优先采用其规则    | 标准内规则优先级最高           |

### 3.3 P2（实验性，默认关闭）

| ID   | 功能               | 描述                                                     | 开关                         |
| :--- | :----------------- | :------------------------------------------------------- | :--------------------------- |
| F20  | 网络搜索归纳       | 根据任务关键词搜索网络，归纳最佳实践                     | 默认关闭，需用户开启网络权限 |
| F21  | 模型自总结最佳实践 | 每次任务实时调用 LLM 总结最佳实践（消耗 token）          | 默认关闭                     |
| F22  | 多源仲裁           | 公司标准、模型总结、网络搜索冲突时自动仲裁               | 默认关闭，用户手动选择       |
| F23  | 自动多模型迁移     | 切换模型时自动重新索引记忆                               | 默认关闭，需用户确认         |
| F24  | 认知报告           | 每月生成用户行为分析报告（偏好统计、技能使用、改进建议） | 默认关闭                     |

------

## 4. 非功能需求

### 4.1 性能要求

| 指标                | 目标值 |
| :------------------ | :----- |
| 插件激活时间        | <300ms |
| 代码解释响应（P95） | <3s    |
| 记忆检索延迟（P99） | <100ms |
| 技能执行启动延迟    | <500ms |
| 内存占用（空闲）    | <100MB |
| 内存占用（峰值）    | <500MB |

### 4.2 安全要求

| 要求       | 描述                                                         |
| :--------- | :----------------------------------------------------------- |
| 数据本地化 | 所有配置、记忆、技能存储于用户本地，不上传任何云端（除用户配置的 LLM API） |
| 密钥加密   | API Key 使用 VS Code SecretStorage 加密                      |
| 脱敏       | 发送给 LLM 的内容自动脱敏（密码、令牌等）                    |
| 审计日志   | 所有敏感操作记录到加密日志，保留 30 天                       |
| 路径沙箱   | 文件写入仅限工作区内源码目录，禁止写入 .env、密钥文件        |
| 命令白名单 | 默认禁止网络命令、sudo、rm -rf，需用户显式授权               |

### 4.3 可靠性要求

| 要求       | 描述                                            |
| :--------- | :---------------------------------------------- |
| 任务持久化 | 长时间任务（>30秒）状态持久化，插件崩溃后可恢复 |
| 数据库备份 | SQLite 数据库每日自动备份，保留最近 7 天        |
| 配置回滚   | 配置错误时自动回退到最近有效配置                |
| 技能原子性 | 可选事务模式：技能失败时自动 Git 回滚           |

### 4.4 可维护性要求

| 要求           | 描述                                 |
| :------------- | :----------------------------------- |
| 模块化         | 核心模块通过接口隔离，依赖注入       |
| 单元测试覆盖率 | >80%                                 |
| 集成测试       | 关键流程端到端测试                   |
| 错误码         | 结构化错误码，用户友好提示           |
| 日志           | 结构化日志（pino），支持动态级别调整 |

------

## 5. 开发计划

### 5.1 阶段划分与周期

| 阶段  | 内容                                                         | 周期 | 交付物                               |
| :---- | :----------------------------------------------------------- | :--- | :----------------------------------- |
| 阶段0 | 基础架构（配置管理、审计日志、错误处理、SQLite 封装、测试框架） | 2周  | 可运行的空插件，配置热加载，日志加密 |
| 阶段1 | 核心功能（代码解释、提交生成、情景记忆记录、基础偏好匹配）   | 3周  | 三个命令可用，记忆可记录和检索       |
| 阶段2 | 安全与存储（任务级授权、Diff 确认、记忆导出/导入、项目指纹） | 2周  | 所有写入操作需确认，记忆可迁移       |
| 阶段3 | 技能系统（手写技能、执行引擎、沉淀技能建议、试用期）         | 4周  | 用户可编写技能，系统可建议沉淀       |
| 阶段4 | 高级特性（动态工作流、多模型支持、公司标准集成）             | 3周  | 复杂任务自动组合技能                 |
| 阶段5 | 实验性功能（按需实现 P2）                                    | 按需 | 默认关闭的功能                       |

**总计核心阶段**：14 周（约 3.5 个月）

### 5.2 依赖与里程碑

| 里程碑 | 时间     | 关键交付                             |
| :----- | :------- | :----------------------------------- |
| M0     | 第2周末  | 基础架构就绪，单元测试通过           |
| M1     | 第5周末  | 代码解释和提交生成可用，记忆记录正常 |
| M2     | 第7周末  | 安全授权完善，记忆可导出导入         |
| M3     | 第11周末 | 技能系统完整，用户可编写技能         |
| M4     | 第14周末 | 动态工作流可用，多模型支持           |

------

## 6. 测试要求

### 6.1 单元测试

- 框架：Jest
- 覆盖率要求：>80%
- 必须覆盖的模块：记忆核心算法、安全授权逻辑、技能解析器、工具白名单校验

### 6.2 集成测试

- 框架：vscode-test
- 场景：代码解释、提交生成、技能执行、工作流组合
- 使用录制回放 mock LLM 响应

### 6.3 性能基准测试

- 在 CI 中运行，测量记忆检索延迟（1000 条记忆）
- 与基线对比，超过 10% 退化则告警

### 6.4 安全测试

- 路径遍历攻击测试（尝试读取工作区外文件）
- 命令注入测试（尝试绕过白名单）
- 技能恶意步骤检测

------

## 7. 配置示例

yaml

```
# ~/.xiaoweiba/config.yaml
mode: private  # private | general

model:
  default: deepseek
  providers:
    - id: deepseek
      apiUrl: https://api.deepseek.com/v1
      apiKey: ${env:DEEPSEEK_API_KEY}
      maxTokens: 4096
      temperature: 0.6
    - id: ollama
      apiUrl: http://localhost:11434/v1
      maxTokens: 2048

security:
  trustLevel: moderate
  autoApproveRead: true
  requireDiffForWrite: true
  gitPushEnabled: false

memory:
  retentionDays: 90
  decayLambda: 0.01
  coldStartTrust: 20

skill:
  userDir: .xiaoweiba/skills/user
  autoDir: .xiaoweiba/skills/auto
  maxWorkflowDepth: 5
  trialPeriod: 5

audit:
  level: detailed
  maxFileSizeMB: 20
  maxFiles: 10

bestPractice:
  sources: ["builtin"]
  builtinOnly: true
```



------

## 8. 风险与应对

| 风险                         | 概率 | 影响 | 应对措施                              |
| :--------------------------- | :--- | :--- | :------------------------------------ |
| LLM API 不稳定或限流         | 中   | 高   | 实现重试+降级（返回最佳实践）         |
| 记忆数据库性能下降           | 低   | 中   | 定期清理低价值记忆，支持分页加载      |
| 技能执行导致项目损坏         | 低   | 高   | 提供 Git 检查点回滚，默认禁用危险工具 |
| 用户拒绝授权导致任务无法完成 | 中   | 低   | 提供降级方案（只读分析，不写入）      |
| 跨平台路径兼容性问题         | 低   | 中   | 使用 Node.js path 模块统一处理        |

------

**文档状态**：已定稿
**变更记录**：初版 2026-04-14

------

# 文档二：小尾巴（xiaoweiba）企业级架构设计文档

**版本**：1.0
**发布日期**：2026-04-14
**适用范围**：系统架构设计、模块划分、安全模型、可观测性、容错与运维
**关联文档**：《需求开发文档》、《底层实现设计说明书》

------

## 1. 架构总览

### 1.1 架构图（文字描述）

text

```
┌─────────────────────────────────────────────────────────┐
│                     UI 层                               │
│  命令注册  │  Webview 面板  │  状态栏  │  Diff 视图    │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                   核心服务层                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │记忆核心  │ │安全核心  │ │技能引擎  │ │事件总线  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                   工具适配层                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │文件工具  │ │ Git工具  │ │ Shell工具│ │数据库工具│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐                                          │
│  │ LLM工具  │                                          │
│  └──────────┘                                          │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                    存储层                               │
│  SQLite  │  globalState  │  SecretStorage  │  文件系统 │
└─────────────────────────────────────────────────────────┘
```



### 1.2 模块职责

| 模块           | 职责                                                         |
| :------------- | :----------------------------------------------------------- |
| **记忆核心**   | 管理情景记忆、偏好记忆、语义记忆、程序记忆的存储、检索、衰减、归档 |
| **安全核心**   | 任务级授权、动态权限升级、参数白名单校验、审计日志记录       |
| **技能引擎**   | 加载技能定义、解析依赖、执行步骤、管理工作流组合             |
| **事件总线**   | 模块间异步通信，支持发布/订阅，事件持久化（关键事件）        |
| **工具适配层** | 封装 VS Code 原生能力（文件、Git、终端、数据库、LLM），提供统一接口 |
| **配置管理**   | 加载 YAML 配置，支持热加载、环境变量覆盖、备份回滚           |
| **审计日志**   | 加密存储操作记录，防篡改，支持轮转和导出                     |

------

## 2. 架构必须（企业级底线）

以下设计无论功能如何裁剪，**必须实现**，否则不具备企业级质量。

| 分类           | 强制要求                                        |
| :------------- | :---------------------------------------------- |
| **模块化**     | 接口与实现分离，依赖注入（如 tsyringe）         |
| **配置管理**   | YAML + 环境变量 + 热加载 + 备份回滚             |
| **审计日志**   | 加密存储、HMAC防篡改、轮转、可导出              |
| **授权模型**   | 任务级令牌、最小权限、动态升级                  |
| **参数白名单** | 路径 glob 模式、命令黑名单+白名单               |
| **数据隔离**   | 项目指纹（Git 远程哈希 + 路径），多项目记忆不串 |
| **错误处理**   | 结构化错误码、用户友好提示                      |
| **可观测性**   | 健康检查端点、关键指标暴露                      |
| **持久化**     | 任务状态持久化、数据库备份、回滚机制            |
| **测试**       | 单元测试覆盖率 >80%，集成测试，CI 强制          |

------

## 3. 安全架构

### 3.1 授权模型

json

```
{
  "任务令牌": {
    "生命周期": "任务启动时创建，任务结束/超时销毁",
    "存储": "内存 + 加密持久化（用于恢复）",
    "权限": "最小权限集（初始只读）",
    "动态升级": "任务执行中可申请额外权限，用户确认后令牌扩展"
  },
  "权限类型": [
    "read:file", "write:file", "execute:command",
    "read:database", "write:database", "call:llm", "git:commit"
  ],
  "授权交互": "终端风格 y/n 确认，超时自动拒绝（60秒）"
}
```



### 3.2 参数白名单

| 工具       | 限制规则                                                     |
| :--------- | :----------------------------------------------------------- |
| 写文件     | 仅允许 `<workspace>/src/**`, `<workspace>/test/**`；禁止 `**/.env`, `**/secrets/**` |
| 执行命令   | 仅允许在工作区根目录；禁止 `sudo`, `rm -rf`, `curl`, `wget`（除非显式授权网络） |
| 数据库查询 | 只读连接（默认），DDL 需单独授权                             |

实现方式：使用 `glob` 模式匹配，路径先 `fs.realpath` 解析，防止符号链接绕过。

### 3.3 审计日志

json

```
{
  "内容": "timestamp, sessionId, operation, result, durationMs, parametersHash, filePath, hmacSignature",
  "加密": "AES-256-GCM，密钥存储在系统密钥环",
  "轮转": "单文件最大 20MB，保留最近 10 个",
  "防篡改": "每条日志附带 HMAC 签名",
  "级别": {
    "error": "仅错误",
    "info": "操作摘要（默认）",
    "debug": "详细参数（哈希化），需用户开启"
  }
}
```



### 3.4 数据本地化与隐私

- 所有配置、记忆、技能文件存储在用户本地 `~/.xiaoweiba/`
- API Key 使用 VS Code `SecretStorage`，不写入配置文件
- 发送给 LLM 的内容自动脱敏（正则匹配密码、令牌等）

------

## 4. 可观测性设计

### 4.1 健康检查

插件提供内部 `getHealthStatus()` 返回：

json

```
{
  "status": "healthy" | "degraded" | "unhealthy",
  "modules": {
    "memory": { "status": "up", "lastError": null },
    "llm": { "status": "up", "latencyMs": 120 }
  },
  "version": "1.0.0"
}
```



### 4.2 关键指标（Metrics）

| 指标                                     | 类型      | 说明           |
| :--------------------------------------- | :-------- | :------------- |
| `xiaoweiba_task_duration_ms`             | Histogram | 任务耗时分布   |
| `xiaoweiba_memory_retrieve_latency_ms`   | Histogram | 记忆检索延迟   |
| `xiaoweiba_llm_call_success_rate`        | Gauge     | LLM 调用成功率 |
| `xiaoweiba_skill_execution_success_rate` | Gauge     | 技能执行成功率 |
| `xiaoweiba_memory_count`                 | Gauge     | 当前记忆总数   |

导出方式：支持 Prometheus 格式（可选），用户可配置导出到文件或 HTTP 端点。

### 4.3 结构化日志

- 使用 `pino` 库，输出 JSON 格式
- 日志级别：`error`, `warn`, `info`, `debug`
- 生产环境默认 `info`，调试时可动态调整为 `debug`

------

## 5. 可靠性设计

### 5.1 任务持久化与恢复

- 任何预计执行时间 >30 秒的任务，每完成一个步骤将状态保存到 `task_state` 表
- 状态包括：任务 ID、当前步骤索引、各步骤输出（序列化）
- 插件崩溃或 VS Code 重启后，检测到未完成任务，弹窗询问是否继续
- 继续执行时从持久化状态恢复，跳过已完成步骤

### 5.2 数据库备份与修复

- 每日凌晨自动备份 SQLite 数据库到 `~/.xiaoweiba/backups/memory_<date>.db`
- 保留最近 7 天备份
- 提供命令 `xiaoweiba.repair-memory`，执行 `PRAGMA integrity_check`，若损坏则从最新备份恢复

### 5.3 配置回滚

- 修改配置时，先备份当前配置为 `config.yaml.bak`
- 若新配置解析失败（YAML 语法错误、字段类型错误），自动回滚到备份并提示用户
- 保留最近 3 份有效配置的历史

### 5.4 技能原子性（可选事务模式）

- 技能定义中可设置 `atomic: true`
- 执行前：
  - 若项目使用 Git，创建临时分支或 stash 作为检查点
  - 记录所有将要写入的文件路径
- 执行中任何步骤失败：
  - 自动执行 `git checkout` 恢复文件，删除临时分支
  - 若未使用 Git，则从临时目录复制回原文件
- 用户可选择关闭此功能以提升性能

------

## 6. 并发与资源管理

### 6.1 任务队列

- 全局任务队列，最大并发数可配置（默认 1，顺序执行）
- 技能可声明资源需求（`cpu: low|medium|high`, `memory: <MB>`），调度器根据当前负载排队
- 提供“强制并行”选项（高级用户），需确认风险

### 6.2 数据库并发

- SQLite 使用 WAL 模式（Write-Ahead Logging），提高读写并发
- 写操作排队，读操作可并发
- 使用 `better-sqlqlite3` 的事务 API 保证批量写入原子性

### 6.3 内存限制

- 记忆检索默认最多返回 20 条，避免一次性加载过多
- 技能执行时限制 LLM 调用次数（默认每技能 ≤5 次调用）
- 大型文件读取（>1MB）时提示用户确认

------

## 7. 多租户预留（未来扩展）

虽然当前版本仅服务单用户，但架构中预留多租户字段：

- 所有存储表增加 `user_id` 字段（默认 `'single'`）
- 配置目录结构：`~/.xiaoweiba/users/<user_id>/`
- 审计日志包含 `user_id` 字段
- 授权令牌包含 `user_id`，防止跨用户伪造

------

## 8. 架构决策记录（ADR）示例

| ID      | 标题                   | 状态   | 决策                          | 后果                               |
| :------ | :--------------------- | :----- | :---------------------------- | :--------------------------------- |
| ADR-001 | 记忆存储选型           | 已采纳 | 使用 SQLite + FTS5            | 支持全文检索，轻量级，无需额外服务 |
| ADR-002 | 任务级授权 vs 每次确认 | 已采纳 | 任务级令牌 + 动态升级         | 减少弹窗，同时保持安全             |
| ADR-003 | 技能定义格式           | 已采纳 | JSON 步骤序列，无逻辑         | 可静态分析，防止恶意代码           |
| ADR-004 | 日志加密方案           | 已采纳 | AES-256-GCM + HMAC            | 保证机密性和完整性                 |
| ADR-005 | 多租户预留             | 暂缓   | 添加 user_id 字段但不实现逻辑 | 未来可低成本扩展                   |

------

**文档状态**：已定稿
**变更记录**：初版 2026-04-14

------

# 文档三：小尾巴（xiaoweiba）底层实现设计说明书

**版本**：1.0
**发布日期**：2026-04-14
**适用范围**：数据模型、数据库表结构、核心接口、错误码、算法伪代码
**关联文档**：《需求开发文档》、《企业级架构设计文档》

------

## 1. 数据模型（TypeScript 接口）

### 1.1 情景记忆

typescript

```
interface EpisodicMemory {
  id: string;                    // 格式 ep_<timestamp>_<random>
  projectFingerprint: string;
  timestamp: number;             // Unix ms
  taskType: TaskType;
  summary: string;               // ≤200字
  entities: string[];            // 关键词数组
  decision?: string;
  outcome: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  finalWeight: number;           // 0-10
  modelId: string;
  durationMs: number;
  metadata?: Record<string, any>;
}

type TaskType = 
  | 'CODE_EXPLAIN' | 'CODE_GENERATE' | 'TEST_GENERATE' 
  | 'SQL_OPTIMIZE' | 'NAMING_CHECK' | 'COMMIT_GENERATE'
  | 'SKILL_EXECUTE' | 'WORKFLOW_EXECUTE';
```



### 1.2 偏好记忆

typescript

```
interface PreferenceMemory {
  id: string;
  domain: 'NAMING' | 'SQL_STRATEGY' | 'TEST_STYLE' | 'COMMIT_STYLE' | 'CODE_PATTERN';
  pattern: Record<string, any>;  // 如 { namingStyle: 'camelCase' }
  confidence: number;            // 0-1
  sampleCount: number;
  lastUpdated: number;
  modelId?: string;              // 空表示通用
  projectFingerprint?: string;   // 空表示全局
}
```



### 1.3 程序记忆（用于技能沉淀）

typescript

```
interface ProceduralMemory {
  id: string;
  projectFingerprint?: string;
  patternHash: string;           // SHA256 操作序列
  patternDescription: string;
  cumulativeScore: number;
  occurrenceCount: number;
  lastOccurrence: number;
  suggestedAsSkill: boolean;
  skillFilePath?: string;
}
```



### 1.4 技能定义

typescript

```
interface SkillDefinition {
  name: string;
  description: string;
  version: string;
  source: 'user' | 'auto';
  projectScoped: boolean;
  dependencies?: string[];
  tools: ToolType[];
  inputs?: SkillInput[];
  steps: SkillStep[];
  tests?: SkillTest[];
  atomic?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SkillStep {
  id: string;
  tool: ToolType;
  params: Record<string, any>;   // 支持 {{var}} 模板
  outputAs?: string;
  condition?: 'always' | 'onError';
}

type ToolType = 
  | 'read_file' | 'write_file' | 'call_llm' 
  | 'show_diff' | 'execute_sql' | 'execute_command' | 'git_commit';
```



### 1.5 任务令牌

typescript

```
interface TaskToken {
  taskId: string;
  grantedOps: Set<Permission>;
  resourceConstraints: Map<Permission, string[]>; // glob 模式
  expiresAt: number;
  createdAt: number;
  taskType: TaskType;
  projectFingerprint: string;
  userId: string;                // 多租户预留
}

type Permission = 
  | 'read:file' | 'write:file' | 'execute:command'
  | 'read:database' | 'write:database' | 'call:llm' | 'git:commit';
```



------

## 2. 数据库表结构（SQLite）

### 2.1 情景记忆表

sql

```
CREATE TABLE episodic_memory (
    id TEXT PRIMARY KEY,
    project_fingerprint TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    entities TEXT,                     -- 空格分隔的关键词
    decision TEXT,
    outcome TEXT NOT NULL,
    final_weight REAL NOT NULL,
    model_id TEXT NOT NULL,
    duration_ms INTEGER,
    metadata TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_episodic_project ON episodic_memory(project_fingerprint);
CREATE INDEX idx_episodic_timestamp ON episodic_memory(timestamp);
CREATE INDEX idx_episodic_task_type ON episodic_memory(task_type);

CREATE VIRTUAL TABLE episodic_memory_fts USING fts5(
    summary, entities, decision,
    content=episodic_memory,
    content_rowid=rowid
);
```



### 2.2 偏好记忆表

sql

```
CREATE TABLE preference_memory (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    pattern TEXT NOT NULL,
    confidence REAL NOT NULL,
    sample_count INTEGER NOT NULL,
    last_updated INTEGER NOT NULL,
    model_id TEXT,
    project_fingerprint TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_preference_domain ON preference_memory(domain);
CREATE INDEX idx_preference_project ON preference_memory(project_fingerprint);
```



### 2.3 程序记忆表

sql

```
CREATE TABLE procedural_memory (
    id TEXT PRIMARY KEY,
    project_fingerprint TEXT,
    pattern_hash TEXT NOT NULL,
    pattern_description TEXT,
    cumulative_score REAL DEFAULT 0,
    occurrence_count INTEGER DEFAULT 1,
    last_occurrence INTEGER,
    suggested_as_skill BOOLEAN DEFAULT 0,
    skill_file_path TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_procedural_pattern ON procedural_memory(pattern_hash);
```



### 2.4 审计日志表（加密存储）

sql

```
-- 实际使用 SQLCipher 或应用层加密
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    user_id TEXT DEFAULT 'single',
    session_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    result TEXT NOT NULL,
    duration_ms INTEGER,
    parameters_hash TEXT,
    file_path TEXT,
    model_id TEXT,
    hmac_signature TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```



### 2.5 任务状态表

sql

```
CREATE TABLE task_state (
    task_id TEXT PRIMARY KEY,
    project_fingerprint TEXT NOT NULL,
    token TEXT NOT NULL,               -- 加密令牌
    current_step INTEGER DEFAULT 0,
    step_states TEXT,                  -- JSON 数组
    created_at INTEGER,
    updated_at INTEGER
);
```



------

## 3. 核心接口（TypeScript）

### 3.1 记忆核心

typescript

```
interface IMemoryCore {
  recordEpisodic(event: TaskCompletedEvent): Promise<Result<void>>;
  recordPreference(event: UserPreferenceObservedEvent): Promise<Result<void>>;
  recordProcedural(pattern: ProceduralPattern): Promise<Result<void>>;
  retrieve(query: string, options?: RetrieveOptions): Promise<MemoryContext>;
  decayAndArchive(): Promise<Result<void>>;
  export(encryptionKey?: string): Promise<Result<Uint8Array>>;
  import(data: Uint8Array, encryptionKey?: string): Promise<Result<void>>;
  getStats(projectFingerprint?: string): Promise<MemoryStats>;
}

interface RetrieveOptions {
  taskType?: TaskType;
  maxResults?: number;
  includeGlobal?: boolean;
}

interface MemoryContext {
  relevantEpisodes: EpisodicMemory[];
  relevantPreferences: PreferenceMemory[];
  summary: string;
}
```



### 3.2 安全核心

typescript

```
interface ISecurityCore {
  startTask(taskId: string, taskType: TaskType, projectFingerprint: string): Promise<Result<TaskToken>>;
  checkPermission(token: TaskToken, permission: Permission, resource?: string): Promise<boolean>;
  requestUpgrade(token: TaskToken, newPermission: Permission, reason: string): Promise<Result<TaskToken>>;
  endTask(taskId: string): Promise<void>;
  log(entry: Omit<AuditEntry, 'timestamp' | 'sessionId'>): Promise<void>;
  getTrustLevel(): TrustLevel;
  setTrustLevel(level: TrustLevel): Promise<void>;
}

type AuthorizationResult = 
  | { allowed: true }
  | { allowed: false; reason: string; requireConfirm?: boolean };
```



### 3.3 技能引擎

typescript

```
interface ISkillEngine {
  loadSkill(name: string, projectFingerprint?: string): Promise<Result<SkillDefinition>>;
  listSkills(projectFingerprint?: string): Promise<SkillDefinition[]>;
  execute(skill: SkillDefinition, inputs: Record<string, any>, options?: ExecuteOptions): Promise<Result<SkillResult>>;
  planWorkflow(userIntent: string, projectFingerprint?: string): Promise<Result<WorkflowPlan>>;
  executeWorkflow(plan: WorkflowPlan, inputs: Record<string, any>): Promise<Result<WorkflowResult>>;
  suggestSkillFromProcedural(projectFingerprint?: string): Promise<SkillSuggestion | null>;
  saveSkill(skill: SkillDefinition): Promise<Result<void>>;
  deleteSkill(name: string, source: 'user' | 'auto'): Promise<Result<void>>;
  testSkill(skill: SkillDefinition): Promise<TestReport>;
}

interface ExecuteOptions {
  dryRun?: boolean;
  timeoutMs?: number;
  onStep?: (step: SkillStep, output: any) => void;
}
```



### 3.4 工具适配层

typescript

```
interface IToolAdapter {
  file: IFileTool;
  git: IGitTool;
  shell: IShellTool;
  database: IDatabaseTool;
  llm: ILLMTool;
}

interface IFileTool {
  read(path: string, options?: { encoding?: string; range?: [number, number] }): Promise<Result<string>>;
  write(path: string, content: string, confirm?: WriteConfirm): Promise<Result<void>>;
  exists(path: string): Promise<boolean>;
  resolvePath(relativePath: string): string;
}

interface IGitTool {
  getDiff(staged?: boolean): Promise<Result<string>>;
  commit(message: string, files?: string[]): Promise<Result<string>>;
  getCurrentBranch(): Promise<Result<string>>;
  createCheckpoint(name: string): Promise<Result<string>>;
  restoreCheckpoint(name: string): Promise<Result<void>>;
}

interface IShellTool {
  exec(command: string, options?: { cwd?: string; timeout?: number }): Promise<Result<{ stdout: string; stderr: string }>>;
  isAllowed(command: string): boolean;
}
```



------

## 4. 错误码完整列表

| 错误码  | 名称                      | 说明           |
| :------ | :------------------------ | :------------- |
| XW-1000 | UNKNOWN                   | 未知错误       |
| XW-1001 | NOT_IMPLEMENTED           | 功能未实现     |
| XW-1002 | TIMEOUT                   | 操作超时       |
| XW-1003 | CANCELLED                 | 用户取消       |
| XW-2001 | UNAUTHORIZED              | 未授权         |
| XW-2002 | PERMISSION_DENIED         | 权限不足       |
| XW-2003 | TOKEN_EXPIRED             | 令牌过期       |
| XW-2004 | TOKEN_INVALID             | 令牌无效       |
| XW-3001 | MEMORY_NOT_FOUND          | 记忆未找到     |
| XW-3002 | MEMORY_STORAGE_ERROR      | 存储失败       |
| XW-3003 | MEMORY_RETRIEVAL_ERROR    | 检索失败       |
| XW-4001 | SKILL_NOT_FOUND           | 技能不存在     |
| XW-4002 | SKILL_INVALID_FORMAT      | 技能格式错误   |
| XW-4003 | SKILL_CIRCULAR_DEPENDENCY | 循环依赖       |
| XW-4004 | SKILL_STEP_FAILED         | 步骤执行失败   |
| XW-4005 | SKILL_TIMEOUT             | 技能执行超时   |
| XW-5001 | FILE_NOT_FOUND            | 文件不存在     |
| XW-5002 | FILE_WRITE_ERROR          | 文件写入失败   |
| XW-5003 | COMMAND_FAILED            | 命令执行失败   |
| XW-5004 | DATABASE_ERROR            | 数据库错误     |
| XW-6001 | LLM_ERROR                 | LLM 调用失败   |
| XW-6002 | LLM_RATE_LIMIT            | 限流           |
| XW-6003 | LLM_CONTEXT_OVERFLOW      | 上下文溢出     |
| XW-7001 | CONFIG_INVALID            | 配置无效       |
| XW-7002 | CONFIG_NOT_FOUND          | 配置文件不存在 |

------

## 5. 关键算法伪代码

### 5.1 记忆检索排序

typescript

```
function rankMemories(query: string, memories: EpisodicMemory[]): EpisodicMemory[] {
  const queryKeywords = extractKeywords(query);
  const now = Date.now();
  
  return memories.map(m => {
    const keywordScore = jaccardSimilarity(queryKeywords, m.entities);
    const timeScore = Math.exp(-0.01 * (now - m.timestamp) / (1000 * 86400));
    const weightScore = Math.min(m.finalWeight / 10, 1);
    const totalScore = keywordScore * 0.5 + timeScore * 0.3 + weightScore * 0.2;
    return { ...m, _score: totalScore };
  }).sort((a,b) => b._score - a._score).slice(0, 5);
}
```



### 5.2 权重计算（简化企业版）

typescript

```
function computeFinalWeight(task: TaskEvent): number {
  let base = 0;
  if (task.userEmphasis) base += 5;
  if (task.isProductionRisk) base += 3;
  if (task.isDDL) base += 2;
  base += Math.min(task.tableCount * 0.5, 3);
  base += Math.min(task.transactionComplexity, 5);
  
  const trust = Math.min(1, totalHistoryCount / 20);  // 冷启动保护
  return Math.min(base * trust, 10);
}
```



### 5.3 技能沉淀触发条件

typescript

```
function shouldSuggestSkill(procedural: ProceduralMemory, weeklyOps: number): boolean {
  const minThreshold = Math.max(6, weeklyOps * 0.5);
  return procedural.cumulativeScore >= minThreshold && !procedural.suggestedAsSkill;
}
```



### 5.4 路径沙箱校验

typescript

```
function isPathAllowed(requestPath: string, allowedGlobs: string[], forbiddenGlobs: string[]): boolean {
  const realPath = fs.realpathSync(requestPath);
  const allowed = allowedGlobs.some(g => minimatch(realPath, g));
  const forbidden = forbiddenGlobs.some(g => minimatch(realPath, g));
  return allowed && !forbidden;
}
```



------

## 6. 扩展点与留置设计

### 6.1 事件钩子（Hook）

typescript

```
interface IHookable {
  registerHook(hookPoint: HookPoint, handler: HookHandler): void;
}

type HookPoint = 
  | 'before:memory:retrieve'
  | 'after:memory:record'
  | 'before:skill:execute'
  | 'after:skill:execute'
  | 'before:tool:write_file';
```



### 6.2 自定义工具注册

typescript

```
interface IToolRegistry {
  registerTool(name: string, tool: CustomTool): void;
  getTool(name: string): CustomTool | undefined;
}

interface CustomTool {
  execute(params: any, context: ToolContext): Promise<Result<any>>;
  getPermission(): Permission;
  getParameterSchema(): JSONSchema;
}
```



### 6.3 存储迁移机制

- 迁移脚本存放于 `src/storage/migrations/`
- 文件命名：`<version>_<description>.ts`
- 启动时自动执行未迁移的版本，记录到 `migration_history` 表

------

**文档状态**：已定稿
**变更记录**：初版 2026-04-14