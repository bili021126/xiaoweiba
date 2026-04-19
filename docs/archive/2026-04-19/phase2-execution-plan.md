# Phase 2 执行计划：迁移Commands到IntentDispatcher

## 📋 概览

**目标**: 将所有Commands从MemorySystem迁移到IntentDispatcher  
**预计工作量**: 8-10小时  
**风险等级**: 低（有fallback机制）  
**验收标准**: 所有Commands通过IntentDispatcher调度，功能一致

---

## 🎯 Phase 2.1: 修改registerCommands使用IntentDispatcher

### 任务清单

- [ ] 读取当前registerCommands函数
- [ ] 识别所有需要迁移的Commands（约9个）
- [ ] 为每个Command创建新的IntentDispatcher调用
- [ ] 添加错误处理和用户反馈
- [ ] 验证编译通过
- [ ] 手动测试关键路径

### 需要迁移的Commands

| Command ID | Intent类型 | IntentFactory方法 | 优先级 |
|-----------|-----------|------------------|--------|
| xiaoweiba.explainCode | explain_code | buildExplainCodeIntent() | P0 |
| xiaoweiba.generateCommit | generate_commit | buildGenerateCommitIntent() | P0 |
| xiaoweiba.chat | chat | buildChatIntent() | P0 |
| xiaoweiba.checkNaming | check_naming | buildCheckNamingIntent() | P1 |
| xiaoweiba.optimizeSQL | optimize_sql | buildOptimizeSQLIntent() | P1 |
| xiaoweiba.generateCode | generate_code | buildGenerateCodeIntent() | P1 |
| xiaoweiba.configureApiKey | configure_api_key | buildConfigureApiKeyIntent() | P2 |
| xiaoweiba.exportMemory | export_memory | buildExportMemoryIntent() | P2 |
| xiaoweiba.importMemory | import_memory | buildImportMemoryIntent() | P2 |

### 实施步骤

#### Step 1: 读取当前实现

```typescript
// 在extension.ts中找到registerCommands函数
function registerCommands(context: vscode.ExtensionContext): void {
  // 当前的Command注册逻辑
}
```

#### Step 2: 获取IntentDispatcher实例

```typescript
// 从容器中解析IntentDispatcher
const intentDispatcher = container.resolve(IntentDispatcher);
```

#### Step 3: 替换Command实现（以explainCode为例）

```typescript
// ❌ 旧方式
const explainCodeCmd = vscode.commands.registerCommand(
  'xiaoweiba.explainCode',
  async () => {
    await memorySystem.executeAction('explainCode', {});
  }
);

// ✅ 新方式
const explainCodeCmd = vscode.commands.registerCommand(
  'xiaoweiba.explainCode',
  async () => {
    try {
      const intent = IntentFactory.buildExplainCodeIntent();
      await intentDispatcher.dispatch(intent);
    } catch (error) {
      vscode.window.showErrorMessage(`代码解释失败: ${error.message}`);
    }
  }
);
```

#### Step 4: 重复Step 3处理其他8个Commands

#### Step 5: 验证编译

```bash
npm run compile
```

#### Step 6: 手动测试

1. 选中代码 → 右键"解释代码" → 验证Webview显示
2. 输入聊天消息 → 验证AI回复
3. 生成提交信息 → 验证提交流程

---

## 🎯 Phase 2.2: 添加ChatAgent

### 任务清单

- [ ] 移动ChatAgent到agents目录
- [ ] 更新导入路径
- [ ] 在extension.ts中注册
- [ ] 验证编译通过

### 实施步骤

#### Step 1: 移动文件

```bash
Move-Item -Path "src\core\agent\ChatAgent.ts" -Destination "src\agents\ChatAgent.ts"
```

#### Step 2: 更新导入路径

```typescript
// src/agents/ChatAgent.ts
import { IAgent, AgentInput, AgentResult } from '../core/agent';
import { ILLMPort } from '../core/ports/ILLMPort';
import { IMemoryPort } from '../core/ports/IMemoryPort';
```

#### Step 3: 注册到AgentRegistry

```typescript
// src/extension.ts - initializeContainer函数
agentRegistry.register(new ChatAgent(llmAdapter, memoryAdapter));
```

#### Step 4: 添加到降级策略

```typescript
// src/core/application/IntentDispatcher.ts
const defaultAgent = this.agentRegistry.getAll().find(a => a.id === 'chat_agent');
```

#### Step 5: 验证编译

```bash
npm run compile
```

---

## 🎯 Phase 2.3: 订阅MemoryRecommendEvent到UI

### 任务清单

- [ ] 定义MemoryRecommendEvent（如果不存在）
- [ ] 在extension.ts中添加事件订阅
- [ ] 实现ChatViewProvider.showRecommendations()
- [ ] 验证推荐显示正常

### 实施步骤

#### Step 1: 检查MemoryRecommendEvent是否存在

```typescript
// src/core/events/DomainEvent.ts
export class MemoryRecommendEvent extends DomainEvent {
  static readonly type = 'memory.recommend';
  
  constructor(public readonly recommendations: any[]) {
    super(MemoryRecommendEvent.type, Date.now(), { recommendations });
  }
}
```

#### Step 2: 添加事件订阅

```typescript
// src/extension.ts - activate函数
eventBusAdapter.subscribe(MemoryRecommendEvent.type, (event) => {
  if (chatViewProvider) {
    chatViewProvider.showRecommendations(event.recommendations);
  }
});
```

#### Step 3: 实现showRecommendations方法

```typescript
// src/ui/ChatViewProvider.ts
public showRecommendations(recommendations: any[]): void {
  this.panel?.webview.postMessage({
    type: 'showRecommendations',
    recommendations
  });
}
```

#### Step 4: 前端处理消息

```typescript
// Webview JavaScript
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'showRecommendations') {
    displayRecommendations(message.recommendations);
  }
});
```

---

## 🎯 Phase 2.4: 重构ChatViewProvider为纯视图

### 任务清单

- [ ] 移除ChatViewProvider对MemorySystem的直接调用
- [ ] 改为订阅MessageAddedEvent
- [ ] 只负责渲染，不包含业务逻辑
- [ ] 验证功能正常

### 实施步骤

#### Step 1: 识别业务逻辑

查找ChatViewProvider中的以下调用：
- `memorySystem.executeAction()`
- `episodicMemory.search()`
- 任何直接的记忆操作

#### Step 2: 移除业务逻辑

```typescript
// ❌ 删除
private async handleUserMessage(message: string): Promise<void> {
  await this.memorySystem.executeAction('chat', { userInput: message });
}

// ✅ 改为发布事件
private async handleUserMessage(message: string): Promise<void> {
  const intent = IntentFactory.buildChatIntent(message);
  await this.intentDispatcher.dispatch(intent);
}
```

#### Step 3: 订阅MessageAddedEvent

```typescript
constructor(...) {
  this.eventBus.subscribe(MessageAddedEvent.type, (event) => {
    this.addMessageToChat(event.payload.message);
  });
}
```

#### Step 4: 验证

确保ChatViewProvider只包含：
- UI渲染逻辑
- 事件订阅
- 消息转发

---

## 🎯 Phase 2.5: 删除旧的Command文件

### 任务清单

- [ ] 确认所有Commands已迁移
- [ ] 备份旧Command文件（可选）
- [ ] 删除旧Command文件
- [ ] 更新ESLint规则
- [ ] 验证编译通过

### 需要删除的文件

```
src/commands/
├── ExplainCodeCommand.ts
├── GenerateCommitCommand.ts
├── ChatCommand.ts
├── CheckNamingCommand.ts
├── OptimizeSQLCommand.ts
├── GenerateCodeCommand.ts
├── ConfigureApiKeyCommand.ts
├── ExportMemoryCommand.ts
└── ImportMemoryCommand.ts
```

### ESLint规则

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '../storage/EpisodicMemory',
            message: '请使用IMemoryPort端口，不要直接导入记忆模块'
          },
          {
            name: '../storage/PreferenceMemory',
            message: '请使用IMemoryPort端口，不要直接导入记忆模块'
          }
        ]
      }
    ]
  }
};
```

---

## 🎯 Phase 2.6: 更新测试

### 任务清单

- [ ] 创建IntentDispatcher单元测试
- [ ] 创建MemoryAdapter单元测试
- [ ] 创建端到端集成测试
- [ ] 运行测试套件
- [ ] 修复失败的测试

### 单元测试示例

```typescript
// tests/unit/application/IntentDispatcher.test.ts
describe('IntentDispatcher', () => {
  let dispatcher: IntentDispatcher;
  let mockMemoryPort: jest.Mocked<IMemoryPort>;
  let mockAgentRegistry: jest.Mocked<IAgentRegistry>;
  let mockEventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    mockMemoryPort = { 
      retrieveContext: jest.fn(),
      getAgentPerformance: jest.fn()
    } as any;
    
    mockAgentRegistry = { 
      findAgentsForIntent: jest.fn(),
      getAll: jest.fn()
    } as any;
    
    mockEventBus = { 
      publish: jest.fn(),
      subscribe: jest.fn()
    } as any;
    
    dispatcher = new IntentDispatcher(
      mockMemoryPort, 
      mockAgentRegistry, 
      mockEventBus
    );
  });

  it('should retrieve memory context before selecting agent', async () => {
    const intent = createTestIntent('explain_code');
    mockAgentRegistry.findAgentsForIntent.mockReturnValue([mockAgent]);
    
    await dispatcher.dispatch(intent);
    
    expect(mockMemoryPort.retrieveContext).toHaveBeenCalledWith(intent);
  });

  it('should select agent with highest Wilson score', async () => {
    const agent1 = { id: 'agent1' };
    const agent2 = { id: 'agent2' };
    mockAgentRegistry.findAgentsForIntent.mockReturnValue([agent1, agent2]);
    
    mockMemoryPort.getAgentPerformance
      .mockResolvedValueOnce({ totalAttempts: 10, successCount: 9, avgDurationMs: 1000 })
      .mockResolvedValueOnce({ totalAttempts: 10, successCount: 5, avgDurationMs: 2000 });
    
    await dispatcher.dispatch(createTestIntent('explain_code'));
    
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent1' })
    );
  });
});
```

### 集成测试示例

```typescript
// tests/integration/IntentToAgentExecution.test.ts
describe('Intent to Agent Execution Flow', () => {
  it('should complete full flow: explain_code -> Agent -> memory recorded', async () => {
    const intent = createExplainCodeIntent();
    
    await intentDispatcher.dispatch(intent);
    
    // 等待异步完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 验证记忆已记录
    const memories = await episodicMemory.retrieve({ 
      taskType: 'CODE_EXPLAIN', 
      limit: 1 
    });
    
    expect(memories[0].summary).toContain('解释了');
  });
});
```

---

## 📊 进度跟踪

### Phase 2.1: Commands迁移
- [ ] explainCode
- [ ] generateCommit
- [ ] chat
- [ ] checkNaming
- [ ] optimizeSQL
- [ ] generateCode
- [ ] configureApiKey
- [ ] exportMemory
- [ ] importMemory

### Phase 2.2-2.6: 其他任务
- [ ] 添加ChatAgent
- [ ] 订阅MemoryRecommendEvent
- [ ] 重构ChatViewProvider
- [ ] 删除旧Command文件
- [ ] 更新测试

---

## ⚠️ 风险与缓解

### 风险1: 功能不一致
**缓解**: 
- 保留旧Commands作为fallback
- 逐项对比新旧实现
- 充分的回归测试

### 风险2: 性能下降
**缓解**:
- 监控IntentDispatcher耗时
- 优化检索策略
- 缓存常用数据

### 风险3: 测试覆盖不足
**缓解**:
- 创建完整的单元测试
- 添加集成测试
- 手动测试关键路径

---

## 🎯 验收标准

### 功能验收
- [ ] 所有9个Commands正常工作
- [ ] 功能与旧架构完全一致
- [ ] 无回归bug

### 技术验收
- [ ] 编译通过（0错误，0警告）
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] ESLint检查通过

### 架构验收
- [ ] 所有Commands通过IntentDispatcher调度
- [ ] 无直接导入记忆模块的代码
- [ ] ChatViewProvider为纯视图
- [ ] 旧Command文件已删除

---

## 🚀 开始执行

**建议顺序**:
1. Phase 2.1 (Commands迁移) - 核心任务
2. Phase 2.2 (添加ChatAgent) - 完善降级策略
3. Phase 2.3 (MemoryRecommendEvent) - 增强功能
4. Phase 2.4 (ChatViewProvider重构) - 清理架构
5. Phase 2.5 (删除旧文件) - 清理代码
6. Phase 2.6 (更新测试) - 质量保障

**是否需要我立即开始Phase 2.1：修改registerCommands使用IntentDispatcher？**
