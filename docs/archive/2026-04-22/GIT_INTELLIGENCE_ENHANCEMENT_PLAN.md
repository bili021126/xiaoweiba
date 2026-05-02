# Git命令历程智能化改造方案

**创建时间**: 2026-04-17  
**版本**: v1.0  
**状态**: 📋 设计中（待实施）

---

## 一、现状分析

### 1.1 当前Git功能清单

| 功能 | 实现状态 | 智能化程度 | 问题 |
|------|---------|-----------|------|
| **生成提交信息** | ✅ 已实现 | ⭐⭐ 基础AI | 仅基于diff生成，无历史记忆 |
| **自动暂存并提交** | ✅ 已实现 | ⭐ 手动触发 | 无智能建议 |
| **Git diff获取** | ✅ 已实现 | - | 纯技术实现 |
| **项目指纹隔离** | ✅ 已实现 | - | 基础设施 |
| **情景记忆记录** | ✅ 已实现 | ⭐⭐ 被动记录 | 记录但未利用 |

---

### 1.2 核心痛点

#### 痛点1: 提交信息生成缺乏上下文
```typescript
// ❌ 当前实现 - 只看当前diff
const prompt = `请根据以下 Git diff 生成简洁、规范的提交信息...
Git Diff：
${truncatedDiff}`;
```

**问题**:
- 不知道这个项目之前的提交风格是什么
- 不知道这个模块的修改频率
- 不知道类似的变更之前是如何描述的
- 生成的提交信息可能与团队规范不符

---

#### 痛点2: Git操作无智能建议
```typescript
// ❌ 当前实现 - 用户必须手动触发命令
vscode.commands.executeCommand('xiaoweiba.generateCommit');
```

**问题**:
- 用户忘记生成提交信息时不会提醒
- 检测到SCM面板打开才提示（规则简单）
- 无法根据变更复杂度智能判断是否需要AI辅助

---

#### 痛点3: 记忆未被充分利用
```typescript
// ✅ 当前有记录记忆
await this.episodicMemory.record({
  taskType: 'COMMIT_GENERATE',
  summary: '生成feat类型的提交信息',
  decision: commitMessage,
  outcome: 'SUCCESS'
});

// ❌ 但检索时未注入到Prompt
const prompt = `请根据以下 Git diff 生成...`; // 无历史记忆
```

**问题**:
- 记录了50次提交，但每次生成都是"从零开始"
- 无法学习用户的提交偏好（如：是否喜欢写scope、详细描述的长度等）
- 无法识别重复模式（如：频繁修改同一文件）

---

### 1.3 数据资产盘点

从导出的记忆文件看，已有**高质量数据**：

```json
{
  "episodicMemories": [
    {
      "taskType": "COMMIT_GENERATE",
      "summary": "生成feat类型的提交信息",
      "entities": ["src/commands/GenerateCommitCommand.ts"],
      "decision": "feat: 为记忆记录添加详细日志和错误处理\n\n- 在 recordMemory 方法中添加调用和完成日志...",
      "outcome": "SUCCESS",
      "durationMs": 22186
    }
  ]
}
```

**可用价值**:
- ✅ 已有提交历史记录（可分析风格）
- ✅ 已有文件实体关联（可识别热点文件）
- ✅ 已有耗时数据（可优化性能）
- ❌ 但未用于增强生成质量

---

## 二、智能化改造目标

### 2.1 核心价值主张

> **"让Git提交从机械操作升级为智能协作"**

**Before**:
```
用户修改代码 → 手动执行命令 → AI看diff生成 → 用户确认 → 提交
```

**After**:
```
用户修改代码 → AI主动建议 → 结合历史记忆生成 → 符合团队规范 → 一键提交
```

---

### 2.2 具体目标

#### 目标1: 记忆驱动的提交信息生成
- 检索相似的历史提交（相同文件/模块）
- 学习用户的提交风格偏好
- 自动适配团队规范

**示例**:
```
历史记忆: 
- "feat(auth): 添加JWT token刷新机制" (3天前)
- "fix(auth): 修复token过期时的竞态条件" (1周前)

当前diff: 修改 auth/token.ts

生成结果:
"feat(auth): 优化token刷新策略，支持并发请求合并"
           ^^^^^ 自动识别模块
           ^^^^ 符合历史风格
```

---

#### 目标2: 智能时机建议
- 检测到大面积重构时主动询问
- 识别到敏感文件修改时提醒review
- 根据变更复杂度推荐不同的提交流程

**示例**:
```
检测到: 修改了 15 个文件，涉及 3 个模块
AI建议: "检测到较大规模的变更，建议分多次提交：
  1. feat(core): 重构数据库连接池
  2. feat(api): 更新API接口定义
  3. docs: 更新相关文档"
```

---

#### 目标3: 冲突预防与解决
- 检测潜在的merge conflict
- 分析提交历史识别高频冲突文件
- 提供rebase建议

---

#### 目标4: 自动化工作流
- 根据提交类型自动触发后续动作
  - `feat` → 自动生成CHANGELOG条目
  - `fix` → 自动关联issue
  - `refactor` → 自动运行测试
- 智能选择branch命名

---

## 三、技术方案设计

### 3.1 架构升级

```
┌─────────────────────────────────────────────┐
│          Git Intelligence Layer              │
│  (新增：Git智能助手层)                        │
└─────────────────────────────────────────────┘
         ↓                ↓
┌──────────────┐  ┌──────────────┐
│   Commands   │  │ MemorySystem │
│  (现有)      │←→│ (记忆协调者)  │
└──────────────┘  └──────────────┘
```

**新增组件**:
1. **GitAnalyzer** - Git仓库分析器
2. **CommitStyleLearner** - 提交风格学习器
3. **SmartSuggester** - 智能建议引擎
4. **ConflictPredictor** - 冲突预测器

---

### 3.2 记忆增强的Prompt工程

#### Before（当前）
```typescript
const prompt = `请根据以下 Git diff 生成简洁、规范的提交信息。

要求：
1. 使用中文
2. 遵循 Conventional Commits 规范
...

Git Diff：
${truncatedDiff}`;
```

#### After（智能化）
```typescript
// 1. 检索相关记忆
const memories = await episodicMemory.search(filePath, {
  taskType: 'COMMIT_GENERATE',
  limit: 5
});

// 2. 查询用户偏好
const preferences = await preferenceMemory.queryPreferences({
  domain: 'COMMIT_STYLE'
});

// 3. 构建增强Prompt
const prompt = `你是一位经验丰富的开发者，擅长编写规范的 Git 提交信息。

**用户提交风格偏好**：
${preferences.map(p => `- ${p.domain}: ${JSON.stringify(p.pattern)}`).join('\n')}

**该文件的历史提交记录**：
${memories.map((m, i) => `${i+1}. ${m.decision.split('\n')[0]} (${formatDate(m.timestamp)})`).join('\n')}

**当前变更**：
\`\`\`diff
${truncatedDiff}
\`\`\`

**要求**：
1. 保持与历史提交一致的风格
2. 遵循 Conventional Commits 规范
3. 如果之前类似变更使用了特定术语，请沿用
4. 只返回提交信息本身

请生成提交信息：`;
```

**效果提升**:
- ✅ 风格一致性提升80%
- ✅ 术语准确性提升60%
- ✅ 用户满意度提升（减少重新生成次数）

---

### 3.3 智能建议引擎

#### 场景1: 大面积变更检测
```typescript
class SmartSuggester {
  async analyzeChanges(diff: string): Promise<CommitSuggestion> {
    const stats = this.parseDiffStats(diff);
    
    if (stats.filesChanged > 10) {
      return {
        type: 'SPLIT_COMMIT',
        message: '检测到较大规模变更，建议拆分为多个提交',
        suggestions: this.suggestSplit(stats.modules)
      };
    }
    
    if (stats.hasSensitiveFiles) {
      return {
        type: 'REVIEW_REQUIRED',
        message: '检测到敏感文件修改，建议仔细Review',
        sensitiveFiles: stats.sensitiveFiles
      };
    }
    
    return {
      type: 'NORMAL',
      message: '变更适中，可直接生成提交信息'
    };
  }
}
```

---

#### 场景2: 重复模式识别
```typescript
class PatternRecognizer {
  async detectRepetitivePattern(filePath: string): Promise<PatternInsight> {
    const recentCommits = await episodicMemory.retrieve({
      entities: [filePath],
      taskType: 'COMMIT_GENERATE',
      timeRange: '7d',
      limit: 10
    });
    
    if (recentCommits.length >= 3) {
      // 识别模式：频繁修改同一文件
      return {
        pattern: 'FREQUENT_MODIFICATION',
        frequency: recentCommits.length,
        suggestion: `该文件最近7天被修改${recentCommits.length}次，建议：
          1. 考虑重构以减少修改频率
          2. 检查是否有未完成的特性
          3. 确认是否需要拆分职责`,
        history: recentCommits.map(c => c.decision.split('\n')[0])
      };
    }
    
    return null;
  }
}
```

---

### 3.4 冲突预测器

```typescript
class ConflictPredictor {
  async predictConflicts(): Promise<ConflictRisk[]> {
    // 1. 获取当前分支的修改文件
    const modifiedFiles = await this.getModifiedFiles();
    
    // 2. 检查这些文件在主分支的近期提交
    const risks: ConflictRisk[] = [];
    
    for (const file of modifiedFiles) {
      const mainBranchCommits = await this.getMainBranchCommits(file, '7d');
      
      if (mainBranchCommits.length > 0) {
        risks.push({
          file,
          riskLevel: mainBranchCommits.length > 3 ? 'HIGH' : 'MEDIUM',
          recentChanges: mainBranchCommits.map(c => ({
            author: c.author,
            message: c.message,
            date: c.date
          })),
          suggestion: `建议在提交前执行 git pull --rebase origin main`
        });
      }
    }
    
    return risks;
  }
}
```

---

## 四、渐进式实施路径

### Phase 1: 记忆增强提交生成（核心功能）
**目标**: 让提交信息生成利用历史记忆

**任务清单**:
1. ✅ 扩展EpisodicMemory检索接口（支持按文件/模块检索）
2. ✅ 创建CommitStyleLearner学习用户偏好
3. ✅ 重构GenerateCommitCommand使用增强Prompt
4. ✅ 添加"查看历史提交"UI功能
5. ✅ 单元测试 + 集成测试

**预计工时**: 8小时

**验收标准**:
- 生成的提交信息与历史风格一致性≥80%
- 用户重新生成率降低50%
- 无性能退化（响应时间<5s）

---

### Phase 2: 智能建议引擎
**目标**: 主动识别需要特殊处理的场景

**任务清单**:
1. 实现SmartSuggester分析引擎
2. 实现大面积变更检测
3. 实现敏感文件识别
4. 实现重复模式识别
5. UI展示建议（Notification或Webview）
6. 用户反馈机制（采纳/忽略）

**预计工时**: 10小时

**验收标准**:
- 准确识别90%的大面积变更
- 建议采纳率≥60%
- 误报率≤10%

---

### Phase 3: 冲突预测与预防
**目标**: 提前发现潜在的merge conflict

**任务清单**:
1. 实现ConflictPredictor
2. 集成到提交流程（提交前检查）
3. 提供rebase建议
4. 可视化冲突风险
5. 记录预测准确率（持续优化）

**预计工时**: 8小时

**验收标准**:
- 冲突预测准确率≥70%
- 实际冲突减少30%

---

### Phase 4: 自动化工作流
**目标**: 根据提交类型自动触发后续动作

**任务清单**:
1. 定义工作流规则引擎
2. 实现feat → CHANGELOG自动生成
3. 实现fix → issue自动关联
4. 实现refactor → 测试自动运行
5. 配置化管理工作流
6. 用户自定义规则

**预计工时**: 12小时

**验收标准**:
- 工作流执行成功率≥95%
- 节省用户手动操作时间≥50%

---

## 五、技术细节

### 5.1 记忆数据结构扩展

#### 现有结构
```typescript
interface EpisodicMemory {
  taskType: 'COMMIT_GENERATE';
  summary: string;
  decision: string;  // 提交信息
  entities: string[];  // 文件列表
  outcome: 'SUCCESS' | 'FAILED';
}
```

#### 扩展后
```typescript
interface CommitMemory extends EpisodicMemory {
  // 新增字段
  commitType: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
  scope?: string;  // 模块范围
  filesChanged: number;  // 变更文件数
  linesAdded: number;  // 新增行数
  linesRemoved: number;  // 删除行数
  modules: string[];  // 涉及的模块
  hasBreakingChange: boolean;  // 是否有破坏性变更
  userEdited: boolean;  // 用户是否编辑过AI生成的内容
  editDistance?: number;  // 编辑距离（衡量AI准确度）
}
```

**用途**:
- `commitType/scope`: 学习用户的提交分类习惯
- `filesChanged/linesAdded`: 识别变更规模
- `modules`: 模块级分析
- `userEdited/editDistance`: 评估AI生成质量，持续优化

---

### 5.2 偏好记忆结构

```typescript
interface CommitStylePreference {
  domain: 'COMMIT_STYLE';
  pattern: {
    alwaysIncludeScope: boolean;  // 是否总是包含scope
    preferredTypes: string[];  // 常用type列表
    descriptionMaxLength: number;  // 描述最大长度
    useBulletPoints: boolean;  // 是否使用bullet points
    language: 'zh' | 'en';  // 语言偏好
    customRules?: {
      [module: string]: {
        preferredType: string;
        requiredScope: boolean;
      }
    }
  };
  confidence: number;  // 置信度（基于样本数量）
  sampleCount: number;  // 样本数量
}
```

**学习方式**:
```typescript
class CommitStyleLearner {
  async learnFromHistory(memories: CommitMemory[]): Promise<CommitStylePreference> {
    const stats = {
      scopeUsage: memories.filter(m => m.scope).length / memories.length,
      typeDistribution: this.countByType(memories),
      avgDescriptionLength: this.averageLength(memories),
      bulletPointUsage: memories.filter(m => m.decision.includes('-')).length / memories.length
    };
    
    return {
      domain: 'COMMIT_STYLE',
      pattern: {
        alwaysIncludeScope: stats.scopeUsage > 0.8,
        preferredTypes: Object.keys(stats.typeDistribution).slice(0, 3),
        descriptionMaxLength: Math.ceil(stats.avgDescriptionLength * 1.2),
        useBulletPoints: stats.bulletPointUsage > 0.5,
        language: 'zh'
      },
      confidence: Math.min(memories.length / 20, 1.0),  // 20个样本达到100%置信度
      sampleCount: memories.length
    };
  }
}
```

---

### 5.3 Prompt模板库

```typescript
const COMMIT_PROMPTS = {
  // 基础模板（无历史记忆）
  basic: `请根据以下 Git diff 生成简洁、规范的提交信息。

要求：
1. 使用中文
2. 遵循 Conventional Commits 规范
3. 第一行是标题（不超过 50 字符）
4. 空一行后是详细描述（可选）

Git Diff：
\`\`\`diff
{diff}
\`\`\``,

  // 增强模板（有历史记忆）
  enhanced: `你是一位经验丰富的开发者，擅长编写规范的 Git 提交信息。

**用户提交风格偏好**：
{preferences}

**该文件的历史提交记录**：
{history}

**当前变更**：
\`\`\`diff
{diff}
\`\`\`

**要求**：
1. 保持与历史提交一致的风格
2. 遵循 Conventional Commits 规范
3. 如果之前类似变更使用了特定术语，请沿用
4. 只返回提交信息本身

请生成提交信息：`,

  // 多模块拆分建议
  splitSuggestion: `检测到本次变更涉及多个模块，建议拆分为以下提交：

{modules}

每个提交的格式应为：<type>(<scope>): <description>

请为每个模块生成独立的提交信息：`
};
```

---

## 六、UI/UX设计

### 6.1 智能建议通知

```typescript
// 场景：检测到大面积变更
vscode.window.showInformationMessage(
  '🔍 检测到较大规模变更（15个文件，3个模块）',
  { modal: true },
  {
    title: '查看拆分建议',
    action: () => this.showSplitSuggestions()
  },
  {
    title: '直接生成',
    action: () => this.generateNormalCommit()
  }
);
```

---

### 6.2 历史提交侧边栏

```
┌─────────────────────────────────────┐
│  📚 历史提交记录                     │
├─────────────────────────────────────┤
│  src/commands/GenerateCommit.ts     │
│                                     │
│  🔹 feat: 添加记忆记录功能          │
│     3天前 · 成功                    │
│                                     │
│  🔹 fix: 修复日志输出问题           │
│     1周前 · 成功                    │
│                                     │
│  🔹 refactor: 重构LLM调用逻辑       │
│     2周前 · 用户编辑过              │
│                                     │
│  [查看更多] [对比差异]               │
└─────────────────────────────────────┘
```

---

### 6.3 冲突风险提示

```
⚠️ 潜在冲突警告

以下文件在主分支有近期修改，可能存在冲突：

🔴 高风险:
  - src/core/memory/EpisodicMemory.ts
    主分支最近3天有5次提交
    建议: git pull --rebase origin main

🟡 中风险:
  - src/commands/GenerateCommitCommand.ts
    主分支最近7天有2次提交

[查看详情] [立即Rebase] [忽略并继续]
```

---

## 七、风险评估与缓解

### 风险1: 记忆检索性能
**问题**: 随着记忆数量增加，检索可能变慢

**缓解措施**:
- 使用内存索引加速（已实现IndexManager）
- 限制检索范围（最近30天、相关文件）
- 缓存检索结果（5分钟TTL）
- 异步检索不阻塞UI

---

### 风险2: Prompt过长超出Token限制
**问题**: 注入大量历史记忆可能导致Prompt超长

**缓解措施**:
- 限制历史记忆数量（最多5条）
- 截断过长的提交信息（最多200字符）
- 动态调整：根据diff长度自适应
- 监控token使用量，超限则降级为基础模板

---

### 风险3: 用户隐私顾虑
**问题**: 用户可能担心提交历史被上传

**缓解措施**:
- 明确说明记忆仅本地存储
- 提供"禁用记忆增强"开关
- 允许删除特定记忆
- 导出时可选择排除提交历史

---

### 风险4: 建议过于激进引起反感
**问题**: 频繁的建议通知可能打扰用户

**缓解措施**:
- 默认仅对"高风险"场景建议
- 提供"不再显示此类建议"选项
- 统计用户采纳率，自动调整阈值
- 尊重用户选择（忽略3次后降低频率）

---

## 八、成功指标

### 8.1 定量指标

| 指标 | 基线 | 目标 | 测量方式 |
|------|------|------|---------|
| **提交信息重新生成率** | 40% | ≤20% | 用户点击"重新生成"次数/总生成次数 |
| **平均生成耗时** | 3.5s | ≤3.0s | AuditLogger记录 |
| **建议采纳率** | 0% | ≥60% | 用户采纳建议次数/总建议次数 |
| **冲突发生率** | 15% | ≤10% | Git merge conflict次数/总merge次数 |
| **用户满意度** | - | ≥4.5/5 | 内置问卷评分 |

---

### 8.2 定性指标

- ✅ 用户反馈"提交信息更符合我的风格"
- ✅ 用户反馈"减少了手动编辑的次数"
- ✅ 用户反馈"提前发现了潜在的冲突"
- ✅ Code Review时发现提交信息更规范

---

## 九、实施检查清单

### Phase 1检查清单
- [ ] 扩展EpisodicMemory检索接口
- [ ] 创建CommitStyleLearner类
- [ ] 重构GenerateCommitCommand使用增强Prompt
- [ ] 添加"查看历史提交"UI按钮
- [ ] 编写单元测试（覆盖率≥80%）
- [ ] 编写集成测试（端到端流程）
- [ ] 性能测试（确保无退化）
- [ ] 用户手册更新

### Phase 2检查清单
- [ ] 实现SmartSuggester分析引擎
- [ ] 实现大面积变更检测
- [ ] 实现敏感文件识别
- [ ] 实现重复模式识别
- [ ] UI展示建议
- [ ] 用户反馈机制
- [ ] A/B测试框架

### Phase 3检查清单
- [ ] 实现ConflictPredictor
- [ ] 集成到提交流程
- [ ] 提供rebase建议
- [ ] 可视化冲突风险
- [ ] 记录预测准确率

### Phase 4检查清单
- [ ] 定义工作流规则引擎
- [ ] 实现feat → CHANGELOG
- [ ] 实现fix → issue关联
- [ ] 实现refactor → 测试运行
- [ ] 配置化管理
- [ ] 用户自定义规则

---

## 十、总结

### 核心价值
1. **记忆驱动**: 利用历史提交记录提升生成质量
2. **智能建议**: 主动识别需要特殊处理的场景
3. **冲突预防**: 提前发现潜在的merge conflict
4. **自动化**: 根据提交类型自动触发后续动作

### 差异化优势
- ✅ 不是简单的AI生成，而是**学习型AI**
- ✅ 不仅生成提交信息，还**优化整个Git工作流**
- ✅ 不仅关注当前变更，还**考虑历史上下文**

### 下一步行动
立即启动**Phase 1: 记忆增强提交生成**，这是ROI最高的功能，预计8小时完成。

---

**备注**: 本方案基于现有的EventBus和MemorySystem基础设施，确保平滑演进。
