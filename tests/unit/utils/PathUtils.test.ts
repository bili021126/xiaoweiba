/**
 * PathUtils 单元测试 - 验证跨平台路径处理
 */

import { PathUtils } from '../../../src/utils/ProjectFingerprint';

describe('PathUtils Unit Tests', () => {
  it('should extract filename from Unix path', () => {
    expect(PathUtils.getFileName('/usr/local/bin/test.ts')).toBe('test.ts');
  });

  it('should extract filename from Windows path', () => {
    expect(PathUtils.getFileName('C:\\Users\\Test\\file.js')).toBe('file.js');
  });

  it('should handle paths without directory', () => {
    expect(PathUtils.getFileName('index.html')).toBe('index.html');
  });

  it('should return empty string for empty input', () => {
    expect(PathUtils.getFileName('')).toBe('');
  });

  it('should handle trailing slashes', () => {
    expect(PathUtils.getFileName('/path/to/dir/')).toBe('dir');
  });
});
