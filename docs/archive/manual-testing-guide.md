# 小尾巴（xiaoweiba）MVP 人工测试引导文档

**版本：** v1.14  
**测试日期：** 2026-04-15  
**测试环境要求：** VS Code ≥ 1.85.0, Node.js ≥ 16

---

## 一、测试环境准备

### 1.1 安装与配置

1. **打开项目目录**
   ```bash
   cd d:\xiaoweiba
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **编译插件**
   ```bash
   npm run compile
   ```

4. **配置 API Key**
   - 按 `Ctrl+Shift+P` 打开命令面板
   - 输入 "小尾巴: 配置 API Key"
   - 选择 "DeepSeek"
   - 输入您的 DeepSeek API Key
   - 或手动编辑配置文件：`.vscode/xiaoweiba-config.yaml`
     ```yaml
     model:
       default: deepseek
       providers:
         deepseek:
           apiKey: sk-your-api-key-here
           modelName: deepseek-chat
           baseURL: https://api.deepseek.com/v1
     ```

5. **启动调试模式**
   - 按 `F5` 启动新的 VS Code 窗口（Extension Development Host）
   - 确认右下角显示 "小尾巴已激活"

---

## 二、测试用例清单

### 测试用例 1：代码解释功能（F01）✅ 已通过

**测试场景：** 选中一段代码，调用AI解释

**操作步骤：**
1. 在 Extension Development Host 中打开任意 TypeScript/JavaScript 文件
2. 选中一段函数或类定义（建议50-100行）
3. 右键点击选中的代码
4. 选择 "小尾巴: 解释代码"
5. 观察进度提示："获取选中代码" → "调用 AI 模型..." → "生成完成"
6. 等待 Webview 面板打开

**预期结果：**
- ✅ 进度提示正常显示
- ✅ Webview 面板打开，显示代码解释
- ✅ 解释内容包含：功能概述、关键逻辑、改进建议
- ✅ 响应时间在 3-7 秒内（优化后）
- ✅ 无错误提示

**验证点：**
- [ ] Webview 内容格式正确（Markdown渲染）
- [ ] 解释内容与选中代码相关
- [ ] 控制台无报错

**数据验证：**
```bash
# 检查情景记忆是否记录
# 数据库位置：C:\Users\<用户名>\AppData\Roaming\xiaoweiba\memory.db
# 可使用 SQLite Browser 打开查看 episodic_memory 表
```

---

### 测试用例 2：提交生成功能（F02）⏳ 待验证

**测试场景：** 修改文件后，自动生成 Git 提交信息

**前置条件：**
- 项目已初始化 Git 仓库
- 有未提交的更改

**操作步骤：**
1. 在 Extension Development Host 中修改任意文件（添加注释或空行）
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "小尾巴: 生成提交信息"
4. 观察进度提示："获取 Git diff" → "调用 AI 模型..." → "生成完成"
5. 查看 QuickPick 弹出的选项：
   - "使用此提交信息"
   - "重新生成"
   - "手动编辑"
   - "取消"
6. 选择 "使用此提交信息"

**预期结果：**
- ✅ 成功获取 Git diff
- ✅ LLM 生成符合规范的提交信息（Conventional Commits）
- ✅ QuickPick 正确显示4个选项
- ✅ 选择后自动执行 `git commit`
- ✅ 控制台输出 "提交成功"

**验证点：**
- [ ] 提交信息格式：`type(scope): description`
- [ ] 提交信息准确描述更改内容
- [ ] Git 历史记录中存在新提交
- [ ] 情景记忆已记录

**失败场景测试：**
- [ ] 无更改时提示 "没有未提交的更改"
- [ ] 非 Git 仓库提示 "当前目录不是 Git 仓库"

---

### 测试用例 3：情景记忆检索（F03）⏳ 待验证

**测试场景：** 多次解释代码后，验证记忆是否正确记录和检索

**操作步骤：**
1. 重复执行 **测试用例 1** 至少 3 次（不同代码片段）
2. 每次间隔 10-20 秒
3. 检查数据库记录：
   - 打开 SQLite Browser
   - 加载 `C:\Users\<用户名>\AppData\Roaming\xiaoweiba\memory.db`
   - 查询 `episodic_memory` 表

**预期结果：**
- ✅ 每次解释都创建一条新记录
- ✅ 记录字段完整：id, project_fingerprint, timestamp, task_type, summary, outcome
- ✅ task_type = "explain_code"
- ✅ outcome = "success"
- ✅ final_weight 随时间衰减（后续记录权重略低）

**SQL 验证查询：**
```sql
SELECT id, task_type, summary, final_weight, created_at 
FROM episodic_memory 
ORDER BY created_at DESC 
LIMIT 5;
```

---

### 测试用例 4：记忆导出功能（F08）⏳ 待验证

**测试场景：** 导出情景记忆为 JSON 文件

**操作步骤：**
1. 确保数据库中至少有 2-3 条记忆记录
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "小尾巴: 导出记忆"
4. 选择导出路径（建议桌面）
5. 确认导出成功提示

**预期结果：**
- ✅ 弹出文件保存对话框
- ✅ 生成 JSON 文件（如 `xiaoweiba-memory-20260415.json`）
- ✅ 文件内容格式正确：
  ```json
  {
    "version": "1.0",
    "exportedAt": "2026-04-15T02:30:00.000Z",
    "memories": [
      {
        "id": "...",
        "taskType": "explain_code",
        "summary": "...",
        ...
      }
    ]
  }
  ```
- ✅ 控制台无报错

---

### 测试用例 5：记忆导入功能（F08）⏳ 待验证

**测试场景：** 从 JSON 文件导入记忆

**前置条件：**
- 已有导出的 JSON 文件（来自测试用例 4）

**操作步骤：**
1. 清空数据库（可选，用于验证去重）：
   ```sql
   DELETE FROM episodic_memory;
   ```
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "小尾巴: 导入记忆"
4. 选择之前导出的 JSON 文件
5. 确认导入成功提示

**预期结果：**
- ✅ 弹出文件选择对话框
- ✅ 验证 JSON 格式正确
- ✅ 显示导入统计："成功导入 X 条记忆，跳过 Y 条重复"
- ✅ 数据库中记录数增加
- ✅ 重复导入时自动去重

**验证查询：**
```sql
SELECT COUNT(*) FROM episodic_memory;
-- 应与导入数量一致
```

---

### 测试用例 6：错误处理与降级（通用）⏳ 待验证

**测试场景：** API 调用失败时的错误处理

**操作步骤：**
1. 临时修改配置文件，设置错误的 API Key：
   ```yaml
   deepseek:
     apiKey: sk-invalid-key-12345
   ```
2. 执行 "代码解释" 功能
3. 观察错误提示

**预期结果：**
- ✅ 显示用户友好错误消息（非技术细节）
- ✅ 控制台记录详细错误日志
- ✅ 审计日志记录失败事件
- ✅ 插件不崩溃，可继续使用

**恢复配置：**
```yaml
deepseek:
  apiKey: sk-your-valid-key
```

---

## 三、性能验证

### 3.1 响应时间测量

| 功能 | 预期时间 | 实测时间 | 状态 |
|------|---------|---------|------|
| 代码解释 | 3-7 秒 | ___ 秒 | ☐ |
| 提交生成 | 5-10 秒 | ___ 秒 | ☐ |
| 记忆导出 | < 1 秒 | ___ 秒 | ☐ |
| 记忆导入 | < 2 秒 | ___ 秒 | ☐ |

### 3.2 内存泄漏检测

**操作步骤：**
1. 连续执行 "代码解释" 10 次
2. 观察 VS Code 任务管理器内存使用
3. 确认无明显增长趋势

**预期结果：**
- ✅ 内存使用稳定（波动 < 50MB）
- ✅ 无持续上升趋势

---

## 四、问题记录模板

如发现任何问题，请按以下格式记录：

```markdown
### 问题 #X

**测试用例：** [例如：测试用例 2 - 提交生成]

**操作步骤：**
1. ...
2. ...

**预期结果：**
...

**实际结果：**
...

**错误信息：**
```
[粘贴控制台错误或弹窗消息]
```

**严重程度：** 🔴 高 / 🟡 中 / 🟢 低

**截图：** [如有]

**复现率：** 100% / 偶尔 / 仅一次
```

---

## 五、数据清理方法

### 5.1 清空情景记忆

```sql
-- 打开 SQLite Browser
-- 执行以下 SQL
DELETE FROM episodic_memory;
VACUUM;
```

### 5.2 清空审计日志

```bash
# 删除日志文件
rm C:\Users\<用户名>\AppData\Roaming\xiaoweiba\audit\*.log
```

### 5.3 重置配置

```bash
# 删除配置文件（备份先）
cp .vscode/xiaoweiba-config.yaml .vscode/xiaoweiba-config.yaml.bak
rm .vscode/xiaoweiba-config.yaml
# 重启 VS Code 后会生成默认配置
```

---

## 六、测试完成检查清单

完成所有测试后，请确认：

- [ ] 测试用例 1（代码解释）- 通过
- [ ] 测试用例 2（提交生成）- 通过/失败
- [ ] 测试用例 3（情景记忆）- 通过/失败
- [ ] 测试用例 4（记忆导出）- 通过/失败
- [ ] 测试用例 5（记忆导入）- 通过/失败
- [ ] 测试用例 6（错误处理）- 通过/失败
- [ ] 性能验证完成
- [ ] 问题记录完整（如有）

---

## 七、反馈方式

测试完成后，请提供：

1. **测试结果汇总**
   - 通过的测试用例数 / 总用例数
   - 发现的问题列表

2. **性能数据**
   - 各功能的实际响应时间
   - 是否有卡顿或延迟

3. **用户体验反馈**
   - 哪些功能好用
   - 哪些地方需要改进
   - 是否有遗漏的功能需求

4. **建议的下一步**
   - 修复高优先级 Bug
   - 补充缺失功能
   - 优化性能
   - 其他建议

---

**祝测试顺利！** 🚀

如有任何问题，随时告诉我。
