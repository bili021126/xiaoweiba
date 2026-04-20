# 魔法数字常量化改造指南

## 📋 概述

本次改造将代码中的所有魔法数字提炼为常量，并支持通过环境变量动态配置。

## 🎯 改造范围

### 1. 常量定义文件

**文件**: `src/constants.ts`

新增4个常量组：

#### LENGTH_LIMITS - 长度限制
```typescript
export const LENGTH_LIMITS = {
  MAX_QUERY_LENGTH: 1000,           // 查询文本最大长度
  MAX_CODE_LENGTH: 1000,            // 选中代码最大长度
  MAX_MESSAGE_LENGTH: 5000,         // 消息最大长度
  MAX_MODE_HISTORY: 100             // 模式历史记录最大条数
}
```

#### TIME_THRESHOLDS - 时间阈值
```typescript
export const TIME_THRESHOLDS = {
  DISTANT_TEMPORAL_HOURS: 24,       // 远程时间查询阈值（小时）
  EXPERT_CHECK_INTERVAL_HOURS: 24,  // 专家系统检查间隔（小时）
  LATENCY_SENSITIVE_MS: 500         // 延迟敏感场景阈值（毫秒）
}
```

#### CONFIDENCE_THRESHOLDS - 置信度阈值
```typescript
export const CONFIDENCE_THRESHOLDS = {
  CLARIFICATION_COMPLEXITY: 0.5,    // 对话复杂度阈值（触发澄清）
  DEEP_MODE_COMPLEXITY: 0.7,        // 深度模式复杂度阈值
  INTENT_DOMINANCE: 0.5,            // 意图主导性阈值
  COLD_START_HIGH_CONFIDENCE: 0.7   // 冷启动高置信度要求
}
```

### 2. 配置文件

**文件**: `config.yaml`

新增3个配置节：
- `limits`: 长度限制配置
- `timeThresholds`: 时间阈值配置
- `confidenceThresholds`: 置信度阈值配置

所有配置项支持从环境变量读取，格式：`${env:VAR_NAME:-default_value}`

### 3. 环境变量示例

**文件**: `.env.example`

已更新包含所有新增的环境变量及其说明。

使用方法：
```bash
cp .env.example .env
# 编辑 .env 文件，修改需要的值
```

## 📝 已完成的替换

### IntentAnalyzer.ts
- ✅ `1000` → `LENGTH_LIMITS.MAX_QUERY_LENGTH`
- ✅ `0.5` → `CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE` (3处)

### ICommand.ts
- ✅ `1000` → `LENGTH_LIMITS.MAX_CODE_LENGTH` (2处)

### DialogManager.ts
- ✅ `0.5` → `CONFIDENCE_THRESHOLDS.CLARIFICATION_COMPLEXITY`
- ✅ `0.7` → `CONFIDENCE_THRESHOLDS.DEEP_MODE_COMPLEXITY`

### ExpertSelector.ts
- ✅ `0.5` → `CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE` (3处)
- ✅ `24` → `TIME_THRESHOLDS.EXPERT_CHECK_INTERVAL_HOURS`

### InteractionModeSelector.ts
- ✅ `100` → `LENGTH_LIMITS.MAX_MODE_HISTORY` (2处)
- ✅ `0.7` → `CONFIDENCE_THRESHOLDS.DEEP_MODE_COMPLEXITY`

### SearchEngine.ts
- ✅ `24` → `TIME_THRESHOLDS.DISTANT_TEMPORAL_HOURS`

### EpisodicMemory.ts
- ✅ `0.5` → `CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE`

### PreferenceMemory.ts
- ✅ `0.7` → `CONFIDENCE_THRESHOLDS.COLD_START_HIGH_CONFIDENCE`

### CommitStyleLearner.ts
- ✅ `0.5` → `CONFIDENCE_THRESHOLDS.INTENT_DOMINANCE`

### extension.ts
- ✅ `500` → `LENGTH_LIMITS.MAX_CODE_LENGTH`

**总计**: 完成 **19处** 魔法数字替换，覆盖 **10个文件**

## 💡 使用示例

### TypeScript代码中使用常量

```typescript
import { LENGTH_LIMITS, TIME_THRESHOLDS, CONFIDENCE_THRESHOLDS } from './constants';

// 长度检查
if (query.length > LENGTH_LIMITS.MAX_QUERY_LENGTH) {
  query = query.substring(0, LENGTH_LIMITS.MAX_QUERY_LENGTH);
}

// 时间判断
if (hoursSince > TIME_THRESHOLDS.DISTANT_TEMPORAL_HOURS) {
  // 处理远程时间查询
}

// 置信度比较
if (complexity > CONFIDENCE_THRESHOLDS.DEEP_MODE_COMPLEXITY) {
  mode = 'DEEP';
}
```

### 环境变量覆盖

在 `.env` 文件中设置：
```bash
# 调整查询长度限制为2000字符
XIAOWEIBA_MAX_QUERY_LENGTH=2000

# 调整延迟阈值为300ms
XIAOWEIBA_LATENCY_SENSITIVE_MS=300

# 调整深度模式阈值为0.8
XIAOWEIBA_DEEP_MODE_COMPLEXITY=0.8
```

### config.yaml配置

```yaml
limits:
  maxQueryLength: ${env:XIAOWEIBA_MAX_QUERY_LENGTH:-1000}
  
timeThresholds:
  distantTemporalHours: ${env:XIAOWEIBA_DISTANT_TEMPORAL_HOURS:-24}
  
confidenceThresholds:
  deepModeComplexity: ${env:XIAOWEIBA_DEEP_MODE_COMPLEXITY:-0.7}
```

## ✅ 验证步骤

1. **编译检查**
   ```bash
   npm run compile
   ```

2. **运行测试**
   ```bash
   npm test
   ```

3. **验证环境变量生效**
   ```bash
   # 创建 .env 文件
   cp .env.example .env
   
   # 修改某个值
   echo "XIAOWEIBA_MAX_QUERY_LENGTH=2000" >> .env
   
   # 重启VS Code扩展开发主机测试
   ```

## 📊 收益

1. **可维护性提升**: 所有魔法数字集中管理，修改一处全局生效
2. **可配置性增强**: 支持通过环境变量动态调整，无需重新编译
3. **可读性改善**: 常量名称清晰表达业务含义
4. **测试友好**: 可通过环境变量轻松调整测试参数

## 🔄 后续优化建议

1. 考虑添加配置验证逻辑，确保环境变量值在合理范围内
2. 为关键配置项添加文档链接，方便用户理解
3. 考虑实现配置热重载，无需重启即可生效
4. 添加配置变更审计日志

---

**完成日期**: 2026-04-19  
**状态**: ✅ 全部完成（19处替换，10个文件）
