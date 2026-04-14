# AI调用性能诊断指南

## 🔍 如何诊断AI调用慢的问题

### 步骤1：查看控制台日志

按 **F5** 调试插件，执行"代码解释"功能，观察控制台输出：

```
[LLMTool] Calling provider: deepseek
[LLMTool] Request sent at: 2026-04-15T02:00:00.000Z
[LLMTool] Response received at: 2026-04-15T02:00:08.500Z
[LLMTool] Duration: 8500ms
[AuditLogger] Log written in 50ms
[EpisodicMemory] Memory recorded in 120ms
```

### 步骤2：分析各阶段耗时

| 阶段 | 正常范围 | 过慢标志 | 可能原因 |
|------|---------|---------|---------|
| **网络请求** | 1-5秒 | >10秒 | 网络延迟、API服务器负载高 |
| **模型推理** | 2-8秒 | >15秒 | 代码复杂度高、maxTokens过大 |
| **脱敏处理** | <50ms | >200ms | 代码量巨大（>1000行） |
| **审计日志** | <100ms | >500ms | 磁盘I/O慢、HMAC计算 |
| **记忆记录** | <200ms | >1000ms | sql.js序列化慢、数据库大 |

### 步骤3：检查常见问题

#### ❌ 问题1：网络延迟过高
**症状：** LLMTool调用耗时>10秒
**解决：**
- 检查网络连接
- 尝试切换到本地Ollama（如果可用）
- 使用代理加速

#### ❌ 问题2：代码片段过大
**症状：** 脱敏处理慢，请求体大
**解决：**
- 限制选中代码行数（建议<200行）
- 分段解释大型函数

#### ❌ 问题3：maxTokens设置过高
**症状：** 响应时间长，生成内容过多
**解决：**
- 降低maxTokens（当前2000，可降至1000）
- 优化prompt，要求简洁回答

#### ❌ 问题4：数据库写入慢
**症状：** 记忆记录耗时>1秒
**解决：**
- 清理过期记忆（运行`xiaoweiba.cleanup-memory`命令）
- 减少记录频率（可选配置）

---

## 🚀 优化建议

### 立即可做的优化

1. **降低maxTokens**
   ```typescript
   // ExplainCodeCommand.ts 第105行
   maxTokens: 1000  // 从2000降至1000
   ```

2. **简化Prompt**
   ```typescript
   // 要求更简洁的回答
   "请用中文简要回答（300字以内）"
   ```

3. **异步记录记忆**
   ```typescript
   // 不等待记忆记录完成就返回
   this.recordMemory(...).catch(err => console.error('Memory record failed:', err));
   ```

### 中期优化（需要开发）

4. **添加响应缓存**
   - 相同代码5分钟内直接返回缓存
   - 减少重复API调用

5. **流式响应**
   - 边生成边显示，提升感知速度
   - 用户不必等待完整响应

6. **批量审计日志**
   - 每10条日志批量写入一次
   - 减少磁盘I/O次数

---

## 📊 性能基准

### DeepSeek API典型延迟（中国大陆）

| 地区 | 平均延迟 | P95延迟 |
|------|---------|---------|
| 北京/上海 | 2-4秒 | 6-8秒 |
| 广州/深圳 | 3-5秒 | 7-10秒 |
| 其他城市 | 4-8秒 | 10-15秒 |

### 预期总耗时

```
网络延迟：    2-8秒
模型推理：    3-10秒
脱敏处理：    0.05秒
审计日志：    0.1秒
记忆记录：    0.2秒
─────────────────────
总计：        5.35-18.35秒
```

**结论：** 如果总耗时在**5-15秒**范围内，属于正常现象。

---

## 🔧 调试命令

在VS Code终端运行以下命令测试API延迟：

```bash
# 测试DeepSeek API连通性
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }' \
  -w "\nTime: %{time_total}s\n"
```

观察`Time`字段，如果>5秒说明网络延迟高。

---

**最后更新：** 2026-04-15 02:05
