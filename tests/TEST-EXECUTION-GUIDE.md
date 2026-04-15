# 小尾巴（xiaoweiba）测试执行指南

**版本**: v1.0  
**创建日期**: 2026-04-15  
**目标**: 全场景全任务全模块全过程全链路协同测试

---

## 🎯 测试目标

### 覆盖率指标
- **单元测试覆盖率**: ≥85%
- **集成测试覆盖率**: ≥80%
- **安全测试通过率**: 100%
- **端到端测试通过率**: 100%

### 质量门禁
- 所有P0测试必须通过
- 无严重安全漏洞
- 性能基准达标（补全响应P95 < 500ms）

---

## 📋 测试清单

### ✅ 已完成测试

#### 单元测试
- [x] ChatViewProvider.test.ts - 聊天视图提供者
- [x] DatabaseManager.test.ts - 数据库管理器（已修复runQuery参数化）
- [x] ExplainCodeCommand.test.ts - 代码解释命令
- [x] GenerateCommitCommand.test.ts - 提交生成命令
- [x] CodeGenerationCommand.test.ts - 代码生成命令
- [x] CheckNamingCommand.test.ts - 命名检查命令
- [x] ExportMemoryCommand.test.ts - 记忆导出命令
- [x] ImportMemoryCommand.test.ts - 记忆导入命令
- [x] EpisodicMemory.test.ts - 情景记忆
- [x] PreferenceMemory.test.ts - 偏好记忆
- [x] AuditLogger.test.ts - 审计日志
- [x] TaskToken.test.ts - 任务令牌
- [x] LLMResponseCache.test.ts - LLM缓存
- [x] LLMTool.test.ts - LLM工具
- [x] ConfigManager.test.ts - 配置管理
- [x] ErrorCodes.test.ts - 错误码
- [x] ProjectFingerprint.test.ts - 项目指纹

#### 集成测试
- [x] EpisodicMemoryDatabase.test.ts - 情景记忆数据库
- [x] ExplainCodeFullStack.test.ts - 代码解释完整流程
- [x] GenerateCommitFullStack.test.ts - 提交生成完整流程

---

### ⏳ 待完成测试（按优先级）

#### P0 - 立即完成

##### 1. ContextBuilder单元测试
**文件**: `tests/unit/chat/ContextBuilder.test.ts`  
**测试要点**:
- ✅ 编辑器上下文收集
- ✅ 会话历史检索
- ✅ 情景记忆检索
- ✅ 跨会话记忆检索
- ✅ 偏好记忆注入
- ✅ 系统提示构建

**预计工时**: 2小时

##### 2. PromptEngine单元测试
**文件**: `tests/unit/chat/PromptEngine.test.ts`  
**测试要点**:
- ✅ 模板选择逻辑
- ✅ 命令检测
- ✅ 变量填充
- ✅ 自定义模板注册

**预计工时**: 1.5小时

##### 3. SessionManager单元测试
**文件**: `tests/unit/chat/SessionManager.test.ts`  
**测试要点**:
- ✅ 会话创建/切换/删除
- ✅ 消息添加
- ✅ 会话持久化
- ✅ 会话摘要生成
- ✅ 最大会话数限制

**预计工时**: 2小时

##### 4. AICompletionProvider单元测试
**文件**: `tests/unit/completion/AICompletionProvider.test.ts`  
**测试要点**:
- ✅ 触发延迟控制
- ✅ 取消令牌检查
- ✅ 缓存机制（LRU + TTL）
- ✅ Markdown清理
- ✅ Prompt构建

**预计工时**: 2小时

---

#### P1 - 尽快完成

##### 5. 聊天模块集成测试
**文件**: `tests/integration/chat/ChatFlow.test.ts`  
**测试场景**:
- 用户发送消息 → 上下文构建 → LLM调用 → 流式响应 → 记忆记录
- 会话切换 → 历史加载 → 继续对话
- 跨会话记忆检索 → 注入Prompt → AI回答引用历史

**预计工时**: 3小时

##### 6. 补全模块集成测试
**文件**: `tests/integration/completion/CompletionFlow.test.ts`  
**测试场景**:
- 用户输入代码 → 触发延迟 → LLM补全 → 缓存命中/未命中
- 快速输入 → 取消旧请求 → 发起新请求
- 补全接受/拒绝 → 审计日志记录

**预计工时**: 2.5小时

##### 7. 跨会话记忆测试
**文件**: `tests/integration/memory/CrossSessionMemory.test.ts`  
**测试场景**:
- 会话1讨论主题A → 生成摘要 → 存入情景记忆
- 会话2询问相关主题 → 检索历史 → 注入上下文
- 验证AI回答是否引用历史会话

**预计工时**: 2小时

##### 8. 模块协同测试
**文件**: `tests/integration/collaboration/ModuleCollaboration.test.ts`  
**测试场景**:
- ChatViewProvider + ContextBuilder + SessionManager + EpisodicMemory 协同工作
- AICompletionProvider + LLMTool + LLMResponseCache 协同工作
- 所有命令 + 审计日志 + 记忆系统 协同工作

**预计工时**: 4小时

---

#### P2 - 后续完善

##### 9. 端到端工作流测试
**文件**: `tests/e2e/CompleteWorkflow.test.ts`  
**测试场景**:
- 完整开发流程：代码解释 → 代码生成 → 提交生成
- 记忆蒸馏流程：多次交互 → 偏好学习 → 个性化回答
- 跨项目隔离：项目A记忆不影响项目B

**预计工时**: 5小时

##### 10. 安全场景测试
**文件**: `tests/e2e/SecurityScenarios.test.ts`  
**测试场景**:
- SQL注入攻击模拟 → 验证防护有效
- XSS攻击模拟 → 验证DOMPurify清理
- 敏感信息泄露测试 → 验证脱敏

**预计工时**: 3小时

##### 11. 性能基准测试
**文件**: `tests/performance/Benchmark.test.ts`  
**测试指标**:
- AI补全响应时间P95 < 500ms
- 聊天首字响应时间P95 < 2s
- 数据库查询时间P95 < 50ms
- 内存占用 < 200MB

**预计工时**: 2小时

---

## 🔧 测试执行命令

### 运行所有测试
```bash
npm test
```

### 运行特定模块
```bash
# 单元测试
npm test -- tests/unit/chat/

# 集成测试
npm run test:integration

# 安全测试
npm test -- -t "SQL注入"
npm test -- -t "XSS防护"
```

### 查看覆盖率
```bash
# 文本报告
npm test -- --coverage

# HTML报告
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

### 持续监控模式
```bash
npm test -- --watch
```

---

## 📊 测试进度跟踪

### 当前状态
| 类别 | 已完成 | 总计 | 完成率 |
|------|--------|------|--------|
| 单元测试 | 17/21 | 81% |
| 集成测试 | 3/7 | 43% |
| E2E测试 | 0/2 | 0% |
| 性能测试 | 0/1 | 0% |
| **总计** | **20/31** | **65%** |

### 覆盖率现状
```
Statements   : 80.23% (目标: 85%)
Branches     : 75.22% (目标: 80%)
Functions    : 85.50% (目标: 90%)
Lines        : 80.10% (目标: 85%)
```

---

## 🛡️ 安全测试专项

### SQL注入防护测试矩阵
| 模块 | 测试用例 | 状态 |
|------|---------|------|
| EpisodicMemory.retrieve | 参数化查询 | ✅ |
| EpisodicMemory.search | FTS5转义 | ✅ |
| EpisodicMemory.getStats | 统计查询 | ✅ |
| ImportMemoryCommand | ID检查 | ✅ |
| PreferenceMemory.queryPreferences | LIMIT验证 | ✅ |
| DatabaseManager.runQuery | 通用查询 | ✅ |

### XSS防护测试矩阵
| 模块 | 测试用例 | 状态 |
|------|---------|------|
| ChatViewProvider | DOMPurify清理 | ✅ |
| ChatViewProvider | CSP策略 | ✅ |
| ExplainCodeCommand | HTML转义 | ✅ |

---

## 📝 测试编写最佳实践

### 1. AAA模式
```typescript
it('应该正确处理用户输入', async () => {
  // Arrange - 准备测试数据
  const input = 'test';
  const mockResult = { success: true };
  mockDependency.mockResolvedValue(mockResult);
  
  // Act - 执行被测操作
  const result = await service.process(input);
  
  // Assert - 验证结果
  expect(result).toEqual(mockResult);
  expect(mockDependency).toHaveBeenCalledWith(input);
});
```

### 2. Mock策略
```typescript
// ✅ 好：只Mock外部依赖
const llmTool = {
  call: jest.fn().mockResolvedValue({ success: true })
};

// ❌ 坏：Mock被测对象
const service = {
  process: jest.fn()  // 不要这样做！
};
```

### 3. 清理资源
```typescript
afterEach(async () => {
  // 清理测试数据库
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // 重置Mock
  jest.clearAllMocks();
});
```

---

## 🚀 下一步行动

### 本周计划（P0）
- [ ] 完成ContextBuilder单元测试
- [ ] 完成PromptEngine单元测试
- [ ] 完成SessionManager单元测试
- [ ] 完成AICompletionProvider单元测试
- [ ] 更新PreferenceMemory测试（参数化查询）

### 下周计划（P1）
- [ ] 完成聊天模块集成测试
- [ ] 完成补全模块集成测试
- [ ] 完成跨会话记忆测试
- [ ] 完成模块协同测试

### 下下周计划（P2）
- [ ] 完成端到端测试
- [ ] 完成安全场景测试
- [ ] 完成性能基准测试
- [ ] 达到85%覆盖率目标

---

## 📞 问题反馈

如遇测试问题，请：
1. 检查Mock是否正确配置
2. 确认依赖注入容器初始化
3. 查看VS Code输出面板的测试日志
4. 参考现有测试文件的写法

---

**维护者**: AI代码审查助手  
**最后更新**: 2026-04-15  
**下次审查**: 所有P0测试完成后
