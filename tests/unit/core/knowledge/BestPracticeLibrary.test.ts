import { BestPracticeLibrary } from 'D:/xiaoweiba/src/core/knowledge/BestPracticeLibrary.ts';

describe('BestPracticeLibrary - 最佳实践库', () => {
  let library: BestPracticeLibrary;

  beforeEach(() => {
    library = new BestPracticeLibrary();
  });

  describe('初始化', () => {
    it('应该加载内置最佳实践', () => {
      const all = library.getAll();
      expect(all.length).toBeGreaterThanOrEqual(10);
    });

    it('应该包含所有分类', () => {
      const stats = library.getStats();
      expect(stats.byCategory).toHaveProperty('CODE_STYLE');
      expect(stats.byCategory).toHaveProperty('SQL_OPTIMIZATION');
      expect(stats.byCategory).toHaveProperty('SECURITY');
      expect(stats.byCategory).toHaveProperty('PERFORMANCE');
    });
  });

  describe('getByCategory - 按分类获取', () => {
    it('应该返回指定分类的所有实践', () => {
      const practices = library.getByCategory('CODE_STYLE');
      expect(practices.length).toBeGreaterThanOrEqual(3);
      expect(practices[0].category).toBe('CODE_STYLE');
    });

    it('应该在无匹配时返回空数组', () => {
      const practices = library.getByCategory('DESIGN_PATTERN' as any);
      expect(practices).toEqual([]);
    });
  });

  describe('searchByTags - 按标签搜索', () => {
    it('应该返回包含指定标签的实践', () => {
      const practices = library.searchByTags(['security']);
      expect(practices.length).toBeGreaterThanOrEqual(1);
      expect(practices.some((p: any) => p.tags.includes('security'))).toBe(true);
    });

    it('应该支持多标签搜索', () => {
      const practices = library.searchByTags(['performance', 'cache']);
      expect(practices.length).toBeGreaterThanOrEqual(1);
    });

    it('应该在无匹配时返回空数组', () => {
      const practices = library.searchByTags(['nonexistent']);
      expect(practices).toEqual([]);
    });
  });

  describe('getById - 按ID获取', () => {
    it('应该返回指定ID的实践', () => {
      const practice = library.getById('cs_001');
      expect(practice).toBeDefined();
      expect(practice?.title).toBe('使用const/let代替var');
    });

    it('应该在ID不存在时返回undefined', () => {
      const practice = library.getById('nonexistent');
      expect(practice).toBeUndefined();
    });
  });

  describe('getStats - 统计信息', () => {
    it('应该返回正确的总数', () => {
      const stats = library.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(10);
    });

    it('应该按分类正确计数', () => {
      const stats = library.getStats();
      const values = Object.values(stats.byCategory) as number[];
      const totalFromCategories = values.reduce((sum, count) => sum + count, 0);
      expect(totalFromCategories).toBe(stats.total);
    });
  });

  describe('exportToJson - 导出', () => {
    it('应该导出有效的JSON', () => {
      const json = library.exportToJson();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(10);
    });

    it('导出的数据应包含所有必要字段', () => {
      const json = library.exportToJson();
      const practices = JSON.parse(json);
      
      expect(practices[0]).toHaveProperty('id');
      expect(practices[0]).toHaveProperty('category');
      expect(practices[0]).toHaveProperty('title');
      expect(practices[0]).toHaveProperty('description');
      expect(practices[0]).toHaveProperty('examples');
      expect(practices[0]).toHaveProperty('tags');
    });
  });

  describe('importFromJson - 导入', () => {
    it('应该导入新的最佳实践', () => {
      const newPractices = [
        {
          id: 'custom_001',
          category: 'CODE_STYLE',
          title: '自定义实践',
          description: '测试描述',
          examples: ['example'],
          tags: ['test']
        }
      ];

      const imported = library.importFromJson(JSON.stringify(newPractices));
      expect(imported).toBe(1);

      const practice = library.getById('custom_001');
      expect(practice).toBeDefined();
    });

    it('应该跳过已存在的ID', () => {
      const existingId = library.getAll()[0].id;
      const duplicatePractice = {
        id: existingId,
        category: 'CODE_STYLE',
        title: '重复ID',
        description: '不应导入',
        examples: [],
        tags: []
      };

      const imported = library.importFromJson(JSON.stringify([duplicatePractice]));
      expect(imported).toBe(0);
    });

    it('应该处理无效JSON', () => {
      const imported = library.importFromJson('invalid json');
      expect(imported).toBe(0);
    });

    it('应该支持批量导入', () => {
      const practices = Array.from({ length: 5 }, (_, i) => ({
        id: `batch_${i}`,
        category: 'CODE_STYLE',
        title: `实践${i}`,
        description: '描述',
        examples: [],
        tags: []
      }));

      const imported = library.importFromJson(JSON.stringify(practices));
      expect(imported).toBe(5);
    });
  });

  describe('内置实践内容验证', () => {
    it('应该包含代码风格实践', () => {
      const practices = library.getByCategory('CODE_STYLE');
      expect(practices.length).toBeGreaterThanOrEqual(3);
      
      const titles = practices.map((p: any) => p.title);
      expect(titles.some((t: string) => t.includes('const'))).toBe(true);
    });

    it('应该包含SQL优化实践', () => {
      const practices = library.getByCategory('SQL_OPTIMIZATION');
      expect(practices.length).toBeGreaterThanOrEqual(3);
      
      const titles = practices.map((p: any) => p.title);
      expect(titles.some((t: string) => t.includes('索引') || t.includes('SELECT'))).toBe(true);
    });

    it('应该包含安全实践', () => {
      const practices = library.getByCategory('SECURITY');
      expect(practices.length).toBeGreaterThanOrEqual(2);
    });

    it('应该包含性能优化实践', () => {
      const practices = library.getByCategory('PERFORMANCE');
      expect(practices.length).toBeGreaterThanOrEqual(2);
    });

    it('每条实践应有示例', () => {
      const all = library.getAll();
      all.forEach((practice: any) => {
        expect(practice.examples.length).toBeGreaterThan(0);
      });
    });

    it('每条实践应有标签', () => {
      const all = library.getAll();
      all.forEach((practice: any) => {
        expect(practice.tags.length).toBeGreaterThan(0);
      });
    });
  });
});
