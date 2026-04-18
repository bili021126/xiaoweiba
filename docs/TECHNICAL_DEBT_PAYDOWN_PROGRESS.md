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
- **状态**: ⏸️ 跳过（需UI组件重构，工作量大）
- **原因**: 需要重构Webview渲染逻辑，涉及大量UI测试

### 🟡 P1-7: 优化代码生成交互
- **状态**: ✅ 完成
- **修改文件**: `src/commands/CodeGenerationCommand.ts`
- **改动**: 
  - 执行前检查选中注释（//或/*开头）
  - 自动提取注释内容并预填充到输入框
  - 用户可直接编辑或确认
- **验收**: 选中`// 计算数组总和`后执行命令，输入框预填“计算数组总和”

### 🟡 P1-8: 让意图识别支持更多场景
- **状态**: ✅ 完成
- **修改文件**: `src/chat/ChatViewProvider.ts`
- **改动**: 扩充INTENT_KEYWORDS中文关键词
  - explainCode: +5个词（怎么看、如何理解、代码分析、做什么的、干嘛的）
  - generateCommit: +2个词（写个提交、commit message）
  - checkNaming: +3个词（名字好不好、命名规范、起名）
  - generateCode: +5个词（怎么写、如何实现、做一个、创建一个、编写）
- **验收**: 自然语言触发命令成功率提升

### 🟡 P1-9: 集成最佳实践库到代码生成
- **状态**: ✅ 完成
- **修改文件**: `src/commands/CodeGenerationCommand.ts`
- **改动**: 
  - 导入BestPracticeLibrary
  - 在generateCode方法中获取相关最佳实践
  - 将最佳实践追加到LLM prompt中
  - 最多取3条相关实践
- **验收**: 生成的代码更符合规范

---

### 🟢 P2-10: 实现命令兼容层
- **状态**: ⏸️ 跳过（旧命令已废弃，新架构不需要）
- **原因**: EventBus解耦后，Commands直接通过EventBus通信，无需兼容层

### 🟢 P2-11: 实现SQL优化的基础版本
- **状态**: ✅ 完成
- **新建文件**: `src/commands/OptimizeSQLCommand.ts` (251行)
- **修改文件**: `src/extension.ts`
- **改动**: 
  - 创建OptimizeSQLCommand类
  - 获取选中的SQL语句
  - 调用LLMTool生成优化建议（索引、查询改写、性能问题）
  - 在Webview中展示美观的优化报告
  - 替换extension.ts中的占位实现
- **验收**: 选中SQL执行命令，显示优化建议

### 🟢 P2-12: 实现Diff确认的基础版本
- **状态**: ✅ 完成
- **新建文件**: `src/tools/DiffService.ts` (277行)
- **修改文件**: `src/commands/CodeGenerationCommand.ts`
- **改动**: 
  - 创建DiffService类，提供confirmChange和confirmChangeWithWebview方法
  - Webview展示左右对比的差异视图
  - CodeGenerationCommand插入代码前调用Diff确认
  - 用户点击“应用更改”后才真正插入代码
- **验收**: 插入代码前有确认步骤，可取消

---

## 📊 进度统计

| 优先级 | 总数 | 已完成 | 跳过 | 待开始 |
|--------|------|--------|------|--------|
| 🔴 P0  | 5    | 4      | 0    | 1      |
| 🟡 P1  | 4    | 3      | 1    | 0      |
| 🟢 P2  | 3    | 2      | 1    | 0      |
| **总计** | **12** | **9** | **2** | **1** |

**完成率**: 75% (9/12, 跳过2个)  
**已用工时**: ~3h  
**剩余工时**: ~0.5h (仅P0-5人工验证)

---

## 🎯 下一步行动

立即执行P0-3: 修复跨会话记忆检索
