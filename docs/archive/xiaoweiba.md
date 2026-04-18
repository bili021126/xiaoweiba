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

| 场景         | 当前实现                           | 问题                         | 改进方向                                       |
| :----------- | :--------------------------------- | :--------------------------- | :--------------------------------------------- |
| 代码解释     | 选中代码 → 右键/命令 → Webview展示 | 割裂的交互，无法追问         | **统一对话界面，支持多轮对话和上下文追问**     |
| 代码生成     | 输入需求 → QuickPick选择操作       | 流程繁琐，缺乏灵活性         | **对话式生成，支持迭代优化和多版本对比**       |
| **代码补全** | **无**                             | **缺失核心功能**             | **行内Ghost Text补全，Tab接受，Esc取消**       |
| **统一体验** | **三个独立命令，交互割裂**         | **用户体验不一致，学习成本高** | **参考通义千问/Copilot，单一对话界面集成所有功能** |
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

### 3.2 P1（重要,按顺序实现）

| ID   | 功能           | 描述                                                         | 验收标准                       |
| :--- | :------------- | :----------------------------------------------------------- | :----------------------------- |
| F11  | 代码生成       | 根据自然语言需求或 PRD 生成代码，支持 Diff 确认后写入        | 生成代码语法正确，符合项目风格 |
| F11a | **代码补全**   | **行内智能补全，类似 GitHub Copilot，基于上下文预测下一段代码** | **补全建议准确，响应 <500ms**  |
| F11b | **统一对话界面** | **重构代码解释、代码生成、代码补全为统一的对话式交互，参考通义千问/Copilot Chat** | **支持多轮对话、上下文感知、流式响应** |
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

## 附录 A：交互架构重构计划（2026-04-15）

### A.1 背景与问题

当前实现存在以下问题：

1. **功能割裂**：代码解释、代码生成是两个独立的命令，交互流程完全不同
   - 代码解释：选中代码 → Webview 展示结果
   - 代码生成：输入需求 → QuickPick 选择操作 → 插入/创建文件
   
2. **缺少核心功能**：没有类似 GitHub Copilot 的行内代码补全功能

3. **用户体验不一致**：用户需要学习多种交互方式，无法形成统一的心智模型

4. **无法多轮对话**：每次操作都是独立的，无法基于上下文进行追问和迭代

### A.2 目标架构

参考**通义千问**和**GitHub Copilot Chat**的设计，构建统一的智能编码助手：

#### 核心特性

1. **统一对话界面**
   - 侧边栏聊天面板（类似 Copilot Chat）
   - 支持多轮对话，保留上下文历史
   - 流式响应，实时显示 AI 回复

2. **三大核心能力集成**
   - 💬 **智能对话**：自然语言问答，技术问题解答
   - 🔍 **代码解释**：选中代码后在对话中解释，支持追问
   - ✨ **代码生成**：对话中描述需求，直接生成代码
   - ⚡ **行内补全**：Ghost Text 提示，Tab 接受，Esc 取消

3. **上下文感知**
   - 自动获取当前文件、选中代码、光标位置
   - 对话历史作为上下文，支持引用之前的讨论
   - 项目指纹隔离，不同项目记忆不混淆

4. **灵活的交互方式**
   - 命令面板：`小尾巴: 打开AI助手`
   - 右键菜单："与小尾巴对话"
   - 快捷键：`Ctrl+Shift+L`（可配置）
   - 行内触发：输入时自动显示补全建议

### A.3 技术设计要点

#### 会话管理

```typescript
interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: {
    file?: string;
    language?: string;
    selectedCode?: string;
  };
  createdAt: number;
}
```

#### 消息类型

```typescript
type MessageType = 
  | 'text'           // 普通文本
  | 'code'           // 代码块
  | 'explanation'    // 代码解释
  | 'suggestion'     // 代码建议
  | 'inline_complete'; // 行内补全
```

#### 行内补全实现

- 使用 VS Code `InlineCompletionItemProvider`
- 监听用户输入，延迟 300ms 后触发补全
- 基于当前行前后文 + 文件内容 + 对话历史
- 返回 Ghost Text，用户按 Tab 接受

### A.4 实施步骤

**阶段 1：基础架构（1周）**
- [ ] 创建 `AIAssistantManager` 核心管理器
- [ ] 实现会话管理和消息历史
- [ ] 创建侧边栏 Webview 聊天界面
- [ ] 集成流式响应

**阶段 2：功能迁移（1周）**
- [ ] 将代码解释功能迁移到对话界面
- [ ] 将代码生成功能迁移到对话界面
- [ ] 保持原有命令向后兼容（deprecated 警告）

**阶段 3：代码补全（1-2周）**
- [ ] 实现 `InlineCompletionItemProvider`
- [ ] 优化补全算法和缓存策略
- [ ] 添加用户配置（启用/禁用、触发延迟）

**阶段 4：优化与测试（1周）**
- [ ] 性能优化（响应时间 <500ms for 补全）
- [ ] 用户体验测试
- [ ] 文档更新

### A.5 验收标准

1. ✅ 用户可以通过单一对话界面完成代码解释、生成、补全
2. ✅ 支持多轮对话，上下文连贯
3. ✅ 行内补全响应时间 P95 < 500ms
4. ✅ 补全准确率 > 70%（用户接受率）
5. ✅ 原有命令仍然可用（向后兼容）
6. ✅ 所有功能有完整的单元测试

### A.6 参考产品

- **GitHub Copilot Chat**：统一的对话界面，上下文感知
- **通义千问灵码**：中文优化，代码理解能力强
- **Cursor**：AI 原生编辑器，流畅的交互体验
- **Amazon Q**：企业级 AI 助手，安全可控

------

## 附录 B：统一对话式AI助手与行内补全详细设计（2026-04-15）

**文档版本**：1.0  
**发布日期**：2026-04-15  
**关联文档**：《需求开发文档》、《企业级架构设计文档》、《底层实现设计说明书》  
**状态**：已合并入主文档集

### B.1 背景与问题分析

#### B.1.1 现状

当前小尾巴已实现以下稳定功能：

- **代码解释（F01）**：右键菜单 → 独立Webview展示结果
- **代码生成（F11）**：命令面板 → 输入需求 → QuickPick选择操作
- **提交生成（F02）**：命令面板 → 生成提交信息 → 选择提交方式
- **记忆系统（F03/F04/F08/F10）**：情景记忆、偏好记忆、导出/导入、项目指纹隔离

#### B.1.2 存在的问题

| 问题 | 影响 | 严重程度 |
| :--- | :--- | :--- |
| **交互割裂**：代码解释、代码生成、提交生成使用各自独立的交互方式（右键菜单、命令面板、QuickPick），用户需记忆多种操作路径 | 学习成本高，体验不统一 | 🔴 高 |
| **无法多轮对话**：每次操作都是独立的，不能基于上一次的回答继续追问 | 无法深入解决问题 | 🔴 高 |
| **缺少行内补全**：没有类似 GitHub Copilot 的实时补全功能 | 与主流AI编程助手差距明显，无法提供即时帮助 | 🔴 高 |
| **上下文不连续**：虽然情景记忆记录了历史，但未在后续对话中自动注入 | AI 回答缺乏针对性，用户需重复提供背景 | 🟡 中 |
| **偏好记忆未使用**：PreferenceMemory 已完整实现，但未在 Prompt 中应用 | 无法利用用户习惯定制回答 | 🟡 中 |
| **性能感知差**：代码生成响应较慢，无缓存机制 | 等待时间长 | 🟡 中 |

#### B.1.3 设计目标

1. **统一交互入口**：所有AI能力集成到侧边栏聊天面板，支持多轮对话、流式响应
2. **增加行内补全**：提供 Ghost Text 实时补全，Tab 接受，Esc 取消，提升编码效率
3. **上下文智能注入**：自动融合会话历史、情景记忆、偏好记忆、当前编辑器状态，构建个性化 Prompt
4. **向后兼容**：保留原有命令，内部重定向到聊天面板并显示弃用提示
5. **高性能**：为补全和常用对话增加缓存，补全响应 P95 < 500ms
6. **跨会话回答**：在新会话中能够自动检索历史会话中的相关信息，实现记忆的连续性

### B.2 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code 扩展层                          │
├─────────────────────────────────────────────────────────────────┤
│  UI 层                                                         │
│  ├── 侧边栏聊天面板 (ChatViewProvider)                          │
│  ├── 行内补全提供器 (InlineCompletionProvider)                  │
│  ├── 原有命令兼容层 (CommandCompatLayer)                        │
│  └── 状态栏/通知                                               │
├─────────────────────────────────────────────────────────────────┤
│  会话与上下文管理层                                             │
│  ├── 会话管理器 (SessionManager)                                │
│  ├── 上下文构建器 (ContextBuilder)                              │
│  └── 提示词模板引擎 (PromptEngine)                              │
├─────────────────────────────────────────────────────────────────┤
│  核心能力层（已有，复用）                                       │
│  ├── 记忆系统 (EpisodicMemory / PreferenceMemory)              │
│  ├── LLM工具 (LLMTool)                                          │
│  ├── 安全核心 (SecurityCore / AuditLogger)                      │
│  ├── 工具适配层 (FileTool, GitTool)                            │
│  └── 配置管理 (ConfigManager)                                   │
├─────────────────────────────────────────────────────────────────┤
│  存储层（复用）                                                 │
│  ├── SQLite (记忆/偏好)                                         │
│  ├── workspaceState (会话历史)                                  │
│  └── SecretStorage (API Key)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### B.2.1 多Agent扩展预留设计

**设计原则**：当前所有设计聚焦于单Agent（统一对话助手），但通过以下方式为未来多Agent协作留出空间，**不增加当前开发成本**。

#### 1. Agent抽象接口（IAgent）

定义统一的Agent接口，当前的ChatAgent作为其中一个实现：

```typescript
interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];  // 能力标签，如 ['code-explain', 'code-generate']
  
  /**
   * 处理用户请求
   */
  handleRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse>;
  
  /**
   * 流式响应
   */
  handleStreamRequest(
    message: string,
    context: AgentContext,
    onChunk: (chunk: string) => void
  ): Promise<AgentResponse>;
}

interface AgentContext {
  sessionId: string;
  editorState?: EditorState;
  memory?: EpisodicMemory[];
  preferences?: PreferenceMemory[];
}

interface AgentResponse {
  content: string;
  metadata?: {
    agentId: string;
    usedTools?: string[];
    confidence?: number;
  };
}
```

**当前实现**：`ChatAgent implements IAgent`（统一对话助手）

**未来扩展**：
- `CodeReviewAgent`：专门负责代码审查
- `SQLAgent`：专门负责SQL优化
- `TestAgent`：专门负责测试生成
- `DocAgent`：专门负责文档生成

#### 2. Agent管理器（AgentManager）

预留Agent注册、路由和调度模块，目前仅注册一个默认Agent：

```typescript
class AgentManager {
  private agents: Map<string, IAgent> = new Map();
  private defaultAgentId: string = 'chat';
  
  /**
   * 注册Agent（当前仅注册ChatAgent）
   */
  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }
  
  /**
   * 获取Agent（当前始终返回默认Agent）
   * TODO: 未来根据用户意图或配置进行路由
   */
  getAgent(intent?: string): IAgent {
    // 当前简单实现：始终返回默认Agent
    return this.agents.get(this.defaultAgentId)!;
    
    // 未来扩展：根据intent路由到不同Agent
    // if (intent === 'sql-optimize') return this.agents.get('sql');
    // if (intent === 'code-review') return this.agents.get('review');
  }
  
  /**
   * 列出所有可用Agent
   */
  listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }
}
```

**当前状态**：仅注册`ChatAgent`，无复杂路由逻辑

**未来扩展**：
- 基于用户意图的智能路由
- 基于配置的Agent选择
- Agent负载均衡和故障转移

#### 3. 工具调用标准化（ToolAdapter）

当前`ToolAdapter`已标准化，多Agent可共享同一套工具：

```typescript
interface ITool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: any, context: ToolContext): Promise<any>;
}

// 现有工具
const tools: ITool[] = [
  new FileTool(),      // 文件读写
  new GitTool(),       // Git操作
  new DatabaseTool(),  // 数据库查询
  new LLMTool(),       // LLM调用
  // ... 更多工具
];
```

**优势**：
- ✅ 所有Agent使用统一的工具接口
- ✅ 新增工具对所有Agent立即可用
- ✅ 工具权限和审计统一管理

#### 4. 事件总线（EventBus）

已设计的事件总线可用于Agent间通信，未来多Agent协作时无需改动核心：

```typescript
class EventBus {
  private listeners: Map<string, Function[]> = new Map();
  
  /**
   * 订阅事件
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  /**
   * 发布事件
   */
  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}

// 示例：Agent间通信
eventBus.on('task.completed', (data) => {
  // CodeReviewAgent可以监听代码生成完成事件
  if (data.taskType === 'CODE_GENERATE') {
    codeReviewAgent.autoReview(data.generatedCode);
  }
});
```

**当前用途**：记录审计日志、触发记忆保存

**未来扩展**：
- Agent间任务委托
- 跨Agent上下文传递
- 工作流状态同步

#### 5. 工作流编排（SkillEngine）

`SkillEngine`中的工作流组合能力，未来可扩展为Agent协作工作流：

```typescript
interface WorkflowStep {
  agentId: string;     // 执行该步骤的Agent
  toolName?: string;   // 使用的工具
  inputMapping: Record<string, string>;  // 输入映射
  outputMapping: Record<string, string>; // 输出映射
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

// 示例：代码生成+审查工作流
const codeGenWorkflow: Workflow = {
  id: 'codegen-review',
  name: '代码生成与审查',
  steps: [
    { agentId: 'chat', toolName: 'generate_code' },
    { agentId: 'review', toolName: 'review_code' },
    { agentId: 'chat', toolName: 'apply_diff' }
  ]
};
```

**当前状态**：支持单Agent技能组合

**未来扩展**：
- 多Agent协作工作流
- 动态工作流生成（LLM规划）
- 工作流可视化和调试

### B.2.2 扩展路线图

| 阶段 | 目标 | 关键改动 |
| :--- | :--- | :--- |
| **当前（v0.1）** | 单Agent统一对话 | 仅实现ChatAgent，预留接口 |
| **v0.2** | Agent管理器基础 | 实现Agent注册和简单路由 |
| **v0.3** | 专用Agent | 增加CodeReviewAgent、SQLAgent |
| **v0.4** | Agent协作 | 实现事件总线和Agent间通信 |
| **v0.5** | 工作流编排 | 多Agent协作工作流引擎 |

### B.2.3 设计约束

为确保平滑演进，遵循以下约束：

1. **接口稳定性**：`IAgent`接口一旦定义，尽量保持不变
2. **向后兼容**：新增Agent不影响现有ChatAgent功能
3. **渐进式实现**：每个阶段只增加必要的复杂度
4. **配置驱动**：Agent路由策略通过配置文件控制，无需修改代码
5. **性能隔离**：每个Agent独立管理自己的缓存和状态，避免相互影响

------

### B.3 模块详细设计

#### B.3.1 侧边栏聊天面板（ChatViewProvider）

**职责**：
- 注册 WebviewView，提供聊天界面
- 接收用户消息，调用上下文构建器和 LLM 工具
- 流式渲染 AI 回复，支持 Markdown 和代码高亮
- 管理会话切换和新建会话

**关键接口**：

```typescript
class ChatViewProvider implements vscode.WebviewViewProvider {
  private sessionManager: SessionManager;
  private contextBuilder: ContextBuilder;
  private llmTool: LLMTool;

  async handleUserMessage(text: string, options?: { command?: string }): Promise<void>;
  private async streamResponse(messages: any[], systemPrompt: string): Promise<void>;
  private renderMessage(message: ChatMessage): string;
}
```

#### B.3.2 会话管理器（SessionManager）

**职责**：
- 管理会话列表（创建、切换、删除）
- 持久化会话和消息到 workspaceState
- 自动生成会话标题（基于第一条消息或调用 LLM）

**数据模型**：

```typescript
interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    codeBlocks?: { language: string; code: string }[];
    usedMemoryIds?: string[];
    command?: string;   // '/explain', '/generate' 等
  };
}
```

**存储位置**：workspaceState，key 为 `xiaoweiba.chatSessions`。

#### B.3.3 上下文构建器（ContextBuilder）

**职责**：
- 收集当前编辑器上下文（文件路径、语言、选中代码、光标位置）
- 获取最近 N 条会话历史（默认5条）
- 调用记忆系统检索相关情景记忆和偏好记忆
- **跨会话检索**：检索与当前问题相关的历史会话记忆
- 组装最终的消息数组和系统提示

**构建策略**：

| 信息来源 | 优先级 | 注入方式 |
| :--- | :--- | :--- |
| 当前编辑器上下文 | 最高 | 作为系统消息（`<context>` 标签） |
| 最近会话历史 | 高 | 直接作为对话消息列表的前缀 |
| 情景记忆（相关） | 中 | 作为系统消息，附上摘要 |
| 偏好记忆（匹配领域） | 中 | 作为系统消息，描述用户习惯 |
| 内置最佳实践库 | 低 | 作为后备系统消息 |

**接口**：

```typescript
class ContextBuilder {
  async build(options: {
    userMessage: string;
    includeSelectedCode?: boolean;
    maxHistory?: number;
    enableCrossSession?: boolean;  // 是否启用跨会话检索
  }): Promise<{ messages: ChatMessage[]; systemPrompt: string }>;
}
```

#### B.3.4 提示词模板引擎（PromptEngine）

**职责**：
- 根据用户意图（解释代码、生成代码、提交信息、普通问答）选择不同的提示词模板
- 支持自定义模板（用户可编辑配置文件）

**内置模板示例**：

```text
# 代码解释
你是一位资深程序员，请解释以下代码的功能、关键逻辑和潜在问题。

代码：
```{language}
{code}
```

# 代码生成
根据以下需求生成代码，只返回代码块，不要额外解释。

需求：{userInput}

# 提交信息生成
根据以下 Git diff 生成符合 Conventional Commits 规范的提交信息。

{diff}
```

#### B.3.5 行内补全提供器（InlineCompletionProvider）

**职责**：
- 注册 `InlineCompletionItemProvider`，监听用户输入
- 构建轻量级 Prompt（当前行 + 前两行 + 语言）
- 调用 LLM 获取补全建议（maxTokens=50）
- 使用 LRU 缓存避免重复请求（TTL 5秒）
- 渲染 Ghost Text，支持 Tab 接受、Esc 取消

**性能要求**：
- 触发延迟：300ms（可配置）
- 响应时间 P95 < 500ms
- 缓存命中时直接返回

**接口**：

```typescript
class AICompletionProvider implements vscode.InlineCompletionItemProvider {
  private cache: LRUCache<string, string>;
  async provideInlineCompletionItems(document, position, context, token): Promise<vscode.InlineCompletionItem[]>;
  private buildPrompt(document, position): string;
}
```

#### B.3.6 原有命令兼容层（CommandCompatLayer）

**职责**：
- 拦截原有命令（如 `xiaoweiba.explainCode`、`xiaoweiba.generateCode`、`xiaoweiba.generateCommit`）
- 显示弃用提示：“该命令已弃用，请使用侧边栏 AI 助手获得更好体验”，并提供“打开助手”按钮
- 将命令参数转换为聊天面板的内部指令（如 `/explain`、`/generate`、`/commit`），并自动打开侧边栏

**实现方式**：重写原有命令的注册，内部调用 `ChatViewProvider.handleUserMessage`。

### B.4 跨会话回答功能设计

#### B.4.1 需求背景

当前设计支持单会话内的多轮对话（通过 SessionManager 保存当前会话消息历史）。但用户在不同时间打开的新会话（例如第二天继续工作）无法自动获取之前会话中的讨论内容，导致需要重复描述背景，体验割裂。

**目标**：实现跨会话的智能回答，即在新会话中，AI 能够自动或手动检索历史会话中的相关信息，并整合到当前回答中。

#### B.4.2 设计思路

利用现有的情景记忆系统（EpisodicMemory）存储每次对话的摘要和关键实体，在新会话构建上下文时，自动检索与当前用户问题相关的历史会话记忆，并注入到 Prompt 中。同时，支持用户显式引用历史会话（如“还记得上周讨论的排序算法吗？”），系统通过语义匹配定位具体会话。

#### B.4.3 实现方案

##### 1. 数据模型扩展

在 EpisodicMemory 记录对话时，需要存储更丰富的信息，以便后续检索：

```typescript
// 扩展 EpisodicMemory 接口
interface EpisodicMemory {
  // ... 原有字段
  taskType: 'CHAT' | 'INLINE_COMPLETION' | ...;
  summary: string;           // 对话摘要（由 LLM 自动生成）
  entities: string[];        // 提取的关键实体（技术名词、函数名、项目名等）
  sessionId?: string;        // 关联的聊天会话ID（便于追溯）
  conversationId?: string;   // 跨会话的对话主题ID（可选，用于主题聚类）
}
```

##### 2. 会话摘要生成

每次对话结束后（或定期），调用 LLM 为该会话生成摘要和关键实体，并存入情景记忆。

**触发时机**：
- 用户主动结束会话（关闭侧边栏或切换会话）时
- 会话消息数超过阈值（如10条）时自动生成摘要
- 每日定时任务扫描未生成摘要的会话

**摘要生成 Prompt 示例**：

```text
请为以下对话生成一个简短的摘要（不超过50字），并提取关键实体（技术名词、函数名、项目名等，以逗号分隔）。

对话历史：
{conversationHistory}

输出格式：摘要：<摘要>\n实体：<实体1,实体2,...>
```

##### 3. 跨会话检索与注入

在 ContextBuilder 中，当用户发送新消息时，除了检索当前会话历史、编辑器上下文，还需要检索与该消息相关的历史情景记忆。

**检索步骤**：
1. 从当前用户消息中提取关键词（或使用完整消息进行向量检索，初期用关键词匹配）
2. 调用 `EpisodicMemory.search(query, { taskType: 'CHAT', limit: 3 })` 获取最相关的前3条历史会话记忆
3. 将检索到的记忆格式化后注入到系统 Prompt 中，例如：

```text
以下是你在之前对话中讨论过的相关内容，可供参考：
- [2026-04-14] 讨论过快速排序的优化，你提到可以使用三路快排。
- [2026-04-13] 询问过 React Hooks 的性能问题。
```

##### 4. 用户显式引用历史会话

用户可以通过自然语言引用历史会话，例如：“还记得上周说的那个排序算法吗？”系统需要识别这类意图。

**实现方式**：
- 在 ContextBuilder 中，检测用户消息是否包含“还记得”、“之前说过”、“上次讨论”等关键词
- 若触发，则使用更宽泛的检索条件（提高 limit、降低相似度阈值），或者调用 LLM 进行意图识别（可选，成本较高）
- 检索到相关记忆后，不仅注入 Prompt，还可以在回答中明确指出引用的历史会话时间，增强可信度

##### 5. 性能与存储优化

- 情景记忆表已为 summary 和 entities 建立 FTS5 索引，检索效率足够
- 限制每次跨会话检索最多返回 3 条记忆，避免 Prompt 过长
- 摘要生成可异步进行，不阻塞用户对话

#### B.4.4 集成到统一对话架构

在之前设计的 `ContextBuilder.build()` 方法中，增加一步：

```typescript
async build(options: BuildContextOptions) {
  const context = {
    editor: await this.getEditorContext(),
    history: this.sessionManager.getRecentMessages(5),
    memories: [] as EpisodicMemory[],
    preferences: [] as PreferenceMemory[],
  };

  // 新增：跨会话记忆检索
  if (options.enableCrossSession) {
    const query = options.userMessage;
    const relatedMemories = await this.memoryCore.search(query, {
      taskType: 'CHAT',
      limit: 3,
      sortBy: 'relevance',  // 基于关键词匹配或语义相似度
    });
    context.memories = relatedMemories;
  }

  // 偏好检索（原有）
  context.preferences = await this.preferenceMemory.getRecommendations({ ... });

  return this.buildPrompt(context);
}
```

#### B.4.5 配置扩展

```yaml
memory:
  crossSession:
    enabled: true                 # 是否启用跨会话记忆
    maxResults: 3                 # 每次检索最大返回数
    similarityThreshold: 0.6     # 相似度阈值（若使用向量）
    autoSummarize: true          # 是否自动生成会话摘要
    summaryInterval: 10          # 每多少条消息触发一次摘要生成
```

#### B.4.6 用户体验

- **用户无感知**：系统自动检索并注入历史记忆，AI 回答时自然引用
- **用户可主动提及**：“还记得我们之前讨论过的 X 吗？”系统会优先检索并强调引用
- **提供命令**：`小尾巴: 查看相关记忆`，展示当前消息关联的历史会话片段，让用户了解 AI 依据

### B.5 数据模型扩展

#### B.5.1 情景记忆任务类型新增

```typescript
type TaskType = 
  | 'CODE_EXPLAIN' | 'CODE_GENERATE' | 'TEST_GENERATE' 
  | 'SQL_OPTIMIZE' | 'NAMING_CHECK' | 'COMMIT_GENERATE'
  | 'SKILL_EXECUTE' | 'WORKFLOW_EXECUTE'
  | 'CHAT'                     // 普通对话
  | 'INLINE_COMPLETION';       // 行内补全
```

#### B.5.2 会话存储结构（workspaceState）

```json
{
  "xiaoweiba.chatSessions": [
    {
      "id": "session_001",
      "title": "解释快速排序",
      "messages": [
        {
          "id": "msg_001",
          "role": "user",
          "content": "解释一下快速排序算法",
          "timestamp": 1713200000000
        },
        {
          "id": "msg_002",
          "role": "assistant",
          "content": "快速排序是一种分治算法...",
          "timestamp": 1713200010000,
          "metadata": { "codeBlocks": [{ "language": "python",n"code": "def quicksort(arr): ..." }] }
        }
      ],
      "createdAt": 1713200000000,
      "updatedAt": 1713200010000
    }
  ],
  "xiaoweiba.currentSessionId": "session_001"
}
```

### B.6 与现有系统的集成

| 现有模块 | 集成方式 | 变更 |
| :--- | :--- | :--- |
| LLMTool | 直接调用 call / callStream | 无修改 |
| EpisodicMemory | 对话结束后调用 record（taskType='CHAT' 或 'INLINE_COMPLETION'） | 无修改 |
| PreferenceMemory | 在 ContextBuilder 中调用 getRecommendations 获取偏好 | 无修改 |
| AuditLogger | 记录对话和补全操作 | 无修改 |
| ConfigManager | 读取新增的 chat 和 inlineCompletion 配置节 | 扩展配置 |
| 原有命令 | 通过 CommandCompatLayer 重定向 | 保留，增加弃用提示 |

### B.7 配置扩展（config.yaml）

```yaml
# 新增配置节
chat:
  maxHistoryMessages: 20          # 会话保留的最大消息数
  autoGenerateTitle: true        # 自动生成会话标题
  defaultSystemPrompt: "你是一个AI编程助手，擅长解释代码、生成代码和解答技术问题。"

inlineCompletion:
  enabled: true                  # 是否启用行内补全
  triggerDelayMs: 300            # 触发延迟（毫秒）
  maxTokens: 50                  # 补全生成的最大 token 数
  enableCache: true              # 是否启用缓存
  cacheTTLSeconds: 5             # 缓存有效期（秒）

commandCompat:
  showDeprecationWarning: true   # 是否显示弃用警告
  deprecationMessage: "该命令已弃用，请使用侧边栏 AI 助手（快捷键 Ctrl+Shift+L）获得更好体验。"

memory:
  crossSession:
    enabled: true                 # 是否启用跨会话记忆
    maxResults: 3                 # 每次检索最大返回数
    similarityThreshold: 0.6     # 相似度阈值（若使用向量）
    autoSummarize: true          # 是否自动生成会话摘要
    summaryInterval: 10          # 每多少条消息触发一次摘要生成
```

### B.8 实施计划

#### B.8.1 阶段划分与工时估算

| 阶段 | 任务 | 预估工时 | 依赖 |
| :--- | :--- | :--- | :--- |
| 阶段1 | 侧边栏聊天面板基础框架（Webview、消息收发） | 4h | 无 |
| 阶段2 | 会话管理器（创建、持久化、切换） | 2h | 阶段1 |
| 阶段3 | 上下文构建器（集成记忆检索、编辑器状态） | 4h | 记忆核心 |
| 阶段4 | 代码解释、代码生成迁移到聊天面板 | 4h | 阶段1-3 |
| 阶段5 | 行内补全提供器（基础版） | 8h | LLMTool |
| 阶段6 | LLM 响应缓存（对话+补全） | 2h | LLMTool |
| 阶段7 | 原有命令兼容层 | 2h | 阶段1 |
| 阶段8 | 偏好记忆注入上下文 | 2h | PreferenceMemory |
| 阶段9 | 跨会话回答功能（摘要生成、检索） | 4h | EpisodicMemory |
| 阶段10 | 代码重构（BaseChatCommand） | 4h | 无 |
| **总计** | | **约 36 小时（4.5 个工作日）** | 可并行开发部分模块 |

#### B.8.2 里程碑

- **M1（2天）**：聊天面板可用，支持基础对话、会话持久化、代码解释和代码生成迁移
- **M2（3天）**：行内补全可用，响应时间达标，上下文注入完整
- **M3（4.5天）**：跨会话回答完成，原有命令兼容层完成，所有集成测试通过，文档更新

### B.9 风险与回退策略

| 风险 | 影响 | 应对措施 |
| :--- | :--- | :--- |
| 行内补全响应慢 | 用户体验差 | 降低触发频率、使用更小的模型、增加缓存；允许用户禁用 |
| 会话持久化数据膨胀 | workspaceState 变大 | 限制最大会话数（默认20），自动清理旧会话 |
| 原有用户习惯难以改变 | 弃用提示引起反感 | 保留旧命令至少3个月，提供配置项关闭提示 |
| LLM API 限流 | 补全和对话同时失败 | 为补全设置独立限流队列，失败时静默降级（不显示补全） |
| 跨会话检索不准确 | AI 回答引用无关历史 | 提供“查看相关记忆”命令，让用户了解引用依据；允许手动调整相似度阈值 |

### B.10 验收标准

✅ 用户可通过侧边栏聊天面板完成代码解释、代码生成、提交信息生成、普通问答

✅ 聊天面板支持多轮对话，上下文连续

✅ **跨会话回答**：在新会话中，AI 能自动检索并引用相关的历史会话记忆

✅ 行内补全在编码时自动出现，Tab 接受，Esc 取消，响应 P95 < 500ms

✅ 原有命令可用，但显示弃用提示并重定向到聊天面板

✅ 记忆系统正确记录每次对话和补全操作，包括会话摘要和关键实体

✅ 偏好记忆和情景记忆被自动注入 Prompt，影响 AI 回复

✅ 所有新增功能有单元测试和集成测试，覆盖率 >80%

### B.11 术语表

| 术语 | 解释 |
| :--- | :--- |
| 侧边栏聊天面板 | VS Code 侧边栏中的一个视图，提供统一的 AI 对话界面 |
| 行内补全 | Ghost Text 形式的代码补全，光标后显示灰色建议文字 |
| 会话管理器 | 负责创建、保存、切换聊天会话的模块 |
| 上下文构建器 | 收集编辑器状态、记忆、历史消息，组装 Prompt 的模块 |
| 原有命令兼容层 | 将旧命令调用转发到聊天面板的适配层 |
| 跨会话回答 | 在新会话中自动检索并引用历史会话记忆的能力 |
| 会话摘要 | 由 LLM 自动生成的对话内容简要总结，用于后续检索 |

------

**文档状态**：已定稿（含完整交互架构重构设计与多Agent扩展预留）
**变更记录**：
- 初版 2026-04-14
- 新增代码补全功能和统一交互架构需求 2026-04-15
- 新增附录B：统一对话式AI助手与行内补全详细设计（含跨会话回答） 2026-04-15
- 新增多Agent扩展预留设计（IAgent接口、AgentManager、EventBus等） 2026-04-15