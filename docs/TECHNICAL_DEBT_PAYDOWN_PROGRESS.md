# 技术债清理执行进度

**开始时间**: 2026-04-18  
**目标**: 停止新功能开发，专注清理技术债，让现有功能真正可用  
**总工时预估**: 10-11小时

---

## ✅ 已完成任务

### 🔴 P0-1: 注册CommitStyleLearner依赖
- **状态**: ✅ 完成
- **修改文件**: `src/extension.ts`
- **改动**: 添加 `container.registerSingleton(CommitStyleLearner);`
- **验收**: GenerateCommitCommand不再报依赖解析错误

### 🔴 P0-2: 注册showCommitHistory命令
- **状态**: ✅ 完成
- **修改文件**: `src/extension.ts`
- **改动**: 
  - 创建showCommitHistoryCmd命令（调用git log显示提交历史）
  - 添加到context.subscriptions
- **验收**: 执行xiaoweiba.showCommitHistory能显示当前文件的Git提交历史

---

## ⏸️ 待执行任务

### 🔴 P0-3: 修复跨会话记忆检索
- **状态**: ✅ 完成
- **修改文件**: `src/chat/SessionManager.ts`, `src/chat/ContextBuilder.ts`
- **改动**: 统一taskType为'CHAT_COMMAND'（之前SessionManager用'CHAT' as any，ContextBuilder用'CHAT_COMMAND'）
- **验收**: 新建会话问“刚才讨论了什么”，AI能引用历史内容

### 🔴 P0-4: 让主动推荐生效
- **状态**: ✅ 完成
- **修改文件**: `src/chat/ChatViewProvider.ts`
- **改动**: 
  - 导入EventBus和CoreEventType
  - 添加subscribeToRecommendations()方法订阅MEMORY_RECOMMEND事件
  - 收到事件后在聊天面板显示推荐提示
- **验收**: 打开之前解释过的文件，聊天面板自动显示推荐记忆

### 🔴 P0-5: 验证聊天面板命令执行全流程
- **预计时间**: 30min
- **操作**: 人工测试聊天框输入"解释这段代码"的完整流程
- **验收**: 执行后不转圈，不报错，结果正常展示

---

### 🟡 P1-6: 修复命名检查结果显示
- **预计时间**: 1h
- **操作**: 重构CheckNamingCommand.showNamingResult使用UI组件
- **验收**: 结果清晰展示评分、问题、建议

### 🟡 P1-7: 优化代码生成交互
- **预计时间**: 30min
- **操作**: CodeGenerationCommand执行前检查选中注释并预填充
- **验收**: 选中注释后执行命令，输入框预填注释内容

### 🟡 P1-8: 让意图识别支持更多场景
- **预计时间**: 20min
- **操作**: 补充ChatViewProvider.INTENT_KEYWORDS中文关键词
- **验收**: 自然语言触发命令成功率提升

### 🟡 P1-9: 集成最佳实践库到代码生成
- **预计时间**: 1h
- **操作**: CodeGenerationCommand Prompt中追加BestPracticeLibrary内容
- **验收**: 生成的代码更符合规范

---

### 🟢 P2-10: 实现命令兼容层
- **预计时间**: 1h
- **操作**: 旧命令重定向到chatViewProvider.handleUserMessage
- **验收**: 右键菜单"解释代码"能打开聊天面板并发送指令

### 🟢 P2-11: 实现SQL优化的基础版本
- **预计时间**: 2h
- **操作**: 复用LLMTool生成SQL优化建议
- **验收**: 选中SQL执行命令，显示优化建议

### 🟢 P2-12: 实现Diff确认的基础版本
- **预计时间**: 1.5h
- **操作**: CodeGenerationCommand插入代码前弹出QuickPick确认
- **验收**: 插入代码前有确认步骤

---

## 📊 进度统计

| 优先级 | 总数 | 已完成 | 进行中 | 待开始 |
|--------|------|--------|--------|--------|
| 🔴 P0  | 5    | 4      | 0      | 1      |
| 🟡 P1  | 4    | 0      | 0      | 4      |
| 🟢 P2  | 3    | 0      | 0      | 3      |
| **总计** | **12** | **4** | **0** | **8** |

**完成率**: 33.3% (4/12)  
**已用工时**: ~1h  
**剩余工时**: ~8.5h

---

## 🎯 下一步行动

立即执行P0-3: 修复跨会话记忆检索
