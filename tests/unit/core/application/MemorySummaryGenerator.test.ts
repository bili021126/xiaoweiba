import 'reflect-metadata';
import { MemorySummaryGenerator } from '../../../../src/core/application/MemorySummaryGenerator';

describe('MemorySummaryGenerator', () => {
  let generator: MemorySummaryGenerator;

  beforeEach(() => {
    generator = new MemorySummaryGenerator();
  });

  describe('generateSummary', () => {
    it('should generate summary for explain_code', () => {
      const intent = {
        name: 'explain_code' as any,
        codeContext: { filePath: '/path/to/file.ts' }
      };

      const summary = generator.generateSummary(intent as any, {});

      expect(summary).toContain('解释了');
      expect(summary).toContain('file.ts');
    });

    it('should generate summary for generate_commit', () => {
      const intent = { name: 'generate_commit' as any };
      const result = { data: { commitMessage: 'feat: add new feature' } };

      const summary = generator.generateSummary(intent as any, result);

      expect(summary).toContain('生成了提交信息');
      expect(summary).toContain('feat: add new feature');
    });

    it('should generate summary for generate_code', () => {
      const intent = {
        name: 'generate_code' as any,
        codeContext: { filePath: '/src/app.ts' }
      };

      const summary = generator.generateSummary(intent as any, {});

      expect(summary).toContain('生成代码');
      expect(summary).toContain('app.ts');
    });

    it('should generate summary for check_naming', () => {
      const intent = {
        name: 'check_naming' as any,
        codeContext: { filePath: '/src/utils.ts' }
      };

      const summary = generator.generateSummary(intent as any, {});

      expect(summary).toContain('检查了');
      expect(summary).toContain('utils.ts');
    });

    it('should generate summary for optimize_sql', () => {
      const intent = { name: 'optimize_sql' as any };

      const summary = generator.generateSummary(intent as any, {});

      expect(summary).toBe('优化了SQL查询');
    });

    it('should generate default summary for unknown intent', () => {
      const intent = { name: 'unknown_intent' as any };

      const summary = generator.generateSummary(intent as any, {});

      expect(summary).toBe('执行了 unknown_intent');
    });
  });

  describe('extractEntities', () => {
    it('should extract file path', () => {
      const intent = {
        codeContext: { filePath: '/path/to/file.ts' }
      };

      const entities = generator.extractEntities(intent as any);

      expect(entities).toContain('/path/to/file.ts');
    });

    it('should extract language', () => {
      const intent = {
        codeContext: { filePath: '/file.ts', language: 'typescript' }
      };

      const entities = generator.extractEntities(intent as any);

      expect(entities).toContain('typescript');
    });

    it('should extract keywords from user input', () => {
      const intent = {
        userInput: 'hello world this is a test'
      };

      const entities = generator.extractEntities(intent as any);

      expect(entities).toContain('hello');
      expect(entities).toContain('world');
      expect(entities).toContain('test');
    });

    it('should limit keywords to 5', () => {
      const intent = {
        userInput: 'one two three four five six seven eight nine ten'
      };

      const entities = generator.extractEntities(intent as any);
      const keywords = entities.filter(e => !e.includes('/'));

      expect(keywords.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array for minimal intent', () => {
      const intent = {};

      const entities = generator.extractEntities(intent as any);

      expect(entities).toEqual([]);
    });

    it('should combine all entities', () => {
      const intent = {
        codeContext: { filePath: '/file.ts', language: 'ts' },
        userInput: 'test function'
      };

      const entities = generator.extractEntities(intent as any);

      expect(entities).toContain('/file.ts');
      expect(entities).toContain('ts');
      expect(entities).toContain('test');
      expect(entities).toContain('function');
    });
  });
});
