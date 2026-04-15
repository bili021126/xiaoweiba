# 🔒 v0.2.1 安全修复测试用例

**版本**: v0.2.1  
**修复日期**: 2026-04-15  
**测试目标**: 验证SQL注入和XSS漏洞修复

---

## 一、SQL注入防护测试

### 1.1 EpisodicMemory.retrieve() - 参数化查询验证

```typescript
describe('EpisodicMemory - SQL注入防护', () => {
  let episodicMemory: EpisodicMemory;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    // 初始化测试数据库
    dbManager = new DatabaseManager(':memory:');
    await dbManager.initialize();
    
    episodicMemory = new EpisodicMemory(
      dbManager,
      mockAuditLogger,
      mockProjectFingerprint
    );
  });

  afterEach(async () => {
    await dbManager.close();
  });

  it('应该使用参数化查询防止SQL注入', async () => {
    // Arrange
    const maliciousTaskType = "'; DROP TABLE episodic_memory; --";
    
    // Act - 尝试SQL注入
    await episodicMemory.retrieve({ taskType: maliciousTaskType });
    
    // Assert - 验证表仍然存在且可查询
    const stats = await episodicMemory.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('应该正确处理包含单引号的正常输入', async () => {
    // Arrange
    const normalInput = "User's code explanation";
    
    // Act
    const results = await episodicMemory.retrieve({
      taskType: normalInput
    });
    
    // Assert
    expect(Array.isArray(results)).toBe(true);
  });

  it('应该防止UNION注入攻击', async () => {
    // Arrange
    const unionInjection = "' UNION SELECT * FROM preference_memory --";
    
    // Act
    const results = await episodicMemory.retrieve({
      taskType: unionInjection
    });
    
    // Assert - 应该返回空数组而非其他表的数据
    expect(results).toEqual([]);
  });

  it('应该使用prepare/bind而非exec进行查询', async () => {
    // Arrange - Mock数据库
    const mockDb = {
      prepare: jest.fn().mockReturnValue({
        bind: jest.fn(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      }),
      exec: jest.fn(),
      run: jest.fn()
    };
    
    const mockDbManager = {
      getDatabase: jest.fn().mockReturnValue(mockDb)
    } as any;
    
    const memory = new EpisodicMemory(
      mockDbManager,
      mockAuditLogger,
      mockProjectFingerprint
    );
    
    // Act
    await memory.retrieve({ taskType: 'test' });
    
    // Assert - 验证使用了prepare而非exec
    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockDb.exec).not.toHaveBeenCalled();
  });

  it('应该正确处理FTS5搜索注入', async () => {
    // Arrange
    const ftsInjection = 'test" OR ""="';
    
    // Act
    const results = await episodicMemory.search(ftsInjection);
    
    // Assert - 不应该抛出异常或返回错误数据
    expect(Array.isArray(results)).toBe(true);
  });

  it('应该在ORDER BY子句使用白名单验证', async () => {
    // Arrange
    const maliciousSortBy = "timestamp; DROP TABLE episodic_memory; --";
    
    // Act
    const results = await episodicMemory.retrieve({
      sortBy: maliciousSortBy as any
    });
    
    // Assert - 应该使用默认的timestamp排序，表仍然完好
    expect(results).toBeDefined();
    const stats = await episodicMemory.getStats();
    expect(stats.totalCount).toBeDefined();
  });
});
```

---

### 1.2 EpisodicMemory.getStats() - 统计查询防护

```typescript
describe('EpisodicMemory.getStats - SQL注入防护', () => {
  it('应该在统计查询中使用参数化查询', async () => {
    // Arrange
    const mockDb = {
      prepare: jest.fn().mockReturnValue({
        bind: jest.fn(),
        step: jest.fn().mockReturnValue(false),
        getAsObject: jest.fn(),
        free: jest.fn()
      })
    };
    
    // Act
    await episodicMemory.getStats();
    
    // Assert
    expect(mockDb.prepare).toHaveBeenCalledTimes(4); // 4个统计查询
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('?') // 包含占位符
    );
  });

  it('应该正确返回统计信息', async () => {
    // Arrange
    await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '测试记忆1',
      outcome: 'SUCCESS'
    });
    
    await episodicMemory.record({
      taskType: 'CODE_GENERATE',
      summary: '测试记忆2',
      outcome: 'SUCCESS'
    });
    
    // Act
    const stats = await episodicMemory.getStats();
    
    // Assert
    expect(stats.totalCount).toBe(2);
    expect(stats.byTaskType['CODE_EXPLAIN']).toBe(1);
    expect(stats.byTaskType['CODE_GENERATE']).toBe(1);
    expect(stats.byOutcome['SUCCESS']).toBe(2);
  });
});
```

---

### 1.3 ImportMemoryCommand - 导入防护

```typescript
describe('ImportMemoryCommand - SQL注入防护', () => {
  it('应该在检查记忆存在时使用参数化查询', async () => {
    // Arrange
    const maliciousMemory = {
      id: "'; DROP TABLE episodic_memory; --",
      summary: '恶意记忆',
      taskType: 'CODE_EXPLAIN',
      outcome: 'SUCCESS',
      timestamp: Date.now()
    };
    
    const command = new ImportMemoryCommand(
      episodicMemory,
      mockAuditLogger
    );
    
    // Act - 使用反射调用私有方法
    const exists = await (command as any).checkMemoryExists(maliciousMemory);
    
    // Assert - 应该返回false且数据库完好
    expect(exists).toBe(false);
    const stats = await episodicMemory.getStats();
    expect(stats.totalCount).toBeDefined();
  });

  it('应该正确处理包含特殊字符的记忆ID', async () => {
    // Arrange
    const specialIdMemory = {
      id: "test'; SELECT * FROM episodic_memory WHERE '1'='1",
      summary: '测试记忆',
      taskType: 'CODE_EXPLAIN',
      outcome: 'SUCCESS',
      timestamp: Date.now()
    };
    
    // Act
    const exists = await (command as any).checkMemoryExists(specialIdMemory);
    
    // Assert
    expect(exists).toBe(false);
  });
});
```

---

## 二、XSS防护测试

### 2.1 ExplainCodeCommand - HTML转义

```typescript
describe('ExplainCodeCommand - XSS防护', () => {
  let command: ExplainCodeCommand;

  beforeEach(() => {
    command = new ExplainCodeCommand(
      mockLLMTool,
      episodicMemory,
      mockAuditLogger
    );
  });

  it('应该转义<script>标签', () => {
    // Arrange
    const maliciousExplanation = '<script>alert("XSS")</script>';
    
    // Act
    const html = (command as any).escapeHtml(maliciousExplanation);
    
    // Assert
    expect(html).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('应该转义事件处理器', () => {
    // Arrange
    const eventHandler = '<img src=x onerror="alert(\'XSS\')">';
    
    // Act
    const html = (command as any).escapeHtml(eventHandler);
    
    // Assert
    expect(html).toContain('&lt;img');
    expect(html).toContain('onerror=');
    expect(html).not.toContain('<img');
  });

  it('应该转义所有HTML特殊字符', () => {
    // Arrange
    const specialChars = '&<>"\'';
    
    // Act
    const html = (command as any).escapeHtml(specialChars);
    
    // Assert
    expect(html).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('应该在生成的HTML中使用转义后的内容', () => {
    // Arrange
    const maliciousCode = '<script>document.cookie</script>';
    
    // Act - 模拟生成解释HTML
    const explanationHtml = (command as any).escapeHtml(maliciousCode)
      .replace(/\n/g, '<br>');
    
    // Assert
    expect(explanationHtml).not.toContain('<script>');
    expect(explanationHtml).toContain('&lt;script&gt;');
  });
});
```

---

### 2.2 ChatViewProvider - Webview防护

```typescript
describe('ChatViewProvider - Webview XSS防护', () => {
  let provider: ChatViewProvider;

  beforeEach(() => {
    provider = new ChatViewProvider(
      mockContext,
      mockLLMTool,
      mockEpisodicMemory,
      mockPreferenceMemory,
      mockConfigManager,
      mockAuditLogger
    );
  });

  it('应该在CSP中禁用unsafe-inline', () => {
    // Act
    const html = (provider as any).getHtmlForWebview(mockWebview);
    
    // Assert
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html).toContain('script-src https://cdn.jsdelivr.net');
  });

  it('应该引入DOMPurify库', () => {
    // Act
    const html = (provider as any).getHtmlForWebview(mockWebview);
    
    // Assert
    expect(html).toContain('dompurify');
    expect(html).toContain('purify.min.js');
  });

  it('应该在renderMarkdown中使用DOMPurify.sanitize', () => {
    // Act
    const html = (provider as any).getHtmlForWebview(mockWebview);
    
    // Assert
    expect(html).toContain('DOMPurify.sanitize');
    expect(html).toContain('ALLOWED_TAGS');
    expect(html).toContain('ALLOWED_ATTR');
  });

  it('应该配置严格的ALLOWED_TAGS白名单', () => {
    // Act
    const html = (provider as any).getHtmlForWebview(mockWebview);
    
    // Assert
    expect(html).toContain("'script'"); // 注意：不应该允许script标签
    expect(html).not.toMatch(/ALLOWED_TAGS.*'script'/);
  });

  it('应该提供escapeHtml辅助函数', () => {
    // Act
    const html = (provider as any).getHtmlForWebview(mockWebview);
    
    // Assert
    expect(html).toContain('function escapeHtml');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
  });
});
```

---

## 三、回归测试

### 3.1 确保原有功能正常工作

```typescript
describe('安全修复回归测试', () => {
  it('EpisodicMemory.retrieve应该正常检索记忆', async () => {
    // Arrange
    const memory = await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '正常记忆',
      outcome: 'SUCCESS'
    });
    
    // Act
    const results = await episodicMemory.retrieve({
      taskType: 'CODE_EXPLAIN'
    });
    
    // Assert
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].summary).toBe('正常记忆');
  });

  it('EpisodicMemory.search应该正常搜索记忆', async () => {
    // Arrange
    await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '搜索测试记忆',
      outcome: 'SUCCESS'
    });
    
    // Act
    const results = await episodicMemory.search('搜索测试');
    
    // Assert
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('EpisodicMemory.getStats应该正确统计', async () => {
    // Arrange
    await episodicMemory.record({
      taskType: 'CODE_EXPLAIN',
      summary: '记忆1',
      outcome: 'SUCCESS'
    });
    
    // Act
    const stats = await episodicMemory.getStats();
    
    // Assert
    expect(stats.totalCount).toBeGreaterThanOrEqual(1);
    expect(stats.byTaskType).toBeDefined();
    expect(stats.byOutcome).toBeDefined();
  });

  it('ImportMemoryCommand应该正常导入记忆', async () => {
    // Arrange
    const validMemory = {
      id: 'valid-id-123',
      summary: '导入测试',
      taskType: 'CODE_EXPLAIN',
      outcome: 'SUCCESS',
      timestamp: Date.now(),
      projectFingerprint: 'test-fingerprint'
    };
    
    // Act
    const result = await command.importMemories([validMemory]);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(1);
  });
});
```

---

## 四、性能测试

### 4.1 参数化查询性能验证

```typescript
describe('参数化查询性能测试', () => {
  it('参数化查询性能应该可接受', async () => {
    // Arrange
    const iterations = 100;
    const times: number[] = [];
    
    // Act
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await episodicMemory.retrieve({
        taskType: 'CODE_EXPLAIN',
        limit: 10
      });
      times.push(Date.now() - start);
    }
    
    // Assert
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(100); // 平均响应时间<100ms
  });
});
```

---

## 五、测试执行命令

```bash
# 运行安全测试
npm test -- tests/unit/security/

# 运行SQL注入防护测试
npm test -- tests/unit/memory/EpisodicMemory.test.ts -t "SQL注入"

# 运行XSS防护测试
npm test -- tests/unit/commands/ExplainCodeCommand.test.ts -t "XSS"

# 生成安全测试覆盖率报告
npm test -- --coverage --coverageReporters=html --coverageDirectory=coverage-security
```

---

## 六、验收标准

- [ ] 所有SQL注入测试用例通过
- [ ] 所有XSS防护测试用例通过
- [ ] 回归测试100%通过
- [ ] 参数化查询性能符合预期（<100ms）
- [ ] 覆盖率不低于修复前水平
- [ ] 无新的安全漏洞引入

---

**测试编写者**: AI代码审查助手  
**测试日期**: 2026-04-15  
**测试状态**: 待执行
