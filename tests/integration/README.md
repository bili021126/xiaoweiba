# 小尾巴集成测试环境 Setup 指南

## 前置条件

1. Node.js >= 16
2. VS Code >= 1.85.0
3. npm 或 yarn

## 依赖说明

集成测试所需依赖已在 `package.json` 中配置：
- `@vscode/test-electron`: ^2.3.8（VS Code 测试框架）
- `mocha`: ^11.7.5（测试运行器）
- `glob`: ^13.0.6（文件匹配）
- `@types/mocha`: ^10.0.10
- `@types/glob`: ^8.1.0

## 运行集成测试

### 方法1: 使用npm脚本（推荐）

```bash
npm run test:integration
```

这会自动编译 TypeScript 并运行测试。

### 方法2: 仅编译不运行

```bash
npm run compile:integration
```

### 方法3: 监听模式（开发时）

```bash
npm run test:integration:watch
```

自动重新编译修改的测试文件。

### 方法4: 在VS Code中调试

1. 打开 `.vscode/launch.json`
2. 选择 "Extension Tests" 配置
3. 按 F5 开始调试

## 测试结构

```
tests/integration/
├── runIntegrationTests.ts    # 测试启动脚本（入口）
├── suite/
│   └── index.ts              # Mocha 测试套件索引
├── extension.test.ts         # 插件激活测试
├── collaboration/            # 模块协同测试（Jest单元测试，非集成测试）
│   └── ModuleCollaboration.test.ts
└── README.md                 # 本文件

out/tests/                    # 编译输出目录
├── tests/integration/        # 编译后的集成测试
└── src/                      # 编译后的源代码（供测试引用）
```

## 配置文件说明

### tsconfig.integration.json

专用于集成测试的 TypeScript 配置：
- 输出目录：`out/tests`
- 包含：集成测试文件和套件索引
- 排除：Jest 单元测试（collaboration 目录）和 setup.ts

### package.json scripts

```json
{
  "compile:integration": "tsc -p ./tsconfig.integration.json",
  "test:integration": "npm run compile:integration && node out/tests/integration/runIntegrationTests.js",
  "test:integration:watch": "tsc -p ./tsconfig.integration.json -w"
}
```

## 编写新的集成测试

1. 在 `tests/integration/` 目录下创建 `.test.ts` 文件
2. 使用 Mocha 的 `suite` 和 `test` API（不是 Jest）
3. 使用 VS Code API 进行测试
4. 测试会自动被发现并运行

示例：

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('我的集成测试', () => {
  test('应该能够正常工作', async () => {
    // 测试代码
    assert.ok(true);
  });
});
```

**注意：** 
- 集成测试使用 **Mocha**（`suite`/`test`）
- 单元测试使用 **Jest**（`describe`/`it`/`test`）
- 不要混用两种框架

## 常见问题

### Q: 找不到模块 "mocha"
A: 运行 `npm install --save-dev @types/mocha`

### Q: 找不到模块 "glob"  
A: 运行 `npm install --save-dev glob @types/glob`

### Q: 测试超时
A: 在 `suite/index.ts` 中增加 timeout 值（默认60秒）

### Q: VS Code 窗口无法打开
A: 检查是否有其他VS Code实例占用，或尝试重启

### Q: 编译后找不到测试文件
A: 确保运行 `npm run compile:integration` 后再运行测试

### Q: ModuleCollaboration.test.ts 编译错误
A: 该文件使用 Jest 语法，已被排除在集成测试编译之外。如需运行，请使用 `npm test`

## 当前测试覆盖

| 测试文件 | 状态 | 说明 |
|---------|------|------|
| extension.test.ts | ✅ 已实现 | 插件激活、命令注册验证 |
| EpisodicMemoryDatabase.test.ts | ✅ 已实现 | EpisodicMemory ↔ DatabaseManager 端到端测试（12个用例） |
| ModuleCollaboration.test.ts | ⚠️ Jest单元测试 | 模块依赖注入验证（非集成测试） |

### EpisodicMemory ↔ DatabaseManager 测试覆盖

| 测试场景 | 验证内容 |
|---------|---------|
| 记录记忆 | 验证记忆能正确写入 SQLite |
| 检索记忆 | 验证能从数据库读取记录 |
| 按类型过滤 | 验证 taskType 过滤功能 |
| 按时间范围过滤 | 验证时间范围查询 |
| 统计信息 | 验证 getStats() 返回正确数据 |
| 衰减权重 | 验证指数衰减算法 |
| 并发记录 | 验证5条并发写入无冲突 |
| 持久化 | 验证数据库重启后数据不丢失 |
| 空查询 | 验证不存在类型返回空数组 |
| FTS5搜索 | 验证全文搜索功能 |
| 过期清理 | 验证 cleanupExpired() 正常工作 |

## 下一步

- [ ] 补充LLMTool ↔ ConfigManager API Key获取测试
- [ ] 编写代码解释功能端到端测试
- [ ] 编写提交生成功能端到端测试
- [ ] 建立性能基准测试框架
