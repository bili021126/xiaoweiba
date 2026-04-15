# 小尾巴（xiaoweiba）完整测试套件

**版本**: v2.0  
**更新日期**: 2026-04-15  
**测试覆盖率目标**: ≥85%

---

## 📋 测试套件结构

```
tests/
├── unit/                          # 单元测试
│   ├── chat/                      # 聊天模块
│   │   ├── ChatViewProvider.test.ts     ✅ 已完成
│   │   ├── ContextBuilder.test.ts       ⏳ 待完成
│   │   ├── PromptEngine.test.ts         ⏳ 待完成
│   │   └── SessionManager.test.ts       ⏳ 待完成
│   ├── completion/                # 补全模块
│   │   └── AICompletionProvider.test.ts ⏳ 待完成
│   ├── commands/                  # 命令模块
│   │   ├── ExplainCodeCommand.test.ts   ✅ 已存在
│   │   ├── GenerateCommitCommand.test.ts ✅ 已存在
│   │   ├── CodeGenerationCommand.test.ts ✅ 已存在
│   │   ├── CheckNamingCommand.test.ts    ✅ 已存在
│   │   ├── ExportMemoryCommand.test.ts   ✅ 已存在
│   │   └── ImportMemoryCommand.test.ts   ✅ 已存在
│   ├── core/                      # 核心模块
│   │   ├── memory/
│   │   │   ├── EpisodicMemory.test.ts   ✅ 已存在（需更新SQL注入测试）
│   │   │   └── PreferenceMemory.test.ts ✅ 已存在（需更新参数化查询测试）
│   │   ├── security/
│   │   │   ├── AuditLogger.test.ts      ✅ 已存在
│   │   │   └── TaskToken.test.ts        ✅ 已存在
│   │   └── cache/
│   │       └── LLMResponseCache.test.ts ✅ 已存在
│   ├── storage/                   # 存储模块
│   │   ├── DatabaseManager.test.ts      ⚠️ 需更新（修复runQuery测试）
│   │   └── ConfigManager.test.ts        ✅ 已存在
│   ├── tools/                     # 工具模块
│   │   └── LLMTool.test.ts            ✅ 已存在
│   └── utils/                     # 工具函数
│       ├── ErrorCodes.test.ts         ✅ 已存在
│       └── ProjectFingerprint.test.ts ✅ 已存在
│
├── integration/                   # 集成测试
│   ├── chat/                      # 聊天集成测试
│   │   └── ChatFlow.test.ts           ⏳ 待完成
│   ├── completion/                # 补全集成测试
│   │   └── CompletionFlow.test.ts     ⏳ 待完成
│   ├── memory/                    # 记忆系统集成测试
│   │   ├── EpisodicMemoryDatabase.test.ts ✅ 已存在
│   │   └── CrossSessionMemory.test.ts   ⏳ 待完成
│   ├── commands/                  # 命令集成测试
│   │   ├── ExplainCodeFullStack.test.ts ✅ 已存在
│   │   └── GenerateCommitFullStack.test.ts ✅ 已存在
│   └── collaboration/             # 模块协同测试
│       └── ModuleCollaboration.test.ts  ⏳ 待完成
│
├── e2e/                           # 端到端测试
│   ├── CompleteWorkflow.test.ts       ⏳ 待完成
│   └── SecurityScenarios.test.ts      ⏳ 待完成
│
└── SECURITY-TESTS-v0.2.1.md       ✅ 安全测试规范
```

---

## 🎯 测试优先级

### P0 - 立即完成（影响核心功能）
1. ✅ ChatViewProvider单元测试
2. ⏳ DatabaseManager单元测试（修复runQuery）
3. ⏳ ContextBuilder单元测试
4. ⏳ AICompletionProvider单元测试

### P1 - 尽快完成（重要功能）
5. ⏳ SessionManager单元测试
6. ⏳ PromptEngine单元测试
7. ⏳ PreferenceMemory参数化查询测试
8. ⏳ 模块协同测试

### P2 - 后续完善（增强覆盖）
9. ⏳ 跨会话记忆测试
10. ⏳ 端到端工作流测试
11. ⏳ 性能基准测试

---

## 📊 当前测试状态

| 模块 | 单元测试 | 集成测试 | 覆盖率 | 状态 |
|------|---------|---------|--------|------|
| **chat/** | 1/4 | 0/2 | ~30% | 🟡 进行中 |
| **completion/** | 0/1 | 0/1 | 0% | 🔴 未开始 |
| **commands/** | 6/6 | 2/2 | 85% | ✅ 完成 |
| **core/memory/** | 2/2 | 1/2 | 90% | 🟢 良好 |
| **core/security/** | 2/2 | 0/0 | 91% | ✅ 完成 |
| **storage/** | 1/2 | 0/0 | 75% | ⚠️ 需更新 |
| **tools/** | 1/1 | 0/0 | 88% | ✅ 完成 |
| **utils/** | 2/2 | 0/0 | 93% | ✅ 完成 |

**总体进度**: 15/28 (54%)

---

## 🔧 执行测试

### 运行所有测试
```bash
npm test
```

### 运行特定模块测试
```bash
# 单元测试
npm test -- tests/unit/chat/ChatViewProvider.test.ts

# 集成测试
npm run test:integration

# 安全测试
npm test -- tests/unit/core/memory/EpisodicMemory.test.ts -t "SQL注入"
```

### 查看覆盖率
```bash
npm test -- --coverage
```

---

## 📝 测试编写规范

### 命名规范
```typescript
// ✅ 好：描述行为和预期
it('应该在SQL查询中使用参数化防止注入', async () => {});

// ❌ 坏：描述实现细节
it('应该调用db.prepare方法', async () => {});
```

### 结构规范（AAA模式）
```typescript
it('应该正确处理用户消息', async () => {
  // Arrange - 准备
  const mockData = { ... };
  
  // Act - 执行
  const result = await service.handleMessage(mockData);
  
  // Assert - 验证
  expect(result).toBeDefined();
  expect(mockDependency.called).toBe(true);
});
```

### Mock规范
```typescript
// ✅ 只Mock外部依赖
const llmToolMock = {
  call: jest.fn().mockResolvedValue({ success: true })
};

// ❌ 不要Mock被测对象本身
const serviceMock = {
  handleMessage: jest.fn()  // 错误！
};
```

---

## 🛡️ 安全测试要求

### SQL注入防护
- [ ] 所有数据库查询使用prepare/bind
- [ ] ORDER BY/LIMIT使用白名单验证
- [ ] 测试包含常见注入payload

### XSS防护
- [ ] Webview内容使用DOMPurify清理
- [ ] CSP策略配置正确
- [ ] 测试包含恶意脚本标签

### 敏感信息保护
- [ ] API Key不写入日志
- [ ] 审计日志脱敏
- [ ] .env文件在.gitignore中

---

## 📈 覆盖率目标

| 指标 | 最低 | 目标 | 优秀 |
|------|------|------|------|
| 语句覆盖率 | 75% | 80% | 90% |
| 分支覆盖率 | 70% | 75% | 85% |
| 函数覆盖率 | 80% | 85% | 95% |
| 行覆盖率 | 75% | 80% | 90% |

---

**维护者**: AI代码审查助手  
**最后更新**: 2026-04-15
