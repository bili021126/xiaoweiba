# 小尾巴 (XiaoWeiba) 人工测试用例

**版本**: 0.1.0  
**测试日期**: 2026-04-17  
**测试环境**: VS Code ^1.85.0, Node.js >=18.0.0

---

## 一、安装与激活测试

### 1.1 插件安装
- [x] **TC-001**: 从VSIX文件安装插件
  - 步骤：`Extensions` → `Install from VSIX` → 选择xiaoweiba-0.1.0.vsix
  - 预期：安装成功，无错误提示
  
- [x] **TC-002**: 检查依赖是否正确加载
  - 步骤：打开开发者工具（Help → Toggle Developer Tools）
  - 预期：Console无模块加载错误
  
    workbench.desktop.main.js:sourcemap:414  INFO Started local extension host with pid 21380.
    workbench.desktop.main.js:sourcemap:414   ERR Ignoring python.analysis.indexing.followSymlinkedFolders as python.analysis.indexing is true
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:1859 Overwriting grammar scope name to file mapping for scope source.python.
    Old grammar file: file:///d%3A/Programs%20Files/Microsoft%20VS%20Code/560a9dba96/resources/app/extensions/python/syntaxes/MagicPython.tmLanguage.json.
    New grammar file: file:///c%3A/Users/origin/.vscode/extensions/ms-python.vscode-pylance-2026.2.1/grammars/PylancePython.tmLanguage
    register @ workbench.desktop.main.js:sourcemap:1859
    workbench.desktop.main.js:sourcemap:414   ERR Ignoring terminal.integrated.initialHint.copilotCli as terminal.integrated.initialHint is true
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:414   ERR Ignoring python.analysis.indexing.followSymlinkedFolders as python.analysis.indexing is true
    error @ workbench.desktop.main.js:sourcemap:414
    TMScopeRegistry.ts:46 Overwriting grammar scope name to file mapping for scope source.python.
    Old grammar file: file:///d%3A/Programs%20Files/Microsoft%20VS%20Code/560a9dba96/resources/app/extensions/python/syntaxes/MagicPython.tmLanguage.json.
    New grammar file: file:///c%3A/Users/origin/.vscode/extensions/ms-python.vscode-pylance-2026.2.1/grammars/PylancePython.tmLanguage
    register @ TMScopeRegistry.ts:46
    workbench.desktop.main.js:sourcemap:414   ERR [sdras.vue-vscode-snippets]: "contributes.vue-vscode-snippets.language" 中包含未知语言。提供的值: vue-html
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:414   ERR [win.vscode-vue2-snippet]: "contributes.vscode-vue2-snippet.language" 中包含未知语言。提供的值: vue-html
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:414   ERR Unable to create workbench contribution 'workbench.contrib.agentHostTerminal'. Error: [createInstance] wbe depends on UNKNOWN service remoteAgentHostService.
        at a._throwIfStrict (workbench.desktop.main.js:sourcemap:1890:5273)
        at a._createInstance (workbench.desktop.main.js:sourcemap:1890:1641)
        at a.createInstance (workbench.desktop.main.js:sourcemap:1890:1440)
        at a.safeCreateContribution (workbench.desktop.main.js:sourcemap:924:46881)
        at c (workbench.desktop.main.js:sourcemap:924:46482)
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:414  INFO Settings Sync: Account status changed from uninitialized to unavailable
    workbench.desktop.main.js:sourcemap:962 [Extension Host] Created lock file at C:\Users\origin\.claude\ide\46837.lock
    workbench.desktop.main.js:sourcemap:962 [Extension Host] Set CLAUDE_CODE_SSE_PORT=46837 in terminal environment (in-memory)
    workbench.desktop.main.js:sourcemap:414   ERR [Extension Host] (node:21380) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
    (Use `Code --trace-deprecation ...` to show where the warning was created)
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:962 [Extension Host] (node:21380) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
    (Use `Code --trace-deprecation ...` to show where the warning was created)
    Hio @ workbench.desktop.main.js:sourcemap:962
    workbench.desktop.main.js:sourcemap:414   ERR [Extension Host] (node:21380) ExperimentalWarning: SQLite is an experimental feature and might change at any time
    error @ workbench.desktop.main.js:sourcemap:414
    workbench.desktop.main.js:sourcemap:962 [Extension Host] (node:21380) ExperimentalWarning: SQLite is an experimental feature and might change at any time
    Hio @ workbench.desktop.main.js:sourcemap:962
    workbench.desktop.main.js:sourcemap:414  INFO [perf] Render performance baseline is 14ms
    api.github.com/copilot/mcp_registry:1  Failed to load resource: the server responded with a status of 404 ()
    api.github.com/copilot/mcp_registry:1  Failed to load resource: the server responded with a status of 404 ()
    api.github.com/copilot/mcp_registry:1  Failed to load resource: the server responded with a status of 404 ()
    marketplace.visualstudio.com/_apis/public/gallery/vscode/oracle/oracledevtools/latest:1  Failed to load resource: the server responded with a status of 404 ()
    workbench.desktop.main.js:sourcemap:962 [Extension Host] ========== [Extension] activate() called ==========
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 1: Initializing container...
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 1 complete
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 2: Loading config...
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 2 complete
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 3: Initializing database...
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] Resolved WASM path: c:\Users\origin\.vscode\extensions\xiaoweiba.xiaoweiba-0.1.0\node_modules\sql.js\dist\sql-wasm.wasm
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] Loading WASM from: c:\Users\origin\.vscode\extensions\xiaoweiba.xiaoweiba-0.1.0\node_modules\sql.js\dist\sql-wasm.wasm
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] Existing database loaded
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] FTS5 not available, full-text search disabled: no such module: fts5
    Hio @ workbench.desktop.main.js:sourcemap:962
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] This is expected in development mode. FTS5 will be enabled in production build.
    Hio @ workbench.desktop.main.js:sourcemap:962
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [DatabaseManager] Database initialized successfully at: C:\Users\origin\.xiaoweiba\data\memory.db
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Database initialized successfully
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] DatabaseManager registered as singleton
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 3 complete
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 4: Initializing EpisodicMemory and LLMTool...
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Core services initialized
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [Extension] Step 4 complete
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [SessionManager] 加载了 1 个会话
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ExplainCodeCommand] Constructor called
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ExplainCodeCommand] episodicMemory param: provided
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ExplainCodeCommand] llmTool param: provided
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ExplainCodeCommand] episodicMemory instance: initialized
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ExplainCodeCommand] dbManager: exists
    workbench.desktop.main.js:sourcemap:962 [Extension Host] 小尾巴 (XiaoWeiba) 已激活，耗时: 45ms
    marketplace.visualstudio.com/_apis/public/gallery/vscode/xiaoweiba/xiaoweiba/latest:1  Failed to load resource: the server responded with a status of 404 ()
    workbench.desktop.main.js:sourcemap:5205 Unrecognized feature: 'local-network-access'.
    _createElement @ workbench.desktop.main.js:sourcemap:5205
    workbench.desktop.main.js:sourcemap:5205 An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.
    mountTo @ workbench.desktop.main.js:sourcemap:5205
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ChatViewProvider] resolveWebviewView called
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ChatViewProvider] Setting webview HTML...
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ChatViewProvider] Webview HTML set successfully
    workbench.desktop.main.js:sourcemap:962 [Extension Host] [ChatViewProvider] Data loaded, hiding loading indicator
    index.html?id=6427158d-82e5-4ff8-9a55-2e524c4202d1&parentId=1&origin=a421bd0b-66e0-46c1-a3e8-9e9b9489ee61&swVersion=4&extensionId=xiaoweiba.xiaoweiba&platform=electron&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app&purpose=webviewView:1060 Unrecognized feature: 'local-network-access'.

### 1.2 插件激活
- [ ] **TC-003**: 启动时自动激活
  - 步骤：重启VS Code
  - 预期：活动栏出现"小尾巴AI助手"图标
  
- [ ] **TC-004**: 命令注册验证
  - 步骤：`Ctrl+Shift+P` → 输入"小尾巴"
  - 预期：显示所有10个命令

---

## 二、配置测试

### 2.1 API Key配置
- [ ] **TC-005**: 配置DeepSeek API Key
  - 步骤：执行命令"小尾巴: 配置 API Key" → 输入API Key
  - 预期：显示"✅ deepseek API Key 已保存"通知
  
- [ ] **TC-006**: 测试API连接
  - 步骤：点击通知中的"测试连接"按钮
  - 预期：显示进度条 → "✅ deepseek 连接成功！模型: deepseek-chat"
  
- [ ] **TC-007**: 无效API Key处理
  - 步骤：输入错误的API Key → 测试连接
  - 预期：显示"❌ deepseek 连接失败: Invalid API key"

### 2.2 配置文件验证
- [ ] **TC-008**: config.yaml存在性检查
  - 步骤：检查 `~/.xiaoweiba/config.yaml`
  - 预期：文件存在，包含memory.decayLambda: 0.1
  
- [ ] **TC-009**: 环境变量解析
  - 步骤：设置DEEPSEEK_API_KEY环境变量 → 重启VS Code
  - 预期：无需手动配置即可使用

---

## 三、核心功能测试

### 3.1 代码解释（F01）
- [ ] **TC-010**: 正常代码解释
  - 步骤：选中TypeScript函数 → 右键"小尾巴: 解释代码"
  - 预期：ChatView打开，显示解释结果
  
- [ ] **TC-011**: 记忆记录验证
  - 步骤：完成代码解释后，查询"刚才那个解释"
  - 预期：返回最近的CODE_EXPLAIN记忆
  
- [ ] **TC-012**: 无选中代码
  - 步骤：未选中代码时执行命令
  - 预期：提示"请先选中代码"

### 3.2 提交信息生成（F02）
- [ ] **TC-013**: Git仓库中生成
  - 步骤：在有修改的Git仓库 → SCM视图 → 点击"生成提交信息"
  - 预期：输入框填充生成的提交信息
  
- [ ] **TC-014**: 非Git仓库
  - 步骤：在非Git目录执行命令
  - 预期：提示"当前工作区不是Git仓库"

### 3.3 命名检查（F03）
- [ ] **TC-015**: 检查变量命名
  - 步骤：选中变量名 → 右键"小尾巴: 检查命名"
  - 预期：显示命名规范建议
  
- [ ] **TC-016**: 不支持的语言
  - 步骤：在.txt文件中执行
  - 预期：命令不可用（when条件限制）

### 3.4 代码生成（F11）
- [ ] **TC-017**: 根据注释生成代码
  - 步骤：编写注释"// 计算数组总和" → 执行"生成代码"
  - 预期：生成对应的TypeScript函数
  
- [ ] **TC-018**: 空编辑器
  - 步骤：空文件执行命令
  - 预期：提示"编辑器为空"

### 3.5 SQL优化（F05）
- [ ] **TC-019**: 优化SQL查询
  - 步骤：选中SQL语句 → 执行"优化 SQL"
  - 预期：显示优化建议和改写后的SQL

---

## 四、记忆系统测试

### 4.1 情景记忆检索
- [ ] **TC-020**: 时间指代查询
  - 步骤：执行代码解释 → 立即询问"刚才做了什么"
  - 预期：返回最近的CODE_EXPLAIN记忆
  
- [ ] **TC-021**: 实体查询
  - 步骤：查询"calculateTotal函数"
  - 预期：返回包含该实体的记忆（实体加权生效）
  
- [ ] **TC-022**: 模糊语义查询
  - 步骤：查询"怎么优化这个算法"
  - 预期：返回相关记忆（向量权重增强）

### 4.2 记忆衰减验证
- [ ] **TC-023**: 时间衰减效果
  - 步骤：创建7天前的记忆（手动修改timestamp）→ 查询
  - 预期：得分低于新记忆（λ=0.1，半衰期7天）
  
- [ ] **TC-024**: 过期记忆清理
  - 步骤：创建90天前的记忆 → 触发清理
  - 预期：记忆被删除（retentionDays=90）

### 4.3 专家选择器
- [ ] **TC-025**: 时间敏感查询切换专家
  - 步骤：连续查询"刚才"、"上次"
  - 预期：专家切换到temporal
  
- [ ] **TC-026**: 重置专家
  - 步骤：执行命令"xiaoweiba.reset-expert"
  - 预期：专家恢复到balanced

### 4.4 偏好记忆
- [ ] **TC-027**: 学习用户偏好
  - 步骤：多次拒绝某种代码风格 → 生成新代码
  - 预期：避免使用该风格

---

## 五、聊天界面测试

### 5.1 基础对话
- [ ] **TC-028**: 打开聊天视图
  - 步骤：点击活动栏图标或`Ctrl+Shift+L`
  - 预期：Webview正常加载，显示欢迎消息
  
- [ ] **TC-029**: 发送消息
  - 步骤：输入"你好" → 发送
  - 预期：显示用户消息和AI回复
  
- [ ] **TC-030**: 跨会话记忆
  - 步骤：关闭聊天 → 重新打开 → 询问"之前聊了什么"
  - 预期：能回忆之前的对话内容

### 5.2 上下文构建
- [ ] **TC-031**: 包含选中代码
  - 步骤：选中代码后打开聊天 → 提问
  - 预期：ContextBuilder包含选中的代码片段
  
- [ ] **TC-032**: 包含文件路径
  - 步骤：在打开的文件中提问
  - 预期：Context包含当前文件路径

### 5.3 UI交互
- [ ] **TC-033**: 消息滚动
  - 步骤：发送多条消息超出视口
  - 预期：自动滚动到底部
  
- [ ] **TC-034**: 代码块渲染
  - 步骤：AI回复包含代码块
  - 预期：代码高亮正确显示

---

## 六、行内补全测试

### 6.1 基础补全
- [ ] **TC-035**: 触发补全
  - 步骤：输入代码 → 等待triggerDelayMs
  - 预期：显示灰色补全建议
  
- [ ] **TC-036**: 接受补全
  - 步骤：按Tab键
  - 预期：补全内容插入编辑器

### 6.2 缓存机制
- [ ] **TC-037**: 缓存命中
  - 步骤：相同上下文再次触发
  - 预期：快速返回（从缓存）

---

## 七、记忆导入导出测试

### 7.1 导出记忆
- [ ] **TC-038**: 导出为JSON
  - 步骤：执行"小尾巴: 导出记忆" → 选择路径
  - 预期：生成JSON文件，包含所有记忆记录
  
- [ ] **TC-039**: 空数据库导出
  - 步骤：新安装后导出
  - 预期：生成空数组`[]`

### 7.2 导入记忆
- [ ] **TC-040**: 导入有效数据
  - 步骤：执行"小尾巴: 导入记忆" → 选择导出的JSON
  - 预期：记忆数量增加，显示导入成功
  
- [ ] **TC-041**: 导入无效JSON
  - 步骤：选择损坏的JSON文件
  - 预期：显示错误提示"无效的JSON格式"
  
- [ ] **TC-042**: 导入重复数据
  - 步骤：导入相同的记忆ID
  - 预期：跳过重复项或更新

---

## 八、数据库维护测试

### 8.1 修复数据库
- [ ] **TC-043**: 正常修复
  - 步骤：执行"小尾巴: 修复记忆数据库"
  - 预期：显示"数据库修复成功"
  
- [ ] **TC-044**: 损坏数据库修复
  - 步骤：手动破坏数据库文件 → 执行修复
  - 预期：重建数据库，保留可恢复数据

---

## 九、错误场景测试

### 9.1 网络错误
- [ ] **TC-045**: API超时
  - 步骤：断开网络 → 执行代码解释
  - 预期：显示"请求超时，请检查网络连接"
  
- [ ] **TC-046**: API限流
  - 步骤：快速连续发送请求
  - 预期：显示"请求过于频繁，请稍后再试"

### 9.2 配置错误
- [ ] **TC-047**: 缺失API Key
  - 步骤：未配置API Key → 执行需要LLM的命令
  - 预期：提示"请先配置API Key"并引导配置
  
- [ ] **TC-048**: 无效配置文件
  - 步骤：手动破坏config.yaml语法
  - 预期：使用默认配置，显示警告日志

### 9.3 文件系统错误
- [ ] **TC-049**: 数据库锁定
  - 步骤：同时打开两个VS Code实例
  - 预期：第二个实例提示"数据库被占用"
  
- [ ] **TC-050**: 磁盘空间不足
  - 步骤：模拟磁盘满 → 写入记忆
  - 预期：显示"磁盘空间不足，无法保存记忆"

### 9.4 边界条件
- [ ] **TC-051**: 超长查询
  - 步骤：输入500字符查询
  - 预期：截断到200字符，正常检索
  
- [ ] **TC-052**: 特殊字符查询
  - 步骤：查询包含SQL注入字符`'; DROP TABLE--`
  - 预期：参数化查询防止注入，正常返回
  
- [ ] **TC-053**: 空工作区
  - 步骤：无文件夹打开时执行命令
  - 预期：使用default_workspace指纹，功能正常

---

## 十、性能测试

### 10.1 响应时间
- [ ] **TC-054**: 代码解释响应
  - 步骤：执行代码解释，计时
  - 预期：< 5秒（取决于API）
  
- [ ] **TC-055**: 记忆检索响应
  - 步骤：查询记忆，计时
  - 预期：< 100ms（内存索引）
  
- [ ] **TC-056**: 聊天界面加载
  - 步骤：打开ChatView，计时
  - 预期：< 500ms

### 10.2 内存占用
- [ ] **TC-057**: 长时间运行
  - 步骤：连续使用2小时
  - 预期：内存增长 < 100MB

---

## 十一、回归测试清单

每次发布前必须执行：

- [ ] 所有单元测试通过（npm test）
- [ ] 编译无错误（npm run compile）
- [ ] TC-001 ~ TC-010（安装与配置）
- [ ] TC-020 ~ TC-026（记忆系统核心功能）
- [ ] TC-045 ~ TC-053（错误处理）

---

## 测试结果汇总

| 类别 | 用例数 | 通过 | 失败 | 跳过 | 备注 |
|------|--------|------|------|------|------|
| 安装与激活 | 4 | | | | |
| 配置 | 5 | | | | |
| 核心功能 | 10 | | | | |
| 记忆系统 | 8 | | | | |
| 聊天界面 | 7 | | | | |
| 行内补全 | 3 | | | | |
| 导入导出 | 5 | | | | |
| 数据库维护 | 2 | | | | |
| 错误场景 | 9 | | | | |
| 性能 | 4 | | | | |
| **总计** | **57** | | | | |

**测试人员**: _______________  
**测试日期**: _______________  
**结论**: □ 通过  □ 不通过  □ 有条件通过

**问题记录**:
```
1. 
2. 
3. 
```
