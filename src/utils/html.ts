/**
 * HTML 转义工具
 * 用于防止 XSS 攻击
 */

/**
 * 转义 HTML 特殊字符
 * @param text - 原始文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
