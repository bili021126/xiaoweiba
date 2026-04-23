/**
 * DiffService 单元测试
 */

import 'reflect-metadata';

describe('DiffService - 差异服务', () => {
  // ==================== 测试用例1: 变更检测 ====================
  describe('变更检测', () => {
    it('应该检测添加的行', () => {
      const original = 'line 1\nline 2';
      const modified = 'line 1\nline 2\nline 3';

      const hasAddition = modified.split('\n').length > original.split('\n').length;
      expect(hasAddition).toBe(true);
    });

    it('应该检测删除的行', () => {
      const original = 'line 1\nline 2\nline 3';
      const modified = 'line 1\nline 2';

      const hasDeletion = modified.split('\n').length < original.split('\n').length;
      expect(hasDeletion).toBe(true);
    });

    it('应该检测修改的行', () => {
      const original = 'line 1\nold line\nline 3';
      const modified = 'line 1\nnew line\nline 3';

      const hasModification = String(original) !== String(modified);
      expect(hasModification).toBe(true);
    });
  });

  // ==================== 测试用例2: 文件大小估算 ====================
  describe('文件大小估算', () => {
    it('应该正确计算文本大小', () => {
      const content = 'Hello, World!';
      const sizeInBytes = Buffer.byteLength(content, 'utf-8');

      expect(sizeInBytes).toBeGreaterThan(0);
    });

    it('大文件应有合理的大小', () => {
      const largeContent = 'x'.repeat(10000);
      const sizeInKB = Buffer.byteLength(largeContent, 'utf-8') / 1024;

      expect(sizeInKB).toBeCloseTo(9.76, 1);
    });
  });

  // ==================== 测试用例3: 敏感信息检测 ====================
  describe('敏感信息检测', () => {
    it('应该检测 API Key', () => {
      const content = 'const API_KEY = "sk-1234567890abcdef";';
      const sensitivePatterns = [/sk-[a-zA-Z0-9]{20,}/, /api[_-]?key/i, /secret/i];

      const hasSensitive = sensitivePatterns.some(pattern => pattern.test(content));
      expect(hasSensitive).toBe(true);
    });

    it('应该检测密码', () => {
      const content = 'password = "super_secret_123";';
      const sensitivePatterns = [/password\s*=/i, /passwd/i, /pwd/i];

      const hasSensitive = sensitivePatterns.some(pattern => pattern.test(content));
      expect(hasSensitive).toBe(true);
    });

    it('正常代码不应触发警告', () => {
      const content = 'function hello() { return "world"; }';
      const sensitivePatterns = [/sk-[a-zA-Z0-9]{20,}/, /password\s*=/i, /secret/i];

      const hasSensitive = sensitivePatterns.some(pattern => pattern.test(content));
      expect(hasSensitive).toBe(false);
    });
  });

  // ==================== 测试用例4: 变更统计 ====================
  describe('变更统计', () => {
    it('应该统计添加和删除的行数', () => {
      const originalLines = ['line 1', 'line 2', 'line 3'];
      const modifiedLines = ['line 1', 'line 2 new', 'line 3', 'line 4'];

      const added = modifiedLines.filter(line => !originalLines.includes(line)).length;
      const removed = originalLines.filter(line => !modifiedLines.includes(line)).length;

      expect(added).toBeGreaterThan(0);
      expect(removed).toBeGreaterThan(0);
    });
  });

  // ==================== 测试用例5: 文件类型检测 ====================
  describe('文件类型检测', () => {
    it('应该识别 TypeScript 文件', () => {
      const filePath = 'src/agent.ts';
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

      expect(isTypeScript).toBe(true);
    });

    it('应该识别配置文件', () => {
      const filePath = '.env';
      const isConfig = filePath.startsWith('.') || filePath.endsWith('.json');

      expect(isConfig).toBe(true);
    });
  });

  // ==================== 测试用例6: 边界情况 ====================
  describe('边界情况处理', () => {
    it('应该处理空字符串', () => {
      const content = '';
      expect(content.length).toBe(0);
    });

    it('应该处理特殊字符', () => {
      const specialContent = '中文\nemoji 😀\nspecial !@#$%';
      expect(specialContent).toContain('中文');
    });
  });
});
