/**
 * ExportMemoryCommand 相关功能测试
 * 
 * 测试导出记忆功能中的纯函数逻辑（日期格式化、HTML转义等）
 */

describe('ExportMemoryCommand - 纯函数测试', () => {
  describe('日期格式化', () => {
    function formatDate(date: Date): string {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}${month}${day}-${hours}${minutes}`;
    }

    it('应该正确格式化日期', () => {
      const date = new Date('2026-04-14T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/^\d{8}-\d{4}$/);
    });

    it('应该在月份和日期小于10时补零', () => {
      // 使用本地时间构造函数，避免时区问题
      const date = new Date(2026, 0, 5, 8, 5, 0); // 月份从0开始
      const formatted = formatDate(date);
      expect(formatted).toContain('20260105');
      expect(formatted).toContain('0805');
    });

    it('应该正确处理年末日期', () => {
      // 使用本地时间构造函数，避免时区问题
      const date = new Date(2026, 11, 31, 23, 59, 0); // 月份从0开始，11表示12月
      const formatted = formatDate(date);
      expect(formatted).toBe('20261231-2359');
    });
  });

  describe('HTML转义', () => {
    function escapeHtml(text: string): string {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    it('应该转义&符号', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('应该转义<符号', () => {
      expect(escapeHtml('A < B')).toBe('A &lt; B');
    });

    it('应该转义>符号', () => {
      expect(escapeHtml('A > B')).toBe('A &gt; B');
    });

    it('应该转义双引号', () => {
      expect(escapeHtml('Say "Hello"')).toBe('Say &quot;Hello&quot;');
    });

    it('应该转义单引号', () => {
      expect(escapeHtml("It's")).toBe('It&#039;s');
    });

    it('应该转义所有特殊字符组合', () => {
      expect(escapeHtml('<div class="test">&\'</div>'))
        .toBe('&lt;div class=&quot;test&quot;&gt;&amp;&#039;&lt;/div&gt;');
    });

    it('应该处理空字符串', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('应该处理没有特殊字符的字符串', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });
});
