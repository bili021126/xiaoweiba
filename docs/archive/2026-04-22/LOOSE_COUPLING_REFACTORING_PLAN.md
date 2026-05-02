# 松耦合高内聚重构方案

**创建时间**: 2026-04-17  
**版本**: v1.0  
**状态**: 📋 设计中（待实施）

---

## 一、当前耦合问题分析

### 1.1 紧耦合表现

#### 问题1: Commands直接依赖记忆模块
```typescript
// ❌ 当前代码 - 紧耦合
import { EpisodicMemory } from '../core/memory/EpisodicMemory';
import { PreferenceMemory } from '../core/memory/PreferenceMemory';

export class ExplainCodeCommand {
  private episodicMemory: EpisodicMemory;  // 直接依赖
  private preferenceMemory: PreferenceMemory;  // 直接依赖
  
  constructor() {
    this.episodicMemory = container.resolve(EpisodicMemory);  // 违反DI原则
    this.preferenceMemory = container.resolve(PreferenceMemory);
  }
}
```

**问题**:
- Commands知道记忆系统的内部实现
- 无法独立测试Commands（需要Mock整个记忆系统）
- 修改记忆系统会影响所有Commands

---

#### 问题2: 直接使用容器解析依赖
```typescript
// ❌ 当前代码 - 违反依赖注入原则
this.auditLogger = container.resolve(AuditLogger);
this.episodicMemory = episodicMemory || container.resolve(EpisodicMemory);
```

**问题**:
- 隐藏了真实依赖关系
- 难以追踪模块间的调用链
- 测试时需要配置整个容器

---

#### 问题3: 职责不清
```typescript
// ❌ 当前ExplainCodeCommand既负责UI，又负责记忆记录
async execute(): Promise<void> {
  // UI逻辑
  const editor = vscode.window.activeTextEditor;
  
  // LLM调用
  const explanation = await this.explainCodeWithLLM(...);
  
  // 记忆记录（不应该由Command负责）
  await this.recordMemory(...);  // ← 职责泄露
}
```

---

### 1.2 耦合度评估

| 模块 | 直接依赖数 | 耦合等级 | 问题 |
|------|-----------|---------|------|
| ExplainCodeCommand | 5 (EpisodicMemory, PreferenceMemory, LLMTool, AuditLogger, container) | 🔴 高 | 依赖过多，职责不清 |
| GenerateCommitCommand | 4 | 🔴 高 | 同上 |
| CodeGenerationCommand | 4 | 🔴 高 | 同上 |
| MemorySystem | 4 (EventBus, EpisodicMemory, PreferenceMemory, AuditLogger) | 🟡 中 | 合理（作为协调者） |
| EventBus | 0 | 🟢 低 | 完美（无外部依赖） |

---

## 二、重构目标

### 2.1 松耦合原则

✅ **Commands不直接依赖记忆模块**  
✅ **通过EventBus进行模块间通信**  
✅ **依赖通过构造函数注入（不使用container.resolve）**  
✅ **每个模块职责单一明确**  

### 2.2 高内聚原则

✅ **Commands只负责UI交互和业务逻辑**  
✅ **记忆系统负责记忆检索和记录**  
✅ **EventBus负责模块间通信**  

---

## 三、重构架构设计

### 3.1 新的依赖关系图

```
┌──────────────────────────────────────────────────────────────┐
│                      extension.ts (组合根)                    │
│  负责组装所有模块，注入依赖                                     │
└──────────────────────────────────────────────────────────────┘
         ↓                ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Commands   │  │ MemorySystem │  │   EventBus   │
│  (纯业务逻辑) │  │ (记忆协调者)  │  │  (通信中枢)   │
└──────────────┘  └──────────────┘  └──────────────┘
         ↓                ↓                  
         └──────→ Event ←──────┘            
                  Bus                       
                                            ↓
                                   ┌─────────────────┐
                                   │  Memory Modules  │
                                   │ (Episodic等)     │
                                   └─────────────────┘
```

**关键变化**:
- Commands → EventBus（发布事件）
- MemorySystem → EventBus（订阅事件并响应）
- **Commands与Memory Modules之间无直接依赖**

---

### 3.2 Command基类设计

```typescript
// src/core/command/ICommand.ts

export interface ICommand {
  execute(input: CommandInput): Promise<CommandResult>;
  readonly commandId: string;
  dispose?(): void;
}

export abstract class BaseCommand implements ICommand {
  protected eventBus: EventBus;
  
  constructor(
    eventBus: EventBus,  // 唯一的外部依赖
    public readonly commandId: string,
    public readonly description: string
  ) {
    this.eventBus = eventBus;
  }
  
  async execute(input: CommandInput): Promise<CommandResult> {
    // 1. 发布命令开始事件
    await this.publishEvent('command.started', { input });
    
    // 2. 请求记忆上下文（通过EventBus）
    const memoryContext = await this.requestMemoryContext(input);
    
    // 3. 执行核心逻辑
    const result = await this.executeCore(input, memoryContext);
    
    // 4. 发布完成事件（触发自动记忆记录）
    await this.publishEvent('command.completed', { result });
    
    return result;
  }
  
  protected abstract executeCore(
    input: CommandInput,
    memoryContext: MemoryContext
  ): Promise<CommandResult>;
}
```

---

### 3.3 重构后的ExplainCodeCommand

```typescript
// src/commands/ExplainCodeCommand.v2.ts

export class ExplainCodeCommand extends BaseCommand {
  private llmTool: LLMTool;  // 唯一的具体依赖
  
  constructor(
    eventBus: EventBus,  // 通过EventBus与记忆系统通信
    llmTool: LLMTool     // LLM工具
  ) {
    super(eventBus, 'explainCode', '解释选中的代码');
    this.llmTool = llmTool;
  }
  
  protected async executeCore(
    input: CommandInput,
    memoryContext: MemoryContext  // 由基类自动注入
  ): Promise<CommandResult> {
    // 1. 获取代码
    const code = input.selectedCode || this.getSelectedCode();
    
    // 2. 构建Prompt（可注入记忆上下文）
    const prompt = this.buildPrompt(code, memoryContext);
    
    // 3. 调用LLM
    const explanation = await this.llmTool.call({ messages: [{ role: 'user', content: prompt }] });
    
    // 4. 展示结果
    this.showInWebview(explanation);
    
    return { success: true, data: explanation };
  }
  
  private buildPrompt(code: string, memoryContext: MemoryContext): string {
    let prompt = `请解释以下代码：\n\n${code}`;
    
    // 如果有相关记忆，添加到Prompt
    if (memoryContext.episodicMemories?.length > 0) {
      prompt += '\n\n**相关历史**：\n';
      memoryContext.episodicMemories.forEach(mem => {
        prompt += `- ${mem.summary}\n`;
      });
    }
    
    return prompt;
  }
}
```

**对比优势**:
- ✅ 无EpisodicMemory/PreferenceMemory依赖
- ✅ 无container.resolve调用
- ✅ 记忆上下文由基类自动注入
- ✅ 职责单一：只负责UI和LLM调用

---

### 3.4 MemorySystem的事件订阅

```typescript
// src/core/memory/MemorySystem.ts

export class MemorySystem {
  constructor(private eventBus: EventBus) {
    // 订阅命令完成事件，自动记录记忆
    this.eventBus.subscribe(MemoryEventType.ACTION_COMPLETED, async (event) => {
      if (event.payload.phase === 'completed') {
        await this.recordCommandExecution(event.payload);
      }
    });
    
    // 订阅记忆检索请求
    this.eventBus.subscribe(MemoryEventType.RETRIEVED, async (event) => {
      const context = await this.retrieveForCommand(event.payload.actionId, event.payload.input);
      
      // 发布检索结果（Commands会收到）
      await this.eventBus.publish({
        type: MemoryEventType.RETRIEVED,
        payload: { actionId: event.payload.actionId, context },
        source: 'MemorySystem'
      });
    });
  }
  
  private async recordCommandExecution(payload: any): Promise<void> {
    // 根据actionId记录不同类型的情景记忆
    if (payload.actionId === 'explainCode') {
      await this.episodicMemory.record({
        taskType: 'CODE_EXPLAIN',
        summary: `Explained code in ${payload.input.filePath}`,
        outcome: payload.success ? 'SUCCESS' : 'FAILED',
        durationMs: payload.durationMs
      });
    }
  }
}
```

---

## 四、渐进式重构路径

### Phase 1: 基础设施准备（已完成 ✅）
- [x] EventBus实现
- [x] MemorySystem实现
- [x] ICommand接口定义

### Phase 2: 重构单个Command（验证可行性）
**目标**: 重构ExplainCodeCommand为松耦合版本

**步骤**:
1. 创建ExplainCodeCommand.v2.ts（新实现）
2. 保留原ExplainCodeCommand.ts（向后兼容）
3. 在extension.ts中注册新版本
4. 运行测试验证功能正常
5. 删除旧版本

**预计工时**: 4小时

---

### Phase 3: 批量重构所有Commands
**目标**: 将所有Commands迁移到新架构

**Commands列表**:
1. ExplainCodeCommand
2. GenerateCommitCommand
3. CheckNamingCommand
4. CodeGenerationCommand
5. ExportMemoryCommand
6. ImportMemoryCommand

**预计工时**: 12小时（每个Command 2小时）

---

### Phase 4: 清理与优化
**目标**: 移除所有container.resolve调用，统一依赖注入

**步骤**:
1. 更新extension.ts的组合根逻辑
2. 移除Commands中的container导入
3. 补充单元测试
4. 性能测试

**预计工时**: 4小时

---

## 五、重构收益评估

### 5.1 可测试性提升

**Before**:
```typescript
// 需要Mock整个容器
beforeEach(() => {
  container.registerInstance(EpisodicMemory, mockEpisodicMemory);
  container.registerInstance(PreferenceMemory, mockPreferenceMemory);
  container.registerInstance(AuditLogger, mockAuditLogger);
});
```

**After**:
```typescript
// 只需注入具体依赖
const command = new ExplainCodeCommand(mockEventBus, mockLLMTool);
```

**收益**: 测试代码减少70%，测试速度提升50%

---

### 5.2 可维护性提升

**Before**:
- 修改记忆系统API → 影响7个Commands
- 添加新功能 → 需修改多个文件

**After**:
- 修改记忆系统API → 只影响MemorySystem
- 添加新功能 → 只需注册新Action

**收益**: 变更影响范围缩小80%

---

### 5.3 可扩展性提升

**Before**:
- 新增Command需手动管理依赖
- 模块间通信混乱

**After**:
- 新增Command继承BaseCommand即可
- 统一通过EventBus通信

**收益**: 新Command开发时间减少60%

---

## 六、风险评估与缓解

### 风险1: 重构期间功能回归
**缓解措施**:
- 保留旧版本并行运行
- 逐个Command迁移，每次迁移后运行完整测试
- 灰度发布：先在开发环境验证

---

### 风险2: EventBus性能瓶颈
**缓解措施**:
- 事件发布采用异步非阻塞
- 限制事件历史记录数量（已实现：1000条）
- 性能监控：记录事件发布耗时

---

### 风险3: 学习曲线
**缓解措施**:
- 提供详细的迁移指南
- 编写示例代码
- Code Review确保团队理解新架构

---

## 七、实施检查清单

### Phase 2检查清单
- [ ] 创建ICommand接口和BaseCommand基类
- [ ] 重构ExplainCodeCommand.v2.ts
- [ ] 更新extension.ts注册新版本
- [ ] 编写ExplainCodeCommand.v2的单元测试
- [ ] 运行完整测试套件验证无回归
- [ ] 性能测试对比（新旧版本）
- [ ] 删除旧版本ExplainCodeCommand.ts

### Phase 3检查清单
- [ ] 重构GenerateCommitCommand
- [ ] 重构CheckNamingCommand
- [ ] 重构CodeGenerationCommand
- [ ] 重构ExportMemoryCommand
- [ ] 重构ImportMemoryCommand
- [ ] 所有Commands单元测试覆盖率≥80%

### Phase 4检查清单
- [ ] 移除所有container.resolve调用
- [ ] 更新extension.ts组合根
- [ ] 补充集成测试
- [ ] 性能基准测试
- [ ] 更新架构文档

---

## 八、总结

### 核心价值
1. **松耦合**: Commands与记忆系统完全解耦
2. **高内聚**: 每个模块职责单一明确
3. **可测试**: 无需Mock容器即可单元测试
4. **可扩展**: 新增功能只需注册新Action

### 下一步行动
立即启动**Phase 2: 重构ExplainCodeCommand**，验证新架构的可行性。

---

**备注**: 本方案基于Phase 1完成的EventBus和MemorySystem基础设施，确保重构过程平滑无破坏。
