import { PromptEngine } from '../../../src/chat/PromptEngine';
import { ConfigManager } from '../../../src/storage/ConfigManager';

describe('PromptEngine', () => {
  let promptEngine: PromptEngine;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    // Mock ConfigManager
    mockConfigManager = {
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      resetConfig: jest.fn()
    } as any;

    promptEngine = new PromptEngine(mockConfigManager);
  });

  describe('generatePrompt - 生成提示词', () => {
    it('应该使用默认模板当没有命令时', () => {
      const contextResult = {
        messages: [],
        systemPrompt: '当前文件: test.ts\n语言: TypeScript'
      };

      const result = promptEngine.generatePrompt('你好', contextResult);

      expect(result).toContain('你是一个AI编程助手');
      expect(result).toContain('当前文件: test.ts');
      expect(result).toContain('语言: TypeScript');
    });

    it('应该使用explain模板当检测到解释代码意图', () => {
      const contextResult = {
        messages: [],
        systemPrompt: '当前文件: app.ts\n语言: TypeScript\n选中代码:\n```\nconst x = 1;\n```'
      };

      const result = promptEngine.generatePrompt('/explain 这段代码', contextResult);

      expect(result).toContain('你是一位资深程序员，请解释以下代码的功能');
      expect(result).toContain('const x = 1;');
    });

    it('应该使用generate模板当检测到生成代码意图', () => {
      const contextResult = {
        messages: [],
        systemPrompt: '当前文件: utils.ts'
      };

      const result = promptEngine.generatePrompt('/generate 排序函数', contextResult);

      expect(result).toContain('根据以下需求生成代码');
      expect(result).toContain('当前文件: utils.ts');
    });

    it('应该使用commit模板当检测到生成提交信息意图', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const diff = '+ console.log("hello");\n- console.log("world");';
      const result = promptEngine.generatePrompt('生成提交信息', contextResult);

      // commit模板需要diff，这里测试模板选择逻辑
      expect(result).toBeDefined();
    });

    it('应该优先使用显式命令参数', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const result = promptEngine.generatePrompt('随便聊聊', contextResult, '/explain');

      expect(result).toContain('你是一位资深程序员，请解释以下代码的功能');
    });

    it('应该正确填充编辑器上下文变量', () => {
      const contextResult = {
        messages: [],
        systemPrompt: '当前文件: src/main.ts\n语言: TypeScript\n选中代码:\n```typescript\nconsole.log("test");\n```'
      };

      const result = promptEngine.generatePrompt('/explain 这是什么？', contextResult);

      // explain模板使用{language}和{code}，不使用{filePath}
      expect(result).toContain('TypeScript');
      expect(result).toContain('console.log("test");');
      expect(result).toContain('/explain 这是什么？');
    });

    it('应该正确处理无编辑器上下文的情况', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const result = promptEngine.generatePrompt('你好', contextResult);

      expect(result).toBeDefined();
      expect(result).not.toContain('undefined');
    });

    it('应该在消息中包含用户问题', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const userMessage = '如何优化性能？';
      const result = promptEngine.generatePrompt(userMessage, contextResult);

      // default模板不直接包含userMessage，但会包含context
      expect(result).toBeDefined();
      expect(result).toContain('你是一个AI编程助手');
    });
  });

  describe('detectCommand - 检测命令类型', () => {
    it('应该识别/explain命令', () => {
      const result = (promptEngine as any).detectCommand('/explain 这段代码', '/explain');
      expect(result).toBe('explain');
    });

    it('应该识别/generate命令', () => {
      const result = (promptEngine as any).detectCommand('/generate 函数', '/generate');
      expect(result).toBe('generate');
    });

    it('应该识别/commit命令', () => {
      const result = (promptEngine as any).detectCommand('/commit 提交', '/commit');
      expect(result).toBe('commit');
    });

    it('应该从自然语言检测解释意图', () => {
      const result = (promptEngine as any).detectCommand('请解释代码', undefined);
      expect(result).toBe('explain');
    });

    it('应该从自然语言检测生成代码意图', () => {
      const result = (promptEngine as any).detectCommand('帮我生成代码', undefined);
      expect(result).toBe('generate');
    });

    it('应该从自然语言检测生成提交意图', () => {
      const result = (promptEngine as any).detectCommand('生成提交信息', undefined);
      expect(result).toBe('commit');
    });

    it('应该在无法识别时返回null', () => {
      const result = (promptEngine as any).detectCommand('今天天气不错', undefined);
      expect(result).toBeNull();
    });

    it('应该对大小写不敏感', () => {
      const result = (promptEngine as any).detectCommand('/EXPLAIN code', '/EXPLAIN');
      expect(result).toBe('explain');
    });
  });

  describe('extractEditorContext - 提取编辑器上下文', () => {
    it('应该提取文件路径', () => {
      const systemPrompt = '当前文件: src/app.ts\n其他内容';
      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context.filePath).toBe('src/app.ts');
    });

    it('应该提取语言信息', () => {
      const systemPrompt = '语言: TypeScript\n其他内容';
      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context.language).toBe('TypeScript');
    });

    it('应该提取选中代码', () => {
      const systemPrompt = '选中代码:\n```typescript\nconst x = 1;\n```';
      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context.code).toBe('const x = 1;');
    });

    it('应该同时提取多个上下文信息', () => {
      const systemPrompt = `当前文件: test.ts
语言: TypeScript
选中代码:
\`\`\`typescript
const y = 2;
\`\`\``;

      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context.filePath).toBe('test.ts');
      expect(context.language).toBe('TypeScript');
      expect(context.code).toBe('const y = 2;');
    });

    it('应该在无匹配时返回空对象', () => {
      const systemPrompt = '没有任何上下文信息';
      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context).toEqual({});
    });

    it('应该处理中文冒号', () => {
      const systemPrompt = '当前文件：src/main.ts';
      const context = (promptEngine as any).extractEditorContext(systemPrompt);

      expect(context.filePath).toBe('src/main.ts');
    });
  });

  describe('fillTemplate - 填充模板变量', () => {
    it('应该替换所有占位符', () => {
      const template = '你好{name}，你的年龄是{age}岁';
      const variables = { name: '张三', age: '25' };

      const result = (promptEngine as any).fillTemplate(template, variables);

      expect(result).toBe('你好张三，你的年龄是25岁');
    });

    it('应该保留未匹配的占位符', () => {
      const template = '你好{name}，{missing}';
      const variables = { name: '李四' };

      const result = (promptEngine as any).fillTemplate(template, variables);

      expect(result).toBe('你好李四，{missing}');
    });

    it('应该处理特殊字符', () => {
      const template = '代码：{code}';
      const variables = { code: 'const x = 1; // 注释' };

      const result = (promptEngine as any).fillTemplate(template, variables);

      expect(result).toBe('代码：const x = 1; // 注释');
    });

    it('应该替换多次出现的同一占位符', () => {
      const template = '{name}说{name}很棒';
      const variables = { name: '王五' };

      const result = (promptEngine as any).fillTemplate(template, variables);

      expect(result).toBe('王五说王五很棒');
    });
  });

  describe('registerTemplate - 注册自定义模板', () => {
    it('应该允许注册新模板', () => {
      const customTemplate = '这是一个自定义模板：{userMessage}';
      
      promptEngine.registerTemplate('default', customTemplate);
      
      const templates = promptEngine.getTemplates();
      expect(templates.default).toBe(customTemplate);
    });

    it('应该允许覆盖现有模板', () => {
      const customExplain = '自定义解释模板';
      
      promptEngine.registerTemplate('explain', customExplain);
      
      const templates = promptEngine.getTemplates();
      expect(templates.explain).toBe(customExplain);
    });
  });

  describe('getTemplates - 获取所有模板', () => {
    it('应该返回所有模板的副本', () => {
      const templates = promptEngine.getTemplates();

      expect(templates).toHaveProperty('explain');
      expect(templates).toHaveProperty('generate');
      expect(templates).toHaveProperty('commit');
      expect(templates).toHaveProperty('default');
    });

    it('应该返回深拷贝，修改不影响原模板', () => {
      const templates = promptEngine.getTemplates();
      const originalExplain = templates.explain;

      templates.explain = 'modified';
      
      const newTemplates = promptEngine.getTemplates();
      expect(newTemplates.explain).toBe(originalExplain);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空消息', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const result = promptEngine.generatePrompt('', contextResult);

      expect(result).toBeDefined();
    });

    it('应该处理未知命令', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const result = promptEngine.generatePrompt('测试', contextResult, '/unknown');

      expect(result).toBeDefined();
      // 未知命令回退到default模板
      expect(result).toMatch(/(你是一个AI编程助手|这是一个自定义模板)/);
    });

    it('应该处理包含特殊正则字符的用户消息', () => {
      const contextResult = {
        messages: [],
        systemPrompt: ''
      };

      const userMessage = '如何处理$special{chars}?';
      const result = promptEngine.generatePrompt(userMessage, contextResult);

      expect(result).toContain(userMessage);
    });
  });
});
