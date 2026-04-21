# 小尾巴 L1+L2 渐进式增强实施计划

## 📋 Context（背景）

用户希望分阶段提升小尾巴的记忆和上下文感知能力，采用"甜点优先、预研跟进、体验沉淀"的三步走策略：

**第一步（本周）- L1 感知增强**：实现 ContextEnricher，让AI真正"看到"用户的屏幕
**第二步（下周）- L2 语义向量检索预研**：集成Embedding模型，实现真正的向量相似度搜索
**第三步（之后两周）- 体验期**：暂停开发，像普通用户一样使用产品，记录痛点

这个计划符合项目的核心原则：**记忆为核、渐进式智能、先体验后优化**。

---

## 🎯 当前状态评估

### ✅ 已有基础设施
- IntentAnalyzer - 意图向量分析器（已实现但未在IntentFactory中使用）
- IndexManager - 倒排索引管理
- SearchEngine - 多维度评分引擎（但使用的是Jaccard相似度，非真向量）
- EpisodicMemory表有`vector BLOB`字段（预留但未使用）
- ConfigManager - 完善的配置管理系统

### ❌ 缺失的关键能力
- **L1缺口**：Intent metadata缺少intentVector，ChatAgent未利用意图信息动态调整提示词
- **L2缺口**：没有真正的Embedding服务，record()未计算向量，searchSemantic()使用词项匹配而非余弦相似度

### 📊 工作量评估
- **L1 ContextEnricher**: 🟢 低（2-3小时）
- **L2 基础向量检索**: 🟡 中高（2-3天）

---

## 🚀 Phase 1: L1 感知增强（本周完成）

### 目标
创建ContextEnricher采集编辑器上下文，在Intent构建时注入intentVector，让ChatAgent能根据意图动态调整系统提示词。

**验收标准**：当用户问"解释这段代码"时，AI回答会提到"在你打开的UserService.java的第42行..."，产生"她真的在看我的屏幕"的正反馈。

### 实施步骤

#### Step 1.1: 扩展Intent元数据结构

**文件**: `src/core/domain/Intent.ts`

**修改内容**：
```typescript
export interface IntentMetadata {
  timestamp: number;
  source: 'command' | 'chat' | 'auto' | 'inline_completion';
  sessionId?: string;
  
  // ✅ L1新增：意图向量
  intentVector?: {
    temporal: number;          // 时间敏感度 (0-1)
    entity: number;            // 实体敏感度 (0-1)
    semantic: number;          // 语义复杂度 (0-1)
    distantTemporal: number;   // 远期时间依赖 (0-1)
  };
  
  // ✅ L1新增：查询特征
  complexity?: 'simple' | 'moderate' | 'complex';  // 查询复杂度
  requiresCodeContext?: boolean;  // 是否需要代码上下文
}
```

**理由**：为Intent增加意图向量和查询特征，让下游Agent能感知用户意图的细微差别。

---

#### Step 1.2: 创建ContextEnricher工具类

**新建文件**: `src/core/context/ContextEnricher.ts`

**职责**：
- 采集当前编辑器状态（文件路径、语言、选中代码、光标位置）
- 提取项目级上下文（工作区根目录、技术栈标识）
- 生成结构化的enrichedContext对象

**核心方法**：
```typescript
export class ContextEnricher {
  /**
   * 从VS Code编辑器提取丰富的上下文信息
   */
  static async enrichFromEditor(): Promise<EnrichedContext | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    
    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);
    
    return {
      filePath: document.fileName,
      fileName: path.basename(document.fileName),
      language: document.languageId,
      workspaceRoot: this.getWorkspaceRoot(document.uri),
      cursorPosition: {
        line: selection.active.line + 1,  // 1-based
        character: selection.active.character
      },
      selectedCode: selectedText || undefined,
      selectedRange: selectedText ? {
        start: selection.start.line + 1,
        end: selection.end.line + 1
      } : undefined,
      fullFileContent: document.getText().substring(0, 10000),  // 限制10KB
      projectTechStack: this.detectTechStack(document.uri)
    };
  }
  
  private static getWorkspaceRoot(uri: vscode.Uri): string | undefined {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath;
  }
  
  private static detectTechStack(uri: vscode.Uri): string[] {
    // 简单启发式检测：检查package.json、requirements.txt等
    // 返回 ['typescript', 'react', 'nodejs'] 等
  }
}

export interface EnrichedContext {
  filePath: string;
  fileName: string;
  language: string;
  workspaceRoot?: string;
  cursorPosition?: { line: number; character: number };
  selectedCode?: string;
  selectedRange?: { start: number; end: number };
  fullFileContent?: string;
  projectTechStack?: string[];
}
```

**理由**：将上下文提取逻辑封装为独立工具，便于复用和测试。

---

#### Step 1.3: 修改IntentFactory注入intentVector

**文件**: `src/core/factory/IntentFactory.ts`

**修改内容**：

1. 导入依赖：
```typescript
import { IntentAnalyzer } from '../memory/IntentAnalyzer';
import { ContextEnricher } from '../context/ContextEnricher';
```

2. 修改buildChatIntent方法：
```typescript
static buildChatIntent(userInput: string, options?: { sessionId?: string }): Intent {
  const editor = vscode.window.activeTextEditor;
  
  // ✅ L1新增：分析意图向量
  const intentAnalyzer = new IntentAnalyzer();
  const intentVector = intentAnalyzer.analyze(userInput);
  
  // ✅ L1新增：提取丰富上下文
  const enrichedContext = editor ? ContextEnricher.enrichFromEditor() : undefined;
  
  return {
    name: 'chat',
    userInput,
    codeContext: editor ? this.extractCodeContext(editor) : undefined,
    metadata: {
      timestamp: Date.now(),
      source: 'chat',
      sessionId: options?.sessionId || this.generateSessionId(),
      intentVector,  // ✅ 新增
      complexity: this.assessComplexity(userInput),  // ✅ 新增
      requiresCodeContext: this.needsCodeContext(userInput)  // ✅ 新增
    },
    enrichedContext  // ✅ 新增：挂载完整上下文
  };
}

// ✅ 新增辅助方法
private static assessComplexity(input: string): 'simple' | 'moderate' | 'complex' {
  const wordCount = input.split(/\s+/).length;
  if (wordCount < 5) return 'simple';
  if (wordCount < 15) return 'moderate';
  return 'complex';
}

private static needsCodeContext(input: string): boolean {
  const codeKeywords = ['代码', '函数', '类', '变量', '解释', '重构', 'bug', '错误'];
  return codeKeywords.some(keyword => input.includes(keyword));
}
```

3. 对其他Intent构建方法做类似修改（buildExplainCodeIntent、buildGenerateCodeIntent等）

**理由**：在Intent构建阶段就完成意图分析和上下文提取，为后续Agent执行提供充足信号。

---

#### Step 1.4: 修改ChatAgent利用enrichedContext

**文件**: `src/agents/ChatAgent.ts`

**修改内容**：

1. 修改buildSystemPrompt方法，增强编辑器上下文展示：
```typescript
private buildSystemPrompt(intent: Intent, memoryContext: MemoryContext): string {
  const parts: string[] = [];
  
  // 1. 基础角色设定
  parts.push('你是小尾巴，一个智能编程助手...');
  
  // ✅ L1改进：更详细的编辑器上下文
  if (intent.enrichedContext) {
    parts.push('\n## 当前工作环境');
    parts.push(`- 文件：${this.escapeHtml(intent.enrichedContext.fileName)}`);
    parts.push(`- 路径：${this.escapeHtml(intent.enrichedContext.filePath)}`);
    parts.push(`- 语言：${this.escapeHtml(intent.enrichedContext.language)}`);
    
    if (intent.enrichedContext.cursorPosition) {
      parts.push(`- 光标位置：第 ${intent.enrichedContext.cursorPosition.line} 行`);
    }
    
    if (intent.enrichedContext.selectedCode) {
      const { selectedCode, language, selectedRange } = intent.enrichedContext;
      parts.push(`- 选中代码（第${selectedRange!.start}-${selectedRange!.end}行）：`);
      parts.push(`\`\`\`${language}\n${this.escapeHtml(selectedCode)}\n\`\`\``);
    }
    
    if (intent.enrichedContext.projectTechStack?.length) {
      parts.push(`- 项目技术栈：${intent.enrichedContext.projectTechStack.join(', ')}`);
    }
  } else if (intent.codeContext) {
    // 降级：使用旧的codeContext
    parts.push('\n## 当前编辑器上下文');
    parts.push(`- 文件：${this.escapeHtml(intent.codeContext.filePath || '未知文件')}`);
    parts.push(`- 语言：${this.escapeHtml(intent.codeContext.language || 'unknown')}`);
    if (intent.codeContext.selectedCode) {
      parts.push(`- 选中代码：\n\`\`\`${intent.codeContext.language}\n${this.escapeHtml(intent.codeContext.selectedCode)}\n\`\`\``);
    }
  }
  
  // ✅ L1新增：根据意图向量调整指令
  if (intent.metadata.intentVector) {
    const { temporal, entity, semantic } = intent.metadata.intentVector;
    
    if (temporal > 0.7) {
      parts.push('\n## ⏰ 时间敏感查询');
      parts.push('用户关注最近的记忆，请优先引用近期操作。');
    }
    
    if (entity > 0.7) {
      parts.push('\n## 🎯 实体敏感查询');
      parts.push('用户提到了具体的代码实体，请精确匹配文件名、函数名等。');
    }
    
    if (semantic > 0.7) {
      parts.push('\n## 🧠 复杂语义查询');
      parts.push('用户的问题较为复杂，需要深入理解代码逻辑和架构。');
    }
  }
  
  // 3. 相关情景记忆（最多3条）
  if (memoryContext.episodicMemories?.length > 0) {
    parts.push('\n## 相关历史操作');
    memoryContext.episodicMemories.slice(0, 3).forEach(mem => {
      parts.push(`- ${this.escapeHtml(mem.summary)}`);
    });
  }
  
  // 4. 用户偏好（最多2条）
  if (memoryContext.preferenceRecommendations?.length > 0) {
    parts.push('\n## 用户偏好');
    memoryContext.preferenceRecommendations.slice(0, 2).forEach(pref => {
      parts.push(`- ${pref.domain}: ${JSON.stringify(pref.pattern)} (置信度: ${pref.confidence}%)`);
    });
  }
  
  // 5. 回答指令
  parts.push('\n## 回答要求');
  parts.push('- 如果问题涉及代码，请提供代码示例');
  parts.push('- 回答要简洁，避免冗长');
  parts.push('- 如果引用了历史记忆，请自然提及（例如："我记得你昨天修改了UserService.java..."）');
  parts.push('- 提到文件时，使用文件名+行号格式（例如："UserService.java第42行"）');
  
  return parts.join('\n');
}
```

**理由**：利用enrichedContext提供更精确的上下文信息，利用intentVector动态调整提示词策略。

---

#### Step 1.5: 更新MemoryContext支持新字段

**文件**: `src/core/domain/MemoryContext.ts`

**修改内容**：
```typescript
export interface EpisodicMemoryItem {
  id: string;
  summary: string;
  taskType: string;
  timestamp: number;
  entities: string[];
  
  // ✅ L1新增
  similarityScore?: number;      // 相似度分数 (0-1)
  retrievalStrategy?: string;    // 检索策略 (balanced/temporal/entity/semantic)
  confidence?: number;           // 置信度 (0-100)
  memoryTier?: 'SHORT_TERM' | 'LONG_TERM';
  finalWeight?: number;          // 最终权重
}
```

**理由**：让Agent能获取记忆的更多信息，做出更智能的决策。

---

#### Step 1.6: 编写单元测试

**新建文件**: `tests/unit/core/context/ContextEnricher.test.ts`

**测试用例**：
1. enrichFromEditor - 无编辑器时返回null
2. enrichFromEditor - 有编辑器时正确提取信息
3. enrichFromEditor - 正确处理选中代码
4. enrichFromEditor - 正确检测技术栈

**运行测试**：
```bash
npm run test:unit -- ContextEnricher
```

---

### L1验收清单

- [ ] Intent metadata包含intentVector字段
- [ ] ChatAgent能显示文件名+行号
- [ ] 系统提示词根据意图向量动态调整
- [ ] 所有单元测试通过
- [ ] 手动测试：问"解释这段代码"，AI回答提到具体文件和行号

---

## 🔬 Phase 2: L2 语义向量检索预研（下周启动）

### 目标
探索并实现真正的向量嵌入和相似度搜索，替代当前的词项匹配。不求完美，只求探明技术路线。

**验收标准**：
1. 能调用Embedding API将文本转为向量
2. EpisodicMemory.record()能存储向量
3. searchSemantic()使用余弦相似度而非Jaccard
4. 配置开关`memory.enableVectorSearch`可控制启用/禁用

---

### 实施步骤

#### Step 2.1: 环境准备 - 安装依赖

**命令**：
```bash
npm install openai hnswlib-node
npm install --save-dev @types/hnswlib-node
```

**理由**：OpenAI用于Embedding API，HNSW用于向量索引加速。

---

#### Step 2.2: 创建EmbeddingService

**新建文件**: `src/core/embedding/EmbeddingService.ts`

**核心实现**：
```typescript
import { injectable, inject } from 'tsyringe';
import { OpenAI } from 'openai';
import { ConfigManager } from '../../storage/ConfigManager';

@injectable()
export class EmbeddingService {
  private client: OpenAI | null = null;
  private enabled = false;
  
  constructor(@inject(ConfigManager) private configManager: ConfigManager) {
    this.initialize();
  }
  
  private initialize() {
    const config = this.configManager.getConfig();
    this.enabled = config.memory?.enableVectorSearch ?? false;
    
    if (this.enabled) {
      const apiKey = this.configManager.getApiKey('openai');
      if (apiKey) {
        this.client = new OpenAI({ apiKey });
      } else {
        console.warn('[EmbeddingService] OpenAI API key not configured, vector search disabled');
        this.enabled = false;
      }
    }
  }
  
  /**
   * 将文本转换为向量
   */
  async embed(text: string): Promise<number[]> {
    if (!this.enabled || !this.client) {
      throw new Error('Vector search is not enabled or OpenAI client not initialized');
    }
    
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000)  // ADA-002最大8191 tokens
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('[EmbeddingService] Embedding failed:', error);
      throw error;
    }
  }
  
  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }
    
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * 批量嵌入（优化API调用）
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.enabled || !this.client) {
      throw new Error('Vector search is not enabled');
    }
    
    // OpenAI API支持批量，每次最多2048个
    const batchSize = 100;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: batch.map(t => t.substring(0, 8000))
      });
      
      results.push(...response.data.map(d => d.embedding));
    }
    
    return results;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
}
```

**理由**：封装Embedding API调用，提供统一的向量服务接口。

---

#### Step 2.3: 注册EmbeddingService到DI容器

**文件**: `src/extension.ts`

**修改位置**: initializeContainer函数

**添加代码**：
```typescript
import { EmbeddingService } from './core/embedding/EmbeddingService';

async function initializeContainer(context: vscode.ExtensionContext): Promise<void> {
  // ... 现有代码
  
  // 注册EmbeddingService
  const embeddingService = container.resolve(EmbeddingService);
  container.registerInstance(EmbeddingService, embeddingService);
  console.log('[Extension] EmbeddingService registered');
}
```

---

#### Step 2.4: 修改EpisodicMemory.record()存储向量

**文件**: `src/core/memory/EpisodicMemory.ts`

**修改内容**：

1. 导入依赖：
```typescript
import { EmbeddingService } from '../embedding/EmbeddingService';
import { container } from 'tsyringe';
```

2. 修改record方法：
```typescript
async record(memory: Omit<EpisodicMemoryRecord, 'id' | 'project_fingerprint'>): Promise<string> {
  const id = memory.id || `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = memory.timestamp || Date.now();
  const projectFingerprint = await this.getProjectFingerprint();
  
  // ... 现有代码（计算final_weight等）
  
  // ✅ L2新增：计算并存储向量
  let vectorBuffer: Buffer | null = null;
  try {
    const embeddingService = container.resolve(EmbeddingService);
    if (embeddingService.isEnabled()) {
      const indexText = this.getIndexText({ ...memory, id, project_fingerprint: projectFingerprint });
      const vector = await embeddingService.embed(indexText);
      vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    }
  } catch (error) {
    console.warn('[EpisodicMemory] Failed to compute embedding, continuing without vector:', error);
    // 降级：不存储向量，不影响主流程
  }
  
  // 插入数据库
  this.dbManager.run(
    `INSERT INTO episodic_memory (
      id, project_fingerprint, timestamp, task_type, summary,
      entities, decision, outcome, final_weight, model_id, latency_ms,
      memory_tier, metadata, vector
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectFingerprint,
      timestamp,
      memory.task_type,
      memory.summary,
      JSON.stringify(memory.entities || []),
      memory.decision || null,
      memory.outcome,
      finalWeight,
      memory.model_id,
      memory.latency_ms || null,
      memory.memory_tier || 'LONG_TERM',
      memory.metadata ? JSON.stringify(memory.metadata) : null,
      vectorBuffer  // ✅ 新增
    ]
  );
  
  // ... 更新索引等其他逻辑
  
  return id;
}
```

**理由**：在记录记忆时自动计算并存储向量，支持后续的向量检索。

---

#### Step 2.5: 修改SearchEngine使用向量相似度

**文件**: `src/core/memory/SearchEngine.ts`

**修改内容**：

1. 导入依赖：
```typescript
import { EmbeddingService } from '../embedding/EmbeddingService';
import { container } from 'tsyringe';
```

2. 修改calculateSemanticScore方法：
```typescript
private async calculateSemanticScore(
  memory: EpisodicMemoryRecord, 
  query: string
): Promise<number> {
  // ✅ L2新增：优先使用向量相似度
  if (memory.vector && memory.vector.length > 0) {
    try {
      const embeddingService = container.resolve(EmbeddingService);
      if (embeddingService.isEnabled()) {
        const queryVector = await embeddingService.embed(query);
        const memoryVector = new Float32Array(memory.vector.buffer);
        
        const similarity = embeddingService.cosineSimilarity(
          queryVector, 
          Array.from(memoryVector)
        );
        
        // 归一化到0-1范围（余弦相似度范围是-1到1）
        return (similarity + 1) / 2;
      }
    } catch (error) {
      console.warn('[SearchEngine] Vector similarity failed, falling back to Jaccard:', error);
      // 降级到Jaccard
    }
  }
  
  // 降级：使用词项匹配（Jaccard相似度）
  return this.calculateJaccardScore(memory, query);
}

// 保留原有方法作为降级方案
private calculateJaccardScore(memory: EpisodicMemoryRecord, query: string): number {
  // ... 现有的Jaccard实现
}
```

**理由**：优先使用向量相似度，失败时降级到Jaccard，保证向后兼容。

---

#### Step 2.6: 扩展ConfigManager配置

**文件**: `src/storage/ConfigManager.ts`

**修改内容**：

1. 扩展MemoryConfig接口：
```typescript
export interface MemoryConfig {
  retentionDays: number;
  decayLambda: number;
  coldStartTrust: number;
  
  // ✅ L2新增
  enableVectorSearch?: boolean;        // 是否启用向量搜索
  embeddingProvider?: 'openai' | 'ollama' | 'local';  // Embedding提供商
  embeddingModel?: string;             // Embedding模型名称
  vectorSearchThreshold?: number;      // 相似度阈值 (0-1)
}
```

2. 更新DEFAULT_CONFIG：
```typescript
const DEFAULT_CONFIG: XiaoWeibaConfig = {
  // ... 现有配置
  memory: {
    retentionDays: 90,
    decayLambda: 0.1,
    coldStartTrust: 20,
    enableVectorSearch: false,  // ✅ 默认关闭
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-ada-002',
    vectorSearchThreshold: 0.7
  },
  // ...
};
```

3. 添加验证逻辑：
```typescript
private validateConfig(config: XiaoWeibaConfig): void {
  // ... 现有验证
  
  // ✅ L2新增验证
  if (config.memory.enableVectorSearch !== undefined) {
    if (typeof config.memory.enableVectorSearch !== 'boolean') {
      throw createError(ErrorCode.INVALID_CONFIG, 'memory.enableVectorSearch must be boolean');
    }
  }
  
  if (config.memory.vectorSearchThreshold !== undefined) {
    if (config.memory.vectorSearchThreshold < 0 || config.memory.vectorSearchThreshold > 1) {
      throw createError(ErrorCode.INVALID_CONFIG, 'memory.vectorSearchThreshold must be between 0 and 1');
    }
  }
}
```

**理由**：提供配置开关，让用户可以控制是否启用向量搜索。

---

#### Step 2.7: 创建向量索引管理器（可选优化）

**新建文件**: `src/core/indexing/VectorIndexManager.ts`

**说明**：这是一个性能优化，不是必须的。可以先实现基础的向量检索，确认效果后再引入HNSW索引。

---

#### Step 2.8: 编写测试脚本

**新建文件**: `scripts/test-embedding.ts`

**内容**：
```typescript
import { EmbeddingService } from '../src/core/embedding/EmbeddingService';
import { ConfigManager } from '../src/storage/ConfigManager';

async function main() {
  console.log('Testing EmbeddingService...');
  
  const configManager = new ConfigManager();
  await configManager.loadConfig();
  
  const embeddingService = new EmbeddingService(configManager);
  
  if (!embeddingService.isEnabled()) {
    console.log('❌ Vector search is not enabled. Please configure OpenAI API key.');
    return;
  }
  
  // 测试单个嵌入
  const text = '这是一个测试文本';
  console.log(`Embedding: "${text}"`);
  const vector = await embeddingService.embed(text);
  console.log(`✅ Vector dimension: ${vector.length}`);
  console.log(`✅ First 5 values: ${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
  
  // 测试相似度计算
  const text2 = '这是另一个测试文本';
  const vector2 = await embeddingService.embed(text2);
  const similarity = embeddingService.cosineSimilarity(vector, vector2);
  console.log(`✅ Similarity between texts: ${similarity.toFixed(4)}`);
  
  // 测试不相似文本
  const text3 = 'Python是一种编程语言';
  const vector3 = await embeddingService.embed(text3);
  const similarity2 = embeddingService.cosineSimilarity(vector, vector3);
  console.log(`✅ Similarity with different text: ${similarity2.toFixed(4)}`);
  
  console.log('\n✅ All tests passed!');
}

main().catch(console.error);
```

**运行测试**：
```bash
npx ts-node scripts/test-embedding.ts
```

---

### L2验收清单

- [ ] EmbeddingService能成功调用OpenAI API
- [ ] EpisodicMemory.record()能存储向量到数据库
- [ ] searchSemantic()使用余弦相似度
- [ ] ConfigManager有enableVectorSearch配置项
- [ ] 测试脚本能正常运行
- [ ] 手动测试：检索准确率相比之前有提升

---

## 🧘 Phase 3: 体验期（至少两周）

### 目标
完成L1和L2预研后，暂停所有大型开发工作，像普通用户一样使用小尾巴，记录真实体验中的痛点。

### 行动指南

#### 每日任务
1. **正常使用**：每天至少使用小尾巴3次（代码解释、提交生成、聊天等）
2. **记录痛点**：遇到不爽的地方立即记录到`docs/USER_FEEDBACK.md`
3. **不添加功能**：克制住添加新功能的冲动

#### 重点关注
- **上下文感知**：AI是否真的"看到"了我的屏幕？
- **记忆准确性**：检索到的记忆是否相关？
- **响应速度**：是否有明显的延迟？
- **交互流畅度**：会话切换、界面刷新是否顺畅？

#### 输出物
- `docs/USER_FEEDBACK.md` - 用户反馈记录
- 至少5个待修复的小毛病列表
- 优先级排序的改进建议

---

## 📅 时间规划

| 阶段 | 时间 | 主要任务 | 交付物 |
|------|------|----------|--------|
| **L1 感知增强** | 本周内（3天） | ContextEnricher、Intent扩展、ChatAgent优化 | 可演示的上下文感知功能 |
| **L2 向量检索预研** | 下周（5天） | EmbeddingService、向量存储、混合检索 | 可配置的向量搜索能力 |
| **体验期** | 之后两周（10天） | 日常使用、记录痛点、修复小问题 | 用户反馈报告+改进清单 |

---

## 🔍 关键文件清单

### 需要修改的文件
1. `src/core/domain/Intent.ts` - 扩展metadata结构
2. `src/core/factory/IntentFactory.ts` - 注入intentVector和enrichedContext
3. `src/agents/ChatAgent.ts` - 利用enrichedContext和intentVector
4. `src/core/domain/MemoryContext.ts` - EpisodicMemoryItem增加字段
5. `src/core/memory/EpisodicMemory.ts` - record()存储向量
6. `src/core/memory/SearchEngine.ts` - 使用余弦相似度
7. `src/storage/ConfigManager.ts` - 添加向量搜索配置
8. `src/extension.ts` - 注册EmbeddingService

### 需要新建的文件
1. `src/core/context/ContextEnricher.ts` - 上下文增强器
2. `src/core/embedding/EmbeddingService.ts` - Embedding服务
3. `tests/unit/core/context/ContextEnricher.test.ts` - 单元测试
4. `scripts/test-embedding.ts` - 测试脚本
5. `docs/USER_FEEDBACK.md` - 用户反馈记录

---

## ✅ 验证策略

### L1验证
```bash
# 1. 运行单元测试
npm run test:unit -- ContextEnricher

# 2. 编译检查
npm run compile

# 3. 手动测试
# - 打开任意代码文件
# - 选中一段代码
# - 在聊天中输入"解释这段代码"
# - 验证AI回答是否提到文件名和行号
```

### L2验证
```bash
# 1. 运行Embedding测试脚本
npx ts-node scripts/test-embedding.ts

# 2. 运行单元测试
npm run test:unit -- EmbeddingService

# 3. 手动测试
# - 配置OpenAI API Key
# - 启用memory.enableVectorSearch
# - 执行几次代码解释操作
# - 在聊天中询问相关问题
# - 验证检索到的记忆是否更相关
```

---

## ⚠️ 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| OpenAI API成本过高 | 中 | 中 | 使用本地模型备选、设置用量限制 |
| 向量存储增加DB大小 | 高 | 低 | SQLite BLOB效率高，预计增加<20% |
| 检索性能下降 | 低 | 中 | 使用向量索引+缓存、异步计算 |
| 向后兼容性破坏 | 低 | 高 | vector字段可选、降级到词项匹配 |
| 用户体验不如预期 | 中 | 高 | 两周体验期及时发现问题 |

---

## 📝 总结

这个计划遵循了小尾巴的核心设计原则：

1. **记忆为核**：L1和L2都围绕增强记忆系统展开
2. **渐进式智能**：从简单的上下文感知到复杂的向量检索，逐步演进
3. **先体验后优化**：两周体验期确保从用户视角发现问题
4. **降级策略**：所有新功能都有降级方案，保证稳定性

**下一步行动**：
1. 确认计划无误
2. 开始实施L1（ContextEnricher）
3. 完成后进入L2预研
4. 最后进入两周体验期

让我们开始吧！🚀
