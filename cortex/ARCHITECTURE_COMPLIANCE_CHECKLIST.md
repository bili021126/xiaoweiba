# Cortex 架构合规性检查清单

在每次 PR 合并前，必须完成以下检查。任何一项未通过，PR 不得合并。

---

## 一、依赖方向检查 (DEP-001 ~ DEP-004)

- [ ] **UI 层**是否只依赖 Application Services 和 Domain Ports？
  - ❌ 禁止：`from infrastructure.adapters import ...`
  - ✅ 允许：`from core.ports import MemoryPortal`

- [ ] **Application 层**是否只依赖 Domain Ports 和 Domain Models？
  - ❌ 禁止：`from infrastructure.adapters import SQLiteMemoryAdapter`
  - ✅ 允许：`from core.ports import MemoryPortal`

- [ ] **Infrastructure 层**是否只实现 Domain Ports，不反向导入 Application/UI？
  - ❌ 禁止：`from agents.chat_agent import ChatAgent`
  - ✅ 允许：`from core.ports.memory_portal import MemoryPortal`

- [ ] **Domain Ports** 是否为纯抽象（ABC/Protocol），无实现代码？
  - ❌ 禁止：端口中包含具体逻辑
  - ✅ 允许：仅定义接口签名

---

## 二、通信路径检查 (COM-001 ~ COM-004)

- [ ] **跨模块通信**是否通过 EventBus 发布/订阅事件？
  - ❌ 禁止：`agent_a.call_method_on_agent_b()`
  - ✅ 允许：`event_bus.publish(TaskCompletedEvent(...))`

- [ ] **记忆读写**是否通过 MemoryPortal？
  - ❌ 禁止：`chroma_client.add(...)` 或 `sqlite_conn.execute(...)`
  - ✅ 允许：`memory_portal.store_operation(...)`

- [ ] **Agent 之间**是否避免直接调用？
  - ❌ 禁止：`chat_agent.execute(...)`
  - ✅ 允许：通过 AgentRunner 调度

- [ ] **工具执行**是否通过 ToolGateway 进行权限校验？
  - ❌ 禁止：`os.system(command)`
  - ✅ 允许：`tool_gateway.execute(command, task_token)`

---

## 三、Agent 双向端口检查 (AG-001 ~ AG-006)

- [ ] **Agent 是否实现 SubAgent 端口**？
  - ❌ 禁止：直接继承 ABC 或无基类
  - ✅ 允许：`class ChatAgent(SubAgent)`

- [ ] **Agent 依赖是否通过构造函数注入**？
  - ❌ 禁止：`self.memory = SQLiteMemoryAdapter(...)`
  - ✅ 允许：`def __init__(self, memory_portal: MemoryPortal, ...)`

- [ ] **Agent ID 是否使用 snake_case**？
  - ✅ 允许：`agent_id = "chat_agent"` (snake_case)

- [ ] **Agent 是否发布领域事件**？
  - ❌ 禁止：静默执行，无事件发布
  - ✅ 允许：`await self.event_bus.publish(TaskCompletedEvent(...))`

---

## 四、上帝类预防检查 ⚠️

### 4.1 类规模检查
- [ ] **单个类的方法数是否超过 15 个**？
  - 若超过，必须说明理由并考虑拆分
  - 推荐工具：`radon cc src/ -a -s -n C`

- [ ] **单个类的公开方法是否超过 10 个**？
  - 若超过，可能违反单一职责原则（SRP）

- [ ] **单个文件的代码行数是否超过 500 行**？
  - 若超过，考虑拆分为多个模块

### 4.2 职责单一性检查
- [ ] **Agent 是否包含文件操作或直接 SQL 调用**？
  - ❌ 禁止：`open(file_path, 'w')` 或 `cursor.execute(...)`
  - ✅ 允许：通过 ToolGateway 或 MemoryPortal

- [ ] **ConfigManager 是否深入理解业务配置结构**？
  - ❌ 禁止：`if config['agent']['type'] == 'chat': ...`
  - ✅ 允许：仅提供 `get_config(section, key)` 通用接口

- [ ] **AgentRunner 是否处理所有横切关注点**？
  - ❌ 禁止：同时处理超时、重试、日志、审计、持久化
  - ✅ 允许：委托给 LoopController、AuditLogger、MemoryPortal

### 4.3 事件流复杂度检查
- [ ] **单个事件处理器是否触发超过 3 层链式反应**？
  - 若超过，考虑合并为 Application Service

- [ ] **事件 payload 是否携带过多数据**？
  - ❌ 禁止：`payload = {"entire_context": {...}}`
  - ✅ 允许：仅携带必要字段（如 `task_id`, `agent_id`）

---

## 五、测试覆盖率检查 (TEST-001 ~ TEST-004)

- [ ] **Domain 层覆盖率是否 ≥ 90%**？
- [ ] **Application 层覆盖率是否 ≥ 85%**？
- [ ] **Infrastructure/Agents 层覆盖率是否 ≥ 80%**？
- [ ] **单元测试是否只 Mock 端口抽象，不 Mock 具体实现**？
  - ❌ 禁止：`mock.patch('infrastructure.adapters.SQLiteMemoryAdapter')`
  - ✅ 允许：`mock.MagicMock(spec=MemoryPortal)`

---

## 六、安全底线检查 (SEC-001 ~ SEC-005)

- [ ] **文件写操作是否携带 TaskToken 校验**？
- [ ] **Shell 命令是否通过 CommandInterceptor 拦截危险命令**？
- [ ] **审计日志是否包含 HMAC 签名**？
- [ ] **记忆记录失败是否发布 SystemErrorEvent**？

---

## 七、自动化检查工具

### 7.1 安装 radon（代码复杂度分析）
```bash
pip install radon
```

### 7.2 运行检查
```bash
# 圈复杂度警告（阈值 C）
radon cc cortex/ -a -s -n C

# 原始指标（类行数、方法数）
radon raw cortex/ -s

# 维护指数（低于 65 需警惕）
radon mi cortex/ -s
```

### 7.3 集成到 CI/CD
在 `.github/workflows/ci.yml` 中添加：
```yaml
- name: Check code complexity
  run: |
    pip install radon
    radon cc cortex/ -a -s -n C --fail-under C
    radon raw cortex/ -s --max-lines 500
```

---

## 八、架构健康度评分

每次迭代结束后，对照以下维度打分（1-5 分）：

| 维度 | 评分标准 | 得分 |
|------|---------|------|
| **依赖纯洁性** | 无跨层导入，端口抽象完整 | /5 |
| **事件驱动合规** | 跨模块通信 100% 通过 EventBus | /5 |
| **Agent 双向端口** | 所有 Agent 注入依赖，发布事件 | /5 |
| **上帝类预防** | 无类超过 15 方法/500 行 | /5 |
| **测试覆盖率** | Domain ≥90%, App ≥85%, Infra ≥80% | /5 |

**总分 ≥ 20 分**：架构健康  
**总分 15-19 分**：需要改进  
**总分 < 15 分**：架构危机，暂停新功能开发

---

**签署人**: _______________  
**日期**: _______________
