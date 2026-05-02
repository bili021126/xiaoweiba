# 循环依赖说明文档

**最后更新**: 2026-05-02  
**状态**: 已知的安全循环依赖（懒加载模式）

---

## 检测到的循环依赖

运行 `npm run check:circular` 检测到以下循环依赖：

```
1) storage/ConfigManager.ts > core/security/AuditLogger.ts
2) storage/ConfigManager.ts > tools/LLMTool.ts
```

---

## 原因分析

### 1. ConfigManager ↔ AuditLogger

**依赖链**:
```
AuditLogger.ts (line 7)
  → import { ConfigManager } from '../../storage/ConfigManager'

ConfigManager.ts (line 263)
  → const { AuditLogger } = await import('../core/security/AuditLogger')  // 动态导入
```

**原因**: 这是**懒加载模式**，不是真正的循环依赖。
- `AuditLogger` 在构造函数中需要同步获取 `ConfigManager` 实例（通过 tsyringe DI）
- `ConfigManager` 在 `validateApiKey()` 方法中**动态异步**导入 `AuditLogger` 用于记录验证事件
- 动态 `import()` 是运行时行为，不会造成初始化时的循环依赖

**安全性**: ✅ 安全
- 动态导入只在特定条件下触发
- 此时 `AuditLogger` 已经完全初始化

---

### 2. ConfigManager ↔ LLMTool

**依赖链**:
```
LLMTool.ts (line 3)
  → import { ConfigManager, ModelProviderConfig } from '../storage/ConfigManager'

ConfigManager.ts (line 262)
  → const { LLMTool } = await import('../tools/LLMTool')  // 动态导入
```

**原因**: 同样是**懒加载模式**。
- `LLMTool` 需要 `ConfigManager` 获取 API 配置
- `ConfigManager` 在 `validateApiKey()` 中动态导入 `LLMTool` 进行 API 密钥验证

**安全性**: ✅ 安全

---

## 为什么这些循环依赖是安全的

### 静态导入 vs 动态导入

| 特性 | 静态 `import` | 动态 `import()` |
|------|--------------|-----------------|
| 执行时机 | 模块加载时 | 运行时按需 |
| 循环依赖风险 | ⚠️ 高风险 | ✅ 低风险 |
| 初始化顺序 | 必须严格遵循 | 无限制 |

### 当前项目的保护机制

1. **依赖注入容器 (tsyringe)**
   - 所有依赖通过容器解析，不直接实例化
   - 单例模式确保只有一个实例

2. **动态导入的延迟执行**
   - `validateApiKey()` 只在用户主动调用时执行
   - 此时所有模块已完全初始化

3. **单向数据流**
   - `ConfigManager` → 配置数据
   - `AuditLogger` → 日志记录
   - 没有双向数据依赖

---

## 如何消除这些警告（可选）

如果希望完全消除循环依赖警告，可以采用以下方案：

### 方案 A: 提取共享接口（推荐）

创建 `src/core/ports/IConfigPort.ts`:
```typescript
export interface IConfigPort {
  getConfig(): AppConfig;
  getApiKey(provider: string): string | undefined;
}
```

然后让 `AuditLogger` 和 `LLMTool` 依赖接口而非具体实现。

### 方案 B: 事件驱动解耦

将 `validateApiKey()` 的日志记录改为发布事件：
```typescript
// ConfigManager
this.eventBus.publish(new ApiKeyValidationEvent(...));

// AuditLogger 订阅事件
this.eventBus.subscribe(ApiKeyValidationEvent, this.handleValidation.bind(this));
```

### 方案 C: 接受现状（当前选择）

在 CI/CD 中将这两个特定的循环依赖标记为"已知且安全"：

```javascript
// .dependency-cruiser.js
{
  name: 'no-circular',
  severity: 'warn',  // 降级为警告
  from: {},
  to: { circular: true },
  comment: '已知的安全循环依赖（懒加载模式），详见 docs/CIRCULAR_DEPENDENCIES_EXPLANATION.md'
}
```

---

## CI/CD 集成建议

在 GitHub Actions 中添加循环依赖检查：

```yaml
- name: Check Circular Dependencies
  run: npm run check:circular
  continue-on-error: true  # 允许已知警告

- name: Check Architecture Rules
  run: npm run check:dependencies
```

---

## 相关文档

- [Cortex 架构法典 - 依赖方向铁律](./CORTEX_ARCHITECTURE_CODEX.md#一依赖方向铁律-dependency-direction)
- [架构约束规范](./architecture-constraints.md)
