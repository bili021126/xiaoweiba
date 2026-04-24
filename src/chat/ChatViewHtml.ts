import * as vscode from 'vscode';
import { CHAT_STYLES } from './html/styles.css';
import { CHAT_TEMPLATE } from './html/template.html';
import { CHAT_SCRIPTS } from './html/app.js';

/**
 * 生成聊天视图的Webview HTML
 * 
 * 架构说明：
 * - 本文件现在是协调器，负责组装 CSS、HTML、JS 三部分
 * - 样式定义在 html/styles.css.ts
 * - HTML 结构在 html/template.html.ts
 * - JavaScript 逻辑在 html/app.js.ts
 * 
 * 优势：
 * - 职责清晰，易于维护
 * - 未来添加反馈计时器等交互时，只需修改 app.js.ts
 * - 可以对纯函数编写单元测试
 */
export function generateChatViewHtml(webview: vscode.Webview): string {
  const cspSource = webview.cspSource;
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
  <title>小尾巴AI助手</title>
  <style>${CHAT_STYLES}</style>
</head>
<body>
  ${CHAT_TEMPLATE}
  <script>${CHAT_SCRIPTS}</script>
</body>
</html>`;
}
