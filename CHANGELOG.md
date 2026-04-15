# Changelog

所有重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [0.1.0] - 2026-04-15

### ✨ 新增功能

#### F11: 代码生成 (Code Generation)
- 🎯 根据自然语言需求生成代码
- 🌍 支持15+编程语言（TypeScript, JavaScript, Python, Java等）
- 💡 智能Markdown代码提取
- 📋 多种操作选项：
  - 插入到光标位置
  - 创建新文件
  - 复制到剪贴板
  - 重新生成
- 💾 情景记忆自动记录
- ⚡ LLM响应缓存（5分钟TTL，最多100条）
- 📊 进度提示优化（emoji + 增量显示）

#### F14: 命名检查 (Naming Check)
- 🔍 AI驱动的命名规范检查
- 📈 评分系统（0-100分）
- 💡 智能改进建议
- ✨ 一键应用推荐命名
- 🌐 多语言支持

### 🎨 UI/UX优化

#### 全新UI系统 (v0.1.0重构)
- 🎨 **组件化设计** - 可复用UI组件库
  - `generateButton()` - 按钮组件
  - `generateCard()` - 卡片组件
  - `generateBadge()` - 徽章组件
  - `generateCodeBlock()` - 代码块组件
  - `generateProgress()` - 进度条组件
  - `generateAlert()` - 警告框组件
  - `generateLoadingSpinner()` - 加载动画
  - `generateEmptyState()` - 空状态组件

- 🎯 **设计令牌系统** - 统一的设计规范
  - 间距系统 (8px基准)
  - 圆角规范 (4px-9999px)
  - 阴影层次 (sm-xl)
  - 过渡动画 (fast/slow)
  - 字体大小 (xs-xxxl)

- 💫 **流畅动画**
  - fade-in 渐入效果
  - shimmer 进度条闪光
  - spin 加载旋转
  - hover 悬停反馈

- 🌙 **主题适配**
  - 自动适配VS Code深色/浅色主题
  - 使用CSS变量 (--vscode-*)
  - 无障碍访问支持

#### F01: 代码解释
- ✨ 使用新UI系统重构
- 🎨 现代化卡片布局
- 📋 一键复制代码功能
- 🏷️ 语言标识badge
- 💫 渐入动画效果

#### F02: 提交生成
- 🚀 Emoji进度提示
- 📊 增量进度显示（10%→30%→50%→80%→100%）
- ✅ 完成状态反馈

#### 全局优化
- ⚠️ 统一错误提示图标
- 💬 友好的用户消息
- 🎯 清晰的视觉层次

### ⚡ 性能优化

#### LLM响应缓存系统
- 📦 新建`LLMResponseCache`类
- 🔑 基于prompt哈希的缓存键
- ⏱️ 5分钟默认TTL
- 🔄 LRU淘汰策略（最多100条）
- 📈 避免重复API调用，提升响应速度

### 🧪 测试改进

#### 测试覆盖
- ✅ **13个测试套件** - 全部通过
- ✅ **259个测试用例** - 全部通过 (100%通过率)
- ✅ **代码覆盖率**: 80.23% (超越65%目标)
- ✅ **分支覆盖率**: 71.87% (超越48%目标)
- ✅ **函数覆盖率**: 78.8% (超越68%目标)

#### 新增测试
- CodeGenerationCommand: 22个测试用例，91.3%覆盖率
- LLMResponseCache Mock配置
- 集成测试语法修复（Mocha → Jest兼容）

#### 文档
- 📄 新建`docs/testing-guide.md` - 完整测试指南
- 📄 新建`docs/test-report-v0.1.0.md` - 详细测试报告
- 📝 更新`docs/bugfix-summary.md`

### 🐛 Bug修复

#### F08: 记忆导入
- 🔧 改进去重逻辑（优先ID检查，其次摘要+时间戳）
- 📝 添加详细日志追踪
- ✅ 解决导入后记录数不变的问题

#### 测试修复
- 🔧 ExplainCodeCommand测试断言更新（匹配UI优化）
- 🔧 集成测试Mocha/Jest语法冲突解决
- 🔧 LLMResponseCache Mock配置完善

### 📦 技术改进

#### 架构
- 新增`src/core/cache/`目录 - LLM响应缓存
- **新增`src/ui/`目录 - UI组件库**
  - `styles.ts` - 设计令牌和样式生成器
  - `components.ts` - UI组件生成器
- 命令处理器统一缓存集成
- 依赖注入优化

#### 代码质量
- TypeScript严格模式
- 完整的类型定义
- 详细的JSDoc注释
- 统一的错误处理

### 📚 文档更新

- ✅ `README.md` - 功能列表更新
- ✅ `docs/xiaoweiba.md` - 需求文档同步
- ✅ `docs/bugfix-summary.md` - Bug修复记录
- ✅ `docs/test-report.md` - 测试报告
- ✅ `docs/testing-guide.md` - 测试指南（新建）
- ✅ `CHANGELOG.md` - 版本更新日志（本文件）

### 🎯 质量指标

| 指标 | v0.1.0 | 目标 | 状态 |
|------|--------|------|------|
| 测试通过率 | 100% | 100% | ✅ |
| 代码覆盖率 | 80.23% | 65% | ✅ 超额 |
| 分支覆盖率 | 71.87% | 48% | ✅ 超额 |
| 函数覆盖率 | 78.8% | 68% | ✅ 超额 |
| 综合质量分 | 80.23% | 99.5% | ⏳ 进行中 |

### 📊 已知问题

1. ⚠️ 核心模块覆盖率偏低
   - EpisodicMemory: 6.66%
   - DatabaseManager: 6.17%
   - LLMTool: 9.87%
   - **计划**: v0.2.0提升至80%+

2. ⚠️ 集成测试使用Mocha语法
   - 无法在`npm test`中运行
   - 需单独运行`npm run test:integration`
   - **计划**: v0.2.0迁移到Jest

### 🚀 下一步计划 (v0.2.0)

1. **提升核心模块覆盖率** - 目标80%+
2. **完成P1功能** - F12单元测试生成、F13 SQL优化
3. **集成测试迁移** - Mocha → Jest
4. **E2E测试自动化** - vscode-test-electron
5. **向99.5%质量标准迈进**

---

## [0.0.x] - 早期开发版本

### P0功能完成
- F01: 代码解释
- F02: 提交生成
- F03: 情景记忆
- F08: 记忆导出/导入

### 基础设施
- TypeScript项目搭建
- Jest测试框架
- 依赖注入（tsyringe）
- SQLite数据库（sql.js）
- LLM集成（DeepSeek）

---

## 版本说明

### 语义化版本格式

- **主版本号**.次版本号.修订号
- **主版本号**: 不兼容的API修改
- **次版本号**: 向后兼容的功能性新增
- **修订号**: 向后兼容的问题修正

### 更新频率

- **小版本** (0.x.0): 每2-4周
- **修订版** (0.0.x): 按需发布（Bug修复）

---

**比较**: 
- [0.1.0](https://github.com/bili021126/xiaoweiba/compare/v0.0.x...v0.1.0)
