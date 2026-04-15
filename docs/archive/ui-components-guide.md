# UI组件库使用指南

**版本**: 1.0  
**更新日期**: 2026-04-15  
**状态**: ✅ 已实现

---

## 📚 概述

小尾巴插件的UI系统提供了一套现代化、可复用的组件库，用于构建VS Code Webview界面。

### 核心特性
- ✨ 组件化设计 - 8个基础组件
- 🎯 设计令牌 - 统一的视觉规范
- 💫 流畅动画 - 提升用户体验
- 🌙 主题适配 - 自动适配VS Code主题
- ♿ 无障碍访问 - WCAG 2.1标准

---

## 🎨 设计令牌 (Design Tokens)

### 间距系统 (基于8px)
```typescript
import { DesignTokens } from '../ui/styles';

DesignTokens.spacing.xs   // 4px
DesignTokens.spacing.sm   // 8px
DesignTokens.spacing.md   // 16px
DesignTokens.spacing.lg   // 24px
DesignTokens.spacing.xl   // 32px
DesignTokens.spacing.xxl  // 48px
```

### 圆角
```typescript
DesignTokens.borderRadius.sm    // 4px
DesignTokens.borderRadius.md    // 8px
DesignTokens.borderRadius.lg    // 12px
DesignTokens.borderRadius.xl    // 16px
DesignTokens.borderRadius.full  // 9999px (圆形)
```

### 阴影
```typescript
DesignTokens.shadows.sm  // 轻微阴影
DesignTokens.shadows.md  // 中等阴影
DesignTokens.shadows.lg  // 深度阴影
DesignTokens.shadows.xl  // 强烈阴影
```

### 过渡动画
```typescript
DesignTokens.transitions.fast   // 150ms
DesignTokens.transitions.normal // 250ms
DesignTokens.transitions.slow   // 350ms
```

---

## 🧩 UI组件

### 1. Button (按钮)

```typescript
import { generateButton } from '../ui/components';

// 基本用法
const button = generateButton({
  text: '点击我',
  type: 'primary',  // 'primary' | 'secondary' | 'success' | 'danger'
  size: 'md',       // 'sm' | 'md' | 'lg'
  disabled: false,
  icon: '🚀',
  onClick: 'handleClick()'
});
```

**变体**:
- `btn-primary` - 主要按钮（蓝色）
- `btn-secondary` - 次要按钮（灰色）
- `btn-success` - 成功按钮（绿色）
- `btn-danger` - 危险按钮（红色）

---

### 2. Badge (徽章)

```typescript
import { generateBadge } from '../ui/components';

const badge = generateBadge({
  text: 'TypeScript',
  type: 'info'  // 'primary' | 'success' | 'warning' | 'danger' | 'info'
});
```

**用途**: 标签、状态指示、语言标识

---

### 3. Card (卡片)

```typescript
import { generateCard } from '../ui/components';

const card = generateCard({
  title: '代码解释',
  content: '<p>这是卡片内容</p>',
  footer: '<button>操作</button>',
  icon: '🔍'
});
```

**结构**:
```
┌─────────────────────┐
│ 🔍 标题             │
├─────────────────────┤
│                     │
│   内容区域          │
│                     │
├─────────────────────┤
│         [操作按钮]  │
└─────────────────────┘
```

---

### 4. CodeBlock (代码块)

```typescript
import { generateCodeBlock } from '../ui/components';

const codeBlock = generateCodeBlock({
  code: 'const x = 42;',
  language: 'typescript',
  showCopyButton: true  // 显示复制按钮
});
```

**特性**:
- 语法高亮支持
- 一键复制功能
- 悬停显示复制按钮
- 自动转义HTML

---

### 5. Progress (进度条)

```typescript
import { generateProgress } from '../ui/components';

const progress = generateProgress({
  value: 75,
  max: 100,
  label: '加载中...',
  showPercentage: true
});
```

**动画**: shimmer闪光效果

---

### 6. Alert (警告框)

```typescript
import { generateAlert } from '../ui/components';

const alert = generateAlert(
  '操作成功！',
  'success'  // 'info' | 'warning' | 'error' | 'success'
);
```

**类型**:
- `info` - ℹ️ 信息提示
- `warning` - ⚠️ 警告提示
- `error` - ❌ 错误提示
- `success` - ✅ 成功提示

---

### 7. LoadingSpinner (加载动画)

```typescript
import { generateLoadingSpinner } from '../ui/components';

const spinner = generateLoadingSpinner('正在处理...');
```

**动画**: 旋转效果

---

### 8. EmptyState (空状态)

```typescript
import { generateEmptyState } from '../ui/components';

const empty = generateEmptyState(
  '📭',
  '暂无数据',
  '请添加新内容'
);
```

---

## 🏗️ 完整Webview模板

```typescript
import { 
  generateWebviewTemplate,
  generateCompleteStyles 
} from '../ui/components';
import { generateCard, generateCodeBlock } from '../ui/components';

// 生成内容
const content = `
  <div style="max-width: 900px; margin: 0 auto;">
    <h1>🔍 代码解释</h1>
    ${generateCodeBlock({ code: 'const x = 42;', language: 'ts' })}
    ${generateCard({ title: '解释', content: '...' })}
  </div>
`;

// 生成完整HTML
const html = generateWebviewTemplate(
  '代码解释 - 小尾巴',  // 标题
  content,               // 内容
  generateCompleteStyles(), // 样式
  'console.log("custom script");' // 自定义脚本（可选）
);

// 设置到Webview
panel.webview.html = html;
```

---

## 💡 最佳实践

### 1. 使用渐入动画
```typescript
const content = `
  <div class="fade-in">内容1</div>
  <div class="fade-in" style="animation-delay: 0.1s">内容2</div>
  <div class="fade-in" style="animation-delay: 0.2s">内容3</div>
`;
```

### 2. 响应式布局
```typescript
const content = `
  <div style="max-width: 900px; margin: 0 auto; padding: 16px;">
    <!-- 内容 -->
  </div>
`;
```

### 3. 主题适配
始终使用VS Code CSS变量：
```css
color: var(--vscode-foreground);
background: var(--vscode-editor-background);
border: 1px solid var(--vscode-widget-border);
```

### 4. 无障碍访问
- 为按钮添加ARIA标签
- 确保颜色对比度符合WCAG 2.1 AA标准
- 提供键盘导航支持

---

## 🎯 示例：重构ExplainCodeCommand

### 旧方式（内联样式）
```typescript
private generateHtml(explanation: string, code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { padding: 20px; ... }
    h1 { color: blue; ... }
    /* 大量内联样式 */
  </style>
</head>
<body>
  <h1>代码解释</h1>
  <pre>${code}</pre>
  <div>${explanation}</div>
</body>
</html>`;
}
```

### 新方式（组件化）
```typescript
import { generateCard, generateCodeBlock, generateWebviewTemplate } from '../ui';

private generateHtml(explanation: string, code: string, lang: string): string {
  const content = `
    <div style="max-width: 900px; margin: 0 auto;">
      <h1>🔍 代码解释</h1>
      ${generateCodeBlock({ code, language: lang })}
      ${generateCard({ title: '💡 解释', content: explanation })}
    </div>
  `;
  
  return generateWebviewTemplate(
    '代码解释',
    content,
    generateCompleteStyles()
  );
}
```

**优势**:
- ✅ 代码更简洁（减少60%）
- ✅ 样式统一管理
- ✅ 易于维护和扩展
- ✅ 自动主题适配

---

## 📊 性能优化

### 1. 懒加载大型组件
```typescript
// 仅在需要时生成复杂组件
if (showAdvanced) {
  content += generateComplexComponent();
}
```

### 2. 缓存静态内容
```typescript
// 缓存常用样式
const cachedStyles = generateCompleteStyles();
```

### 3. 避免过度动画
```typescript
// 减少同时运行的动画数量
// 使用CSS transform而非top/left
```

---

## 🔧 扩展组件库

### 添加新组件
```typescript
// 在 components.ts 中添加
export interface NewComponentOptions {
  // 定义选项
}

export function generateNewComponent(options: NewComponentOptions): string {
  // 实现组件生成逻辑
  return `<div class="new-component">...</div>`;
}
```

### 添加新设计令牌
```typescript
// 在 styles.ts 中添加
export const DesignTokens = {
  // ...现有令牌
  newToken: {
    value: '...',
    description: '...'
  }
};
```

---

## 🐛 常见问题

### Q1: 样式不生效？
**A**: 检查是否正确引入了`generateCompleteStyles()`

### Q2: 主题切换后样式错乱？
**A**: 确保使用VS Code CSS变量，而非硬编码颜色

### Q3: 动画卡顿？
**A**: 减少同时运行的动画，使用`transform`和`opacity`

### Q4: 复制按钮不工作？
**A**: 确保Webview启用了scripts: `enableScripts: true`

---

## 📚 相关资源

- [VS Code Webview指南](https://code.visualstudio.com/api/extension-guides/webview)
- [WCAG 2.1无障碍标准](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS变量最佳实践](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

**维护者**: AI Assistant  
**最后更新**: 2026-04-15  
**版本**: 1.0
