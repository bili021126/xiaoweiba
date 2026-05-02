# Cortex - 思想熔炉，概念创造平台

> **Cortex 不是你写代码的工具。你是概念创造者，Cortex 是实现者。**  
> 你表达概念，它将概念熔炼为现实。没有一行代码需要你亲手写，只有你的意志和决策。

## 🚀 快速开始

### 前置要求

- Python 3.10+
- DeepSeek API Key（从 https://platform.deepseek.com 获取）

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd cortex

# 使用 Poetry（推荐）
poetry install

# 或使用 pip
pip install -r requirements.txt
```

### 配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 DeepSeek API Key
vim .env
```

### 运行

```bash
# 启动 FastAPI 后端
uvicorn api.main:app --reload

# 启动 Textual TUI（开发中）
python frontend/terminal/app.py
```

## 📁 项目结构

```
cortex/
├── core/                    # 核心框架
│   ├── deepseek_client.py   # DeepSeek API 客户端
│   ├── event_bus.py         # 事件总线
│   └── ...
├── agents/                  # Agent 实现
│   ├── base_agent.py        # AutonomousAgent 基类
│   ├── chat_agent.py        # 闲聊 Agent
│   └── ...
├── memory/                  # 记忆系统
│   ├── hybrid_retriever.py  # 混合检索器
│   └── ...
├── api/                     # FastAPI 路由
│   ├── main.py              # 应用入口
│   └── routes/
├── frontend/                # 前端应用
│   ├── terminal/            # Textual TUI
│   └── web/                 # React Web UI
└── tests/                   # 测试套件
```

## 🏗️ 架构

Cortex 基于**意图驱动架构**和**四层记忆系统**：

### 三大核心引擎

1. **概念具象化引擎** - 将模糊概念转化为结构化蓝图
2. **全自主执行引擎** - 将蓝图自动实现为可运行软件
3. **思维可视化引擎** - 让用户理解 AI 的决策过程

### 四层记忆

- **概念记忆** - 项目概述、架构偏好、技术栈
- **技能记忆** - 用户沉淀的技能模板、成功模式
- **情景记忆** - 操作轨迹、任务历史
- **认知知识库** - 外部技术摘要、最佳实践

## 📖 文档

- [架构宪章 v2.0](../docs/ARCHITECTURE_CHARTER.md) - 最高技术准则
- [Cortex 终极架构](../docs/Cortex%20终极架构：详细设计文档.md) - 详细设计文档
- [核心三原则](../docs/CORE_PRINCIPLES.md) - 项目宪法

## 🧪 测试

```bash
# 运行所有测试
pytest

# 运行单元测试
pytest tests/unit

# 运行集成测试
pytest tests/integration

# 运行 E2E 测试
pytest tests/e2e
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**这就是编码的终结，创造的开始。**
