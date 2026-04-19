# Phase 2.5 重构进度报告（进行中）

**执行时间**: 2026-04-14  
**状态**: 🔄 进行中（ChatAgent已完成，ChatViewProvider待重构）

---

## ✅ 已完成工作

### 1. MemoryContext扩展

**文件**: `src/core/domain/MemoryContext.ts`

**变更**: 添加sessionHistory字段支持多轮对话

```typescript
export interface MemoryContext {
  episodicMemories: EpisodicMemoryItem[];
  preferenceRecommendations: PreferenceRecommendation[];
  userPreferences?: { ... };
  /** 会话历史（用于多轮对话） */
  sessionHistory?: Array<{ role: string; content: string }>;  // ✅ 新增
  originalQuery?: string;
  retrievalDuration?: number;
}
```

---

### 2. IntentFactory扩展

**文件**: `src/core/factory/IntentFactory.ts`

**变更**: buildChatIntent支持sessionId参数

```typescript
static buildChatIntent(userInput: string, options?: { sessionId?: string }): Intent {
  return {
    name: 'chat',
    userInput,
    codeContext: editor ? this.extractCodeContext(editor, undefined, 5000) : undefined,
    metadata: {
      timestamp: Date.now(),
      source: 'chat',
      sessionId: options?.sessionId || this.generateSessionId()  // ✅ 支持自定义sessionId
    }
  };
}
```

---

### 3. ChatAgent完整实现

**文件**: `src/agents/ChatAgent.ts`

**关键改进**:

#### 3.1 依赖注入修复

```typescript
@injectable()
export class ChatAgent implements IAgent {
  constructor(
    @inject('ILLMPort') private llmPort: ILLMPort,
    @inject('IMemoryPort') private memoryPort: IMemoryPort,
    @inject('IEventBus') private eventBus: IEventBus  // ✅ 正确注入
  ) {}
}
```

**之前的问题**: 直接`new EventBus()`违反依赖注入原则  
**现在的方案**: 通过tsyringe容器注入IEventBus

---

#### 3.2 流式响应支持

```typescript
async execute(params: { intent: Intent; memoryContext: MemoryContext }): Promise<AgentResult> {
  const messageId = `msg_${Date.now()}_assistant`;
  let fullContent = '';

  // 调用LLM流式接口
  await this.llmPort.callStream(
    {
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      maxTokens: 2000
    },
    (chunk: string) => {
      fullContent += chunk;
      // TODO: 发布流式块事件
      // this.eventBus.publish(new StreamChunkEvent(messageId, chunk));
    }
  );

  // 发布完整响应
  this.eventBus.publish(new AssistantResponseEvent({
    messageId,
    content: fullContent,
    timestamp: Date.now()
  }));

  return { success: true, data: { messageId, content: fullContent } };
}
```

---

#### 3.3 多轮对话支持

```typescript
private buildMessageHistory(memoryContext: MemoryContext): LLMMessage[] {
  // 从记忆上下文中获取会话历史
  const sessionHistory = memoryContext.sessionHistory || [];
  
  // 转换为LLM所需格式，限制最多10条
  return sessionHistory
    .slice(-10)
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
}
```

**关键点**: 
- 从memoryContext.sessionHistory读取
- 限制最多10条历史消息（避免token溢出）
- 转换为LLM所需的格式

---

#### 3.4 增强的系统提示

```typescript
private buildSystemPrompt(intent: Intent, memoryContext: MemoryContext): string {
  const parts: string[] = [];

  // 1. 基础角色设定
  parts.push('你是小尾巴，一个智能编程助手。回答要简洁、准确、有帮助。');

  // 2. 编辑器上下文（如果有）
  if (intent.codeContext) {
    parts.push('\n## 当前编辑器上下文');
    parts.push(`- 文件：${intent.codeContext.filePath}`);
    parts.push(`- 语言：${intent.codeContext.language}`);
    if (intent.codeContext.selectedCode) {
      parts.push(`- 选中代码：\n\`\`\`${intent.codeContext.language}\n${intent.codeContext.selectedCode}\n\`\`\``);
    }
  }

  // 3. 相关情景记忆
  if (memoryContext.episodicMemories && memoryContext.episodicMemories.length > 0) {
    parts.push('\n## 相关历史操作');
    memoryContext.episodicMemories.slice(0, 3).forEach(mem => {
      parts.push(`- ${mem.summary}`);
    });
  }

  // 4. 用户偏好
  if (memoryContext.preferenceRecommendations && memoryContext.preferenceRecommendations.length > 0) {
    parts.push('\n## 用户偏好');
    memoryContext.preferenceRecommendations.slice(0, 2).forEach(pref => {
      parts.push(`- ${pref.domain}: ${JSON.stringify(pref.pattern)} (置信度: ${(pref.confidence * 100).toFixed(0)}%)`);
    });
  }

  // 5. 回答指令
  parts.push('\n## 回答要求');
  parts.push('- 如果问题涉及代码，请提供代码示例');
  parts.push('- 回答要简洁，避免冗长');
  parts.push('- 如果引用了历史记忆，请自然提及');

  return parts.join('\n');
}
```

**改进点**:
- ✅ 使用intent.codeContext（而非memoryContext.codeContext）
- ✅ 整合episodicMemories和preferenceRecommendations
- ✅ 结构化的提示模板

---

### 4. extension.ts更新

**文件**: `src/extension.ts`

**变更**: ChatAgent注册时传入eventBusAdapter

```typescript
agentRegistry.register(new ChatAgent(llmAdapter, memoryAdapter, eventBusAdapter));
```

---

## ⏸️ 待完成工作

### Phase 2.5.3: 重构ChatViewProvider为纯视图层

**目标**: 将ChatViewProvider改造为只依赖IEventBus和IntentDispatcher的纯视图层

**具体任务**:

1. **清理构造函数依赖**
   - 移除SessionManager、ContextBuilder、PromptEngine等
   - 只保留IEventBus、IntentDispatcher、ExtensionContext

2. **订阅领域事件**
   ```typescript
   private subscribeToDomainEvents(): void {
     this.eventBus.subscribe(AssistantResponseEvent.type, (event) => {
       this.view?.webview.postMessage({
         type: 'addMessage',
         message: {
           id: event.messageId,
           role: 'assistant',
           content: event.content,
           timestamp: event.timestamp
         }
       });
     });
   }
   ```

3. **重构用户消息处理**
   ```typescript
   private async handleUserInput(text: string): Promise<void> {
     // 1. 乐观更新UI
     const userMessage = { role: 'user', content: text };
     this.view?.webview.postMessage({ type: 'addMessage', message: userMessage });
     
     // 2. 构建并调度意图
     const intent = IntentFactory.buildChatIntent(text, {
       sessionId: this.getCurrentSessionId()
     });
     await this.intentDispatcher.dispatch(intent);
   }
   ```

4. **简化Webview消息处理**
   - sendMessage → handleUserInput
   - newSession/switchSession/deleteSession → 调度对应意图
   - feedback → 发布FeedbackGivenEvent

---

### Phase 2.5.4: 删除ChatService

- 确认ChatService未被其他地方引用
- 删除`src/chat/ChatService.ts`
- 清理相关导入

---

### Phase 2.5.5: 移除ESLint例外

- 从`.eslintrc.js`中移除chat目录的overrides
- 运行ESLint验证无违规

---

## 🔍 架构对齐检查

| 约束项 | ChatAgent状态 | ChatViewProvider状态 |
|--------|--------------|---------------------|
| 使用端口接口 | ✅ ILLMPort, IMemoryPort, IEventBus | ⏸️ 待重构 |
| 构造函数注入 | ✅ tsyringe注入 | ⏸️ 待重构 |
| 无直接导入具体实现 | ✅ 未导入EpisodicMemory、LLMTool | ❌ 仍持有多个直接依赖 |
| 通过EventBus通信 | ✅ 发布AssistantResponseEvent | ⏸️ 待实现 |
| 符合IAgent接口 | ✅ 完整实现 | N/A |
| 命名规范 | ✅ chat_agent | N/A |

---

## 📊 编译验证

```bash
npm run compile
```

**结果**: ✅ 通过  
**错误数**: 0  
**警告数**: 0

---

## 🎯 下一步行动

### 立即执行（高优先级）

**Phase 2.5.3: 重构ChatViewProvider**

这是核心任务，预计需要1-2小时。完成后：
- ChatViewProvider将成为纯视图层
- 所有业务逻辑移至ChatAgent
- 完全符合端口-适配器架构

### 后续任务

1. **Phase 2.5.4**: 删除ChatService
2. **Phase 2.5.5**: 移除ESLint对chat目录的例外
3. **Phase 2.6**: 更新集成测试

---

## 💡 关键技术决策

### 决策1: EventBus的使用方式

**问题**: IEventBus.publish接受DomainEvent对象，还是类型+载荷？

**答案**: IEventBus.publish接受DomainEvent对象

```typescript
// ✅ 正确用法
this.eventBus.publish(new AssistantResponseEvent({
  messageId,
  content: fullContent,
  timestamp: Date.now()
}));

// ❌ 错误用法（这是EventBus类的用法）
this.eventBus.publish(CoreEventType.ASSISTANT_RESPONSE, { ... });
```

**原因**: 
- IEventBus是端口接口，使用DomainEvent基类
- EventBus是具体实现，使用类型+载荷的方式
- 应用层应依赖端口接口

---

### 决策2: 流式响应的实现

**现状**: ChatAgent已实现流式调用，但未发布StreamChunkEvent

**原因**: StreamChunkEvent尚未定义

**计划**: 
- 在DomainEvent.ts中添加StreamChunkEvent
- 在CoreEventType中添加STREAM_CHUNK类型
- 在ChatViewProvider中订阅并处理流式块

---

### 决策3: 会话历史的来源

**问题**: memoryContext.sessionHistory从哪里来？

**当前状态**: MemoryContext已添加sessionHistory字段，但MemoryAdapter尚未填充

**解决方案选项**:

**选项A**: 在MemoryAdapter.retrieveContext中填充
- 根据intent.metadata.sessionId查询会话历史
- 从SessionManager或数据库中读取

**选项B**: 在IntentFactory.buildChatIntent时传递
- ChatViewProvider维护会话历史
- 通过某种方式传递给MemoryAdapter

**推荐**: 选项A（符合架构设计，由基础设施层负责数据检索）

---

## 📝 审阅要点

请在继续前确认：

1. **ChatAgent的实现是否符合预期？**
   - 依赖注入是否正确？
   - 流式响应是否合理？
   - 系统提示是否完整？

2. **是否继续执行Phase 2.5.3（重构ChatViewProvider）？**
   - 这是一个较大的改动
   - 会影响聊天功能的核心流程
   - 建议先备份当前代码

3. **是否需要先实现StreamChunkEvent？**
   - 当前流式响应的chunk未被发布
   - UI无法显示流式效果
   - 可以稍后补充

---

**请指示下一步行动！** 🚀
