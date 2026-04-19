# E2E验收测试指南

**版本**: v0.4.0  
**最后更新**: 2026-04-19  
**状态**: ✅ 所有P0/P1问题已修复，可开始人工验收

---

## 📋 验收前准备

### 1. 编译项目
```bash
npm run compile
```
✅ 预期：零错误，零警告

### 2. 运行单元测试
```bash
npm test
```
✅ 预期：通过率 ≥ 95% (472/497)

### 3. 打包VSIX
```bash
vsce package
```
✅ 预期：生成 `xiaoweiba-0.4.0.vsix`

### 4. 安装插件
- 打开VS Code
- 扩展面板 → 从VSIX安装 → 选择生成的vsix文件
- 重启VS Code

---

## 🎯 E2E验收场景

### 场景1: 多轮对话功能（P0-01修复验证）

**测试步骤**:
1. 打开Chat视图（侧边栏"小尾巴"图标）
2. 输入："你好"
3. 等待回复后，继续输入："帮我写一个排序函数"
4. 再次输入："能优化一下吗？"

**验收标准**:
- ✅ ChatAgent能够获取之前的对话历史
- ✅ 第三轮回复应该参考前两轮上下文
- ✅ 无报错，流式响应正常

**技术验证**:
```typescript
// MemoryAdapter.sessionHistories 应包含会话历史
// MemoryContext.sessionHistory 应被填充
```

---

### 场景2: Agent智能选择（P0-02修复验证）

**测试步骤**:
1. 执行多次chat意图（至少3次）
2. 检查IntentDispatcher的日志输出
3. 观察Agent选择决策

**验收标准**:
- ✅ Wilson评分算法正常工作
- ✅ Agent性能数据被记录
- ✅ 相同意图总是选择最优Agent

**技术验证**:
```typescript
// MemoryAdapter.agentPerformances 应有数据
// getAgentPerformance() 返回准确的统计数据
```

---

### 场景3: 语义搜索功能（P1-04修复验证）

**测试步骤**:
1. 选中一段代码（例如排序函数）
2. 右键 → "解释代码"
3. 检查是否检索到相似代码的历史解释

**验收标准**:
- ✅ MemoryAdapter.retrieveForExplainCode调用episodicMemory.search()
- ✅ 搜索结果包含相关记忆
- ✅ 代码解释质量提升

**技术验证**:
```typescript
// episodicMemory.search() 自动调用searchSemantic
// SearchEngine.rankAndRetrieve() 返回混合评分结果
```

---

### 场景4: 行内补全低延迟优化（P0-05修复验证）

**测试步骤**:
1. 在TypeScript文件中输入代码
2. 触发AI补全（Ctrl+Space或自动触发）
3. 测量补全延迟

**验收标准**:
- ✅ 补全延迟 < 200ms（理想 < 100ms）
- ✅ MemoryAdapter跳过记忆检索
- ✅ 用户体验流畅

**技术验证**:
```typescript
// MemoryAdapter.retrieveContext对inline_completion返回空上下文
// dispatchSync路径不经过EventBus
```

---

### 场景5: 记忆导出功能（P2-07修复验证）

**测试步骤**:
1. 执行命令面板 → "小尾巴: 导出记忆"
2. 选择保存路径（例如桌面/memories.json）
3. 检查导出的JSON文件

**验收标准**:
- ✅ 成功导出JSON文件
- ✅ 文件格式正确（包含version、exportedAt、memories数组）
- ✅ 显示导出数量提示

**技术验证**:
```json
{
  "version": "1.0",
  "exportedAt": "2026-04-19T...",
  "totalCount": 10,
  "memories": [
    {
      "id": "...",
      "taskType": "CHAT",
      "summary": "...",
      ...
    }
  ]
}
```

---

### 场景6: 记忆导入功能（P2-07修复验证）

**测试步骤**:
1. 执行命令面板 → "小尾巴: 导入记忆"
2. 选择之前导出的JSON文件
3. 检查导入结果

**验收标准**:
- ✅ 成功导入记忆
- ✅ 显示导入数量和跳过数量
- ✅ 导入的记忆可用于后续检索

**技术验证**:
```typescript
// ImportMemoryAgent调用episodicMemory.record()逐条导入
// 错误处理：失败的记录被跳过，不影响其他记录
```

---

### 场景7: 数据库写操作持久化（P1-07修复验证）

**测试步骤**:
1. 执行任意会写入记忆的操作（如chat对话）
2. 立即关闭VS Code
3. 重新打开VS Code
4. 检查记忆是否保留

**验收标准**:
- ✅ 记忆数据不丢失
- ✅ DatabaseManager.run()识别REPLACE操作
- ✅ 所有写操作立即落盘

**技术验证**:
```typescript
// DatabaseManager.run() 检测INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/REPLACE
// saveDatabase() 被正确调用
```

---

### 场景8: DiffService稳定性（P1-09修复验证）

**测试步骤**:
1. 触发需要确认的代码修改（如果有此功能）
2. 在Webview中点击"确认"或"取消"
3. 或者直接关闭Webview面板

**验收标准**:
- ✅ 无Promise重复resolve错误
- ✅ 面板关闭行为符合预期
- ✅ 控制台无警告

**技术验证**:
```typescript
// DiffService.confirmChangeWithWebview使用isResolved标志位
// safeResolve防止二次resolve
```

---

## 🔍 调试技巧

### 查看日志
```typescript
// VS Code输出面板 → 选择"小尾巴"通道
// 或使用开发者工具（Help → Toggle Developer Tools）
```

### 检查数据库
```bash
# 找到数据库文件位置
# Windows: %APPDATA%/Code/User/globalStorage/xiaoweiba/
# 使用DB Browser for SQLite打开查看
```

### 监控性能
```typescript
// 在关键路径添加console.time/console.timeEnd
// 例如：dispatchSync的耗时
```

---

## ✅ 验收清单

| 场景 | 状态 | 备注 |
|------|------|------|
| 多轮对话功能 | ⬜ | P0-01 |
| Agent智能选择 | ⬜ | P0-02 |
| 语义搜索功能 | ⬜ | P1-04 |
| 行内补全低延迟 | ⬜ | P0-05 |
| 记忆导出功能 | ⬜ | P2-07 |
| 记忆导入功能 | ⬜ | P2-07 |
| 数据库持久化 | ⬜ | P1-07 |
| DiffService稳定性 | ⬜ | P1-09 |

**全部通过后可发布v0.4.0** 🚀

---

## 📊 性能基准

| 指标 | 目标值 | 实测值 |
|------|--------|--------|
| chat意图响应时间 | < 2s | ⬜ |
| inline_completion延迟 | < 200ms | ⬜ |
| 记忆检索耗时 | < 100ms | ⬜ |
| 单元测试通过率 | ≥ 95% | 95% |
| 编译错误数 | 0 | 0 |

---

## 🐛 已知问题

- ⏸️ P1-05: ChatViewProvider会话管理仍为临时实现（可使用，但建议后续改为SessionAgent）
- ⏸️ P1-06: DatabaseManager.run()写操作识别未使用白名单策略（当前方案已足够）
- ⏸️ P2-10: EventBus空订阅者仍有微任务开销（影响极小，可忽略）

---

## 📝 验收报告模板

```markdown
# E2E验收报告 - v0.4.0

**验收人**: ___________  
**验收日期**: ___________  
**验收环境**: VS Code ______, OS ______

## 测试结果

| 场景 | 通过/失败 | 问题描述 |
|------|-----------|----------|
| 场景1 | ⬜ | |
| 场景2 | ⬜ | |
| ... | | |

## 性能数据

- chat响应时间: _____ ms
- inline_completion延迟: _____ ms
- 记忆检索耗时: _____ ms

## 结论

⬜ 通过，可以发布  
⬜ 不通过，需要修复以下问题：
  1. ...
  2. ...

**签字**: ___________
```
