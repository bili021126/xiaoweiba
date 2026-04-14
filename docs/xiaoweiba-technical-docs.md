# 小尾巴（xiaoweiba）VS Code 插件实施计划

## Context

本项目旨在开发一个以"记忆蒸馏"为内核的个人 AI 编程伴侣 VS Code 插件。现有代码库为空目录，需要从零开始构建完整的插件架构。核心差异化能力是通过情景记忆、偏好记忆、语义记忆三层架构学习用户编程习惯，形成个性化模型。

**关键约束：**
- 数据本地化：所有配置、记忆、技能存储于用户本地
- 安全优先：写入操作必须 Diff 确认，任务级授权机制
- 记忆为核：所有功能模块均以记忆系统为底座
- 单用户架构但预留多租户扩展字段

## 技术栈

- **语言**: TypeScript
- **测试框架**: Jest (单元测试覆盖率 >80%) + vscode-test (集成测试)
- **数据库**: better-sqlite3 (SQLite + FTS5)
- **日志**: pino (结构化日志)
- **依赖注入**: tsyringe
- **配置**: YAML (js-yaml)
- **加密**: Node.js crypto (AES-256-GCM)
- **LLM**: DeepSeek API (默认) + Ollama (可选)

## 项目结构

```
xiaoweiba/
├── .vscode/                    # VS Code 调试配置
│   ├── launch.json
│   └── tasks.json
├── src/
│   ├── extension.ts            # 插件入口
│   ├── commands/               # 命令注册
│   │   ├── explainCode.ts
│   │   ├── generateCommit.ts
│   │   ├── checkNaming.ts
│   │   ├── optimizeSQL.ts
│   │   └── index.ts
│   ├── core/                   # 核心服务层
│   │   ├── memory/             # 记忆核心
│   │   │   ├── MemoryCore.ts
│   │   │   ├── EpisodicMemory.ts
│   │   │   ├── PreferenceMemory.ts
│   │   │   ├── ProceduralMemory.ts
│   │   │   └── SemanticMemory.ts
│   │   ├── security/           # 安全核心
│   │   │   ├── Authorization.ts
│   │   │   ├── ParameterWhitelist.ts
│   │   │   └── AuditLogger.ts
│   │   ├── skill/              # 技能引擎
│   │   │   ├── SkillEngine.ts
│   │   │   ├── SkillLoader.ts
│   │   │   ├── SkillExecutor.ts
│   │   │   └── WorkflowComposer.ts
│   │   ├── EventBus.ts         # 事件总线
│   │   └── HealthCheck.ts      # 健康检查
│   ├── tools/                  # 工具适配层
│   │   ├── FileTool.ts
│   │   ├── GitTool.ts
│   │   ├── ShellTool.ts
│   │   ├── DatabaseTool.ts
│   │   ├── LLMTool.ts
│   │   └── interfaces.ts
│   ├── storage/                # 存储层
│   │   ├── DatabaseManager.ts
│   │   ├── ConfigManager.ts
│   │   └── SecretStorage.ts
│   ├── ui/                     # UI 层
│   │   ├── WebviewPanel.ts
│   │   ├── DiffView.ts
│   │   └── StatusBar.ts
│   └── utils/                  # 工具函数
│       ├── ProjectFingerprint.ts
│       ├── DataMasking.ts
│       └── ErrorCodes.ts
├── tests/
│   ├── unit/                   # 单元测试
│   │   ├── memory/
│   │   ├── security/
│   │   ├── skill/
│   │   └── tools/
│   ├── integration/            # 集成测试
│   │   ├── codeExplain.test.ts
│   │   ├── commitGenerate.test.ts
│   │   └── skillExecution.test.ts
│   └── fixtures/               # 测试数据
├── assets/                     # 静态资源
│   └── icons/
├── schemas/                    # JSON Schema
│   └── skill.schema.json
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## 实施阶段

### 阶段 0：基础架构（2周）

**目标**：建立可运行的空插件框架，配置热加载，日志加密，测试框架就绪

**关键任务**：
1. 初始化 VS Code 插件项目结构
   - 创建 package.json（定义命令、配置项、激活事件）
   - 配置 TypeScript (tsconfig.json)
   - 配置 Jest 测试框架
   - 配置 ESLint + Prettier
   - 创建 .vscode 调试配置

2. 实现配置管理系统
   - YAML 配置加载 (~/.xiaoweiba/config.yaml)
   - 环境变量覆盖支持 (${env:VAR_NAME})
   - 配置热加载监听
   - 配置备份与回滚机制
   - 默认配置生成

3. 实现审计日志系统
   - pino 结构化日志封装
   - AES-256-GCM 加密存储
   - HMAC 防篡改签名
   - 日志轮转（单文件 20MB，保留 10 个）
   - 日志级别动态调整

4. 实现错误处理框架
   - 结构化错误码定义（ErrorCodes.ts）
   - 统一错误处理器
   - 用户友好错误提示

5. 实现 SQLite 封装
   - DatabaseManager 类封装 better-sqlite3
   - WAL 模式启用
   - 连接池管理
   - 迁移脚本支持
   - 每日自动备份机制

6. 搭建测试框架
   - Jest 单元测试配置
   - vscode-test 集成测试配置
   - Mock LLM 响应的录制回放机制
   - CI 性能基准测试框架

**验收标准**：
- 插件可成功激活（<300ms）
- 配置文件可热加载
- 日志加密写入成功
- 单元测试框架运行通过
- 无实际业务逻辑，仅基础设施

---

### 阶段 1：核心功能（3周）

**目标**：实现代码解释、提交生成、情景记忆记录、基础偏好匹配四个核心命令

**关键任务**：
1. 实现 LLM 工具适配器
   - DeepSeek API 调用封装
   - Ollama 本地模型支持
   - 多提供商切换机制
   - 请求重试与降级策略
   - 内容脱敏（密码、令牌等）

2. 实现项目指纹隔离
   - 基于 Git 远程 URL + 工作区路径生成 SHA256 哈希
   - 项目唯一标识存储
   - 跨项目记忆隔离验证

3. 实现情景记忆系统
   - EpisodicMemory 数据模型与表结构
   - 记忆记录接口（taskType, summary, entities, decision, outcome, weight）
   - 记忆检索接口（按项目、类型、时间范围）
   - 记忆衰减算法（decayLambda = 0.01）
   - 记忆归档与清理

4. 实现偏好记忆系统
   - PreferenceMemory 数据模型与表结构
   - 显式偏好记录（如 SQL 优化方案选择）
   - 简单偏好匹配（下次同类任务优先推荐）
   - 置信度计算（sampleCount 加权）

5. 实现代码解释命令 (F01)
   - 选中代码提取
   - 调用 LLM 生成解释
   - Webview 流式展示（Markdown 格式）
   - 记录情景记忆
   - P95 响应 <3s

6. 实现生成提交信息命令 (F02)
   - 读取 Git 暂存区变更 (git diff --cached)
   - 调用 LLM 生成 Conventional Commits 格式信息
   - 用户可编辑后提交
   - 记录情景记忆

7. 实现内置最佳实践库 (F05)
   - 预置常见编码规范（JSON/YAML 格式）
   - 预置 SQL 优化原则
   - 冷启动兜底机制
   - 覆盖 10+ 常见场景

**验收标准**：
- `xiaoweiba.explainCode` 命令可用，P95 <3s
- `xiaoweiba.generateCommit` 命令可用，生成符合规范的提交信息
- 每次任务完成后情景记忆成功记录（成功率 99.9%）
- 偏好推荐命中率 >60%（冷启动后）
- 不同项目记忆不串

---

### 阶段 2：安全与存储（2周）

**目标**：完善安全授权机制，实现 Diff 确认，记忆导出/导入，项目指纹隔离

**关键任务**：
1. 实现任务级授权系统
   - 任务令牌生成（生命周期：任务启动→结束/超时）
   - 最小权限集分配（初始只读）
   - 动态权限升级申请（用户 y/n 确认，60s 超时）
   - 权限类型：read:file, write:file, execute:command, read:database, write:database, call:llm, git:commit
   - 终端风格交互界面

2. 实现参数白名单校验
   - 路径 glob 模式匹配（仅允许 <workspace>/src/**, <workspace>/test/**）
   - 禁止路径：**/.env, **/secrets/**
   - 命令白名单/黑名单（禁止 sudo, rm -rf, curl, wget）
   - fs.realpath 解析防止符号链接绕过

3. 实现 Diff 确认机制 (F07)
   - Git 风格差异对比视图
   - 用户确认后才写入文件
   - 无例外强制执行
   - 支持批量文件确认

4. 实现记忆导出/导入 (F08)
   - 全部记忆导出为 JSON 文件（非加密）
   - 从 JSON 文件导入恢复
   - 导出导入后数据一致性校验
   - 支持选择性导出（按项目、时间范围）

5. 实现项目指纹隔离 (F10)
   - 基于 Git 远程 URL 和工作区路径生成唯一标识
   - 所有记忆表增加 projectFingerprint 字段
   - 查询时自动过滤当前项目
   - 跨项目隔离验证测试

6. 实现任务持久化与恢复
   - task_state 表设计
   - 长时间任务（>30s）状态持久化
   - 插件崩溃后可恢复
   - 弹窗询问是否继续未完成任务

7. 实现数据库备份与修复
   - 每日凌晨自动备份到 ~/.xiaoweiba/backups/
   - 保留最近 7 天备份
   - xiaoweiba.repair-memory 命令执行完整性检查
   - 损坏时从最新备份恢复

8. 实现配置回滚
   - 修改配置时自动备份为 config.yaml.bak
   - 新配置解析失败时自动回滚
   - 保留最近 3 份有效配置历史

**验收标准**：
- 所有写入操作需用户确认后才执行
- 任务级授权正常工作，超时自动拒绝
- 记忆可成功导出导入且数据一致
- 不同项目记忆完全隔离
- 数据库损坏时可从备份恢复

---

### 阶段 3：技能系统（4周）

**目标**：实现完整的技能系统，包括手写技能、执行引擎、沉淀技能建议、试用期机制

**关键任务**：
1. 实现程序记忆系统
   - ProceduralMemory 数据模型与表结构
   - 操作序列哈希（SHA256）
   - 累积分数计算（cumulativeScore）
   - 出现次数统计（occurrenceCount）

2. 实现技能定义格式
   - JSON Schema 定义（skill.schema.json）
   - 技能元数据（name, description, version, author）
   - 步骤序列定义（无逻辑，仅声明式）
   - 依赖声明
   - 原子性标志（atomic: true/false）

3. 实现用户手写技能 (F06)
   - 技能文件加载（~/.xiaoweiba/skills/user/*.json）
   - 技能解析与验证（JSON Schema 校验）
   - 技能注册到技能引擎
   - 技能列表查看命令

4. 实现技能执行引擎
   - 步骤顺序执行
   - 工具调用封装（FileTool, GitTool, ShellTool, LLMTool, DatabaseTool）
   - 步骤间数据传递
   - 执行状态跟踪
   - 错误处理与回滚

5. 实现沉淀技能建议 (F15)
   - 检测重复操作模式（程序记忆累积分数超阈值）
   - 弹窗建议保存为技能
   - 自动生成技能模板
   - 用户确认后创建技能文件
   - 建议准确率 >70%

6. 实现技能试用期 (F16)
   - 新生成技能默认每次询问是否使用
   - 连续 5 次采纳后自动应用
   - 用户可随时终止试用
   - 试用状态持久化

7. 实现技能原子性（可选事务模式）
   - atomic: true 时执行前创建 Git 检查点
   - 记录将要写入的文件路径
   - 任何步骤失败时自动 git checkout 恢复
   - 未使用 Git 时从临时目录复制回原文件

8. 实现技能安全沙箱
   - 技能步骤静态分析
   - 禁止危险操作（rm -rf, sudo 等）
   - 网络命令需显式授权
   - 执行超时控制

**验收标准**：
- 用户可编写 JSON 格式技能文件并成功执行
- 系统可检测重复操作并建议沉淀为技能
- 新技能试用期机制正常工作
- 原子性技能失败时可自动回滚
- 技能执行成功率 >90%

---

### 阶段 4：高级特性（3周）

**目标**：实现动态工作流组合、多模型支持、公司标准集成

**关键任务**：
1. 实现代码生成功能 (F11)
   - 自然语言需求解析
   - PRD 文件读取支持
   - LLM 代码生成
   - Diff 确认后写入
   - 符合项目风格检查

2. 实现单元测试生成功能 (F12)
   - 选中方法提取
   - 自动识别测试框架（Jest, JUnit, pytest 等）
   - 生成测试用例
   - 测试可运行且通过率 >80%
   - 遵循项目测试框架约定

3. 实现 SQL 优化功能 (F13)
   - 数据库连接配置
   - EXPLAIN 执行计划获取
   - 表结构读取
   - LLM 生成优化报告
   - 支持应用修改（Diff 确认）
   - 优化建议可落地

4. 实现命名检查功能 (F14)
   - 检查变量/类/方法命名
   - 内置规范 + 用户自定义规范
   - 高亮不规范命名
   - 提供修正建议
   - 符合项目命名风格

5. 实现动态工作流组合 (F17)
   - 用户输入复杂任务描述
   - LLM 根据本地技能摘要生成执行计划
   - 技能数限制 ≤5
   - 用户确认后执行
   - 计划合理性评估

6. 实现多模型支持 (F18)
   - 配置文件支持多个 LLM 提供商
   - 用户手动切换默认模型
   - 切换后新调用使用新模型
   - 模型特定参数配置（maxTokens, temperature）

7. 实现公司标准集成 (F19)
   - 用户指定本地标准文件路径（Markdown/YAML）
   - 系统优先采用其规则
   - 标准内规则优先级最高
   - 与公司标准冲突时的仲裁机制

8. 实现可观测性
   - getHealthStatus() 健康检查端点
   - 关键指标暴露（Prometheus 格式可选）
   - 结构化日志输出
   - 动态日志级别调整

**验收标准**：
- 代码生成语法正确，符合项目风格
- 单元测试可运行且通过率 >80%
- SQL 优化建议可落地执行
- 动态工作流可成功组合技能执行
- 多模型切换正常工作
- 公司标准规则优先级最高

---

### 阶段 5：实验性功能（按需）

**目标**：实现 P2 优先级实验性功能，默认关闭

**关键任务**：
1. 网络搜索归纳 (F20)
   - 默认关闭，需用户开启网络权限
   - 根据任务关键词搜索网络
   - 归纳最佳实践
   - 结果缓存

2. 模型自总结最佳实践 (F21)
   - 默认关闭
   - 每次任务实时调用 LLM 总结
   - 消耗 token 警告
   - 总结结果存储到语义记忆

3. 多源仲裁 (F22)
   - 默认关闭
   - 公司标准、模型总结、网络搜索冲突时自动仲裁
   - 用户手动选择最终方案

4. 自动多模型迁移 (F23)
   - 默认关闭
   - 切换模型时自动重新索引记忆
   - 用户确认机制

5. 认知报告 (F24)
   - 默认关闭
   - 每月生成用户行为分析报告
   - 偏好统计、技能使用、改进建议
   - 报告导出为 Markdown/PDF

**验收标准**：
- 所有 P2 功能默认关闭
- 用户开启后功能正常工作
- 不影响核心功能稳定性

---

## 关键文件清单

### 核心实现文件（按优先级）

**阶段 0**：
- `package.json` - 插件配置
- `src/extension.ts` - 插件入口
- `src/storage/ConfigManager.ts` - 配置管理
- `src/core/security/AuditLogger.ts` - 审计日志
- `src/storage/DatabaseManager.ts` - 数据库管理
- `src/utils/ErrorCodes.ts` - 错误码定义

**阶段 1**：
- `src/tools/LLMTool.ts` - LLM 工具适配器
- `src/utils/ProjectFingerprint.ts` - 项目指纹
- `src/core/memory/EpisodicMemory.ts` - 情景记忆
- `src/core/memory/PreferenceMemory.ts` - 偏好记忆
- `src/commands/explainCode.ts` - 代码解释命令
- `src/commands/generateCommit.ts` - 提交生成命令

**阶段 2**：
- `src/core/security/Authorization.ts` - 任务级授权
- `src/core/security/ParameterWhitelist.ts` - 参数白名单
- `src/ui/DiffView.ts` - Diff 确认视图
- `src/core/memory/MemoryExportImport.ts` - 记忆导出导入

**阶段 3**：
- `src/core/memory/ProceduralMemory.ts` - 程序记忆
- `src/core/skill/SkillEngine.ts` - 技能引擎
- `src/core/skill/SkillLoader.ts` - 技能加载器
- `src/core/skill/SkillExecutor.ts` - 技能执行器
- `schemas/skill.schema.json` - 技能 JSON Schema

**阶段 4**：
- `src/commands/generateCode.ts` - 代码生成
- `src/commands/generateTest.ts` - 测试生成
- `src/commands/optimizeSQL.ts` - SQL 优化
- `src/commands/checkNaming.ts` - 命名检查
- `src/core/skill/WorkflowComposer.ts` - 工作流组合

### 数据库表结构

```sql
-- 情景记忆表
CREATE TABLE episodic_memory (
  id TEXT PRIMARY KEY,
  project_fingerprint TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  task_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  entities TEXT,  -- JSON array
  decision TEXT,
  outcome TEXT NOT NULL,
  final_weight REAL NOT NULL,
  model_id TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata TEXT  -- JSON object
);

-- 偏好记忆表
CREATE TABLE preference_memory (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL,  -- JSON object
  confidence REAL NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 1,
  last_updated INTEGER NOT NULL,
  model_id TEXT,
  project_fingerprint TEXT
);

-- 程序记忆表
CREATE TABLE procedural_memory (
  id TEXT PRIMARY KEY,
  project_fingerprint TEXT,
  pattern_hash TEXT NOT NULL UNIQUE,
  pattern_description TEXT NOT NULL,
  cumulative_score REAL NOT NULL DEFAULT 0,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_occurrence INTEGER NOT NULL,
  suggested_as_skill BOOLEAN NOT NULL DEFAULT FALSE,
  skill_file_path TEXT
);

-- 任务状态表
CREATE TABLE task_state (
  task_id TEXT PRIMARY KEY,
  project_fingerprint TEXT NOT NULL,
  current_step_index INTEGER NOT NULL,
  step_outputs TEXT,  -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL
);

-- 审计日志表（加密存储）
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  encrypted_data BLOB NOT NULL,
  hmac_signature TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE episodic_memory_fts USING fts5(
  summary,
  entities,
  content='episodic_memory',
  content_rowid='rowid'
);
```

---

## 验证与测试

### 单元测试（覆盖率 >80%）

必须覆盖的模块：
- 记忆核心算法（衰减、权重计算、检索）
- 安全授权逻辑（令牌生成、权限校验、动态升级）
- 技能解析器（JSON Schema 验证、步骤解析）
- 工具白名单校验（路径匹配、命令过滤）

### 集成测试

关键场景端到端测试：
- 代码解释流程（选中代码 → LLM 调用 → Webview 展示 → 记忆记录）
- 提交生成流程（Git diff → LLM 调用 → 用户编辑 → 提交）
- 技能执行流程（加载技能 → 步骤执行 → 结果返回）
- 工作流组合流程（复杂任务 → 计划生成 → 技能组合执行）

### 性能基准测试

- 记忆检索延迟（1000 条记忆，P99 <100ms）
- 插件激活时间（<300ms）
- 代码解释响应（P95 <3s）
- 与基线对比，超过 10% 退化则告警

### 安全测试

- 路径遍历攻击测试（尝试读取工作区外文件）
- 命令注入测试（尝试绕过白名单）
- 技能恶意步骤检测
- 密钥加密验证（SecretStorage）

### 手动测试清单

1. 安装插件后首次使用体验
2. 配置文件热加载验证
3. 跨项目记忆隔离验证
4. Diff 确认流程验证
5. 记忆导出导入一致性验证
6. 技能试用期机制验证
7. 多模型切换验证
8. 数据库备份恢复验证

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| LLM API 不稳定或限流 | 中 | 高 | 实现重试+降级（返回最佳实践） |
| 记忆数据库性能下降 | 低 | 中 | 定期清理低价值记忆，支持分页加载 |
| 技能执行导致项目损坏 | 低 | 高 | 提供 Git 检查点回滚，默认禁用危险工具 |
| 用户拒绝授权导致任务无法完成 | 中 | 低 | 提供降级方案（只读分析，不写入） |
| 跨平台路径兼容性问题 | 低 | 中 | 使用 Node.js path 模块统一处理 |

---

## 下一步行动

1. **立即开始阶段 0**：初始化项目结构
2. 创建 package.json 和 TypeScript 配置
3. 实现配置管理系统
4. 实现审计日志系统
5. 实现 SQLite 封装
6. 搭建测试框架
7. 验证基础架构验收标准

预计总周期：14 周（约 3.5 个月）
