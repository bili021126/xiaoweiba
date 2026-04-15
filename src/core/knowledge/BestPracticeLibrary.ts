/**
 * 最佳实践记录
 */
export interface BestPractice {
  id: string;
  category: 'CODE_STYLE' | 'SQL_OPTIMIZATION' | 'SECURITY' | 'PERFORMANCE' | 'DESIGN_PATTERN';
  title: string;
  description: string;
  examples: string[];
  tags: string[];
}

/**
 * 内置最佳实践库
 * 
 * 提供冷启动兜底的编码规范、SQL优化原则等
 */
export class BestPracticeLibrary {
  private practices: Map<string, BestPractice> = new Map();

  constructor() {
    this.loadBuiltInPractices();
  }

  /**
   * 加载内置最佳实践
   */
  private loadBuiltInPractices(): void {
    const builtInPractices: BestPractice[] = [
      // 代码风格 (3条)
      {
        id: 'cs_001',
        category: 'CODE_STYLE',
        title: '使用const/let代替var',
        description: '优先使用const声明不变变量，let声明可变变量，避免使用var',
        examples: ['const MAX_RETRY = 3;', 'let count = 0;'],
        tags: ['typescript', 'javascript', 'variable']
      },
      {
        id: 'cs_002',
        category: 'CODE_STYLE',
        title: '函数命名使用动词+名词',
        description: '函数名应清晰表达意图，使用getUserData而非getData',
        examples: ['function getUserById(id: number)', 'function calculateTotalPrice()'],
        tags: ['naming', 'function']
      },
      {
        id: 'cs_003',
        category: 'CODE_STYLE',
        title: '避免嵌套过深',
        description: '嵌套层级不超过3层，使用早期返回简化逻辑',
        examples: ['if (!valid) return;', 'guard clauses'],
        tags: ['readability', 'complexity']
      },

      // SQL优化 (3条)
      {
        id: 'sql_001',
        category: 'SQL_OPTIMIZATION',
        title: '使用索引加速查询',
        description: '为WHERE、JOIN、ORDER BY字段添加索引',
        examples: ['CREATE INDEX idx_user_email ON users(email);', 'EXPLAIN SELECT ...'],
        tags: ['index', 'performance']
      },
      {
        id: 'sql_002',
        category: 'SQL_OPTIMIZATION',
        title: '避免SELECT *',
        description: '只查询需要的字段，减少网络传输和内存占用',
        examples: ['SELECT id, name FROM users;', '避免 SELECT * FROM users;'],
        tags: ['select', 'optimization']
      },
      {
        id: 'sql_003',
        category: 'SQL_OPTIMIZATION',
        title: '使用参数化查询防止SQL注入',
        description: '永远不要拼接用户输入到SQL语句中',
        examples: ['db.prepare("SELECT * FROM users WHERE id = ?").bind([userId])'],
        tags: ['security', 'injection']
      },

      // 安全 (2条)
      {
        id: 'sec_001',
        category: 'SECURITY',
        title: '验证用户输入',
        description: '所有外部输入都需要验证类型、长度、格式',
        examples: ['if (typeof input !== "string") throw new Error();', 'zod schema validation'],
        tags: ['validation', 'input']
      },
      {
        id: 'sec_002',
        category: 'SECURITY',
        title: '敏感信息不硬编码',
        description: 'API密钥、密码等使用环境变量或密钥管理服务',
        examples: ['process.env.API_KEY', 'vscode secrets API'],
        tags: ['secrets', 'environment']
      },

      // 性能 (2条)
      {
        id: 'perf_001',
        category: 'PERFORMANCE',
        title: '使用缓存减少重复计算',
        description: '对耗时操作结果进行缓存，设置合理的TTL',
        examples: ['LRU cache', 'Map with TTL'],
        tags: ['cache', 'optimization']
      },
      {
        id: 'perf_002',
        category: 'PERFORMANCE',
        title: '异步操作避免阻塞主线程',
        description: '文件IO、网络请求使用async/await',
        examples: ['await fs.readFile()', 'Promise.all()并行执行'],
        tags: ['async', 'non-blocking']
      }
    ];

    for (const practice of builtInPractices) {
      this.practices.set(practice.id, practice);
    }
  }

  /**
   * 根据分类获取最佳实践
   */
  getByCategory(category: BestPractice['category']): BestPractice[] {
    return Array.from(this.practices.values()).filter(p => p.category === category);
  }

  /**
   * 根据标签搜索最佳实践
   */
  searchByTags(tags: string[]): BestPractice[] {
    return Array.from(this.practices.values()).filter(p =>
      tags.some(tag => p.tags.includes(tag))
    );
  }

  /**
   * 获取所有最佳实践
   */
  getAll(): BestPractice[] {
    return Array.from(this.practices.values());
  }

  /**
   * 根据ID获取单条最佳实践
   */
  getById(id: string): BestPractice | undefined {
    return this.practices.get(id);
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; byCategory: Record<BestPractice['category'], number> } {
    const byCategory: Record<BestPractice['category'], number> = {
      CODE_STYLE: 0,
      SQL_OPTIMIZATION: 0,
      SECURITY: 0,
      PERFORMANCE: 0,
      DESIGN_PATTERN: 0
    };
    
    for (const practice of this.practices.values()) {
      byCategory[practice.category] = (byCategory[practice.category] || 0) + 1;
    }

    return {
      total: this.practices.size,
      byCategory
    };
  }

  /**
   * 导出为JSON
   */
  exportToJson(): string {
    return JSON.stringify(Array.from(this.practices.values()), null, 2);
  }

  /**
   * 从JSON导入（追加模式）
   */
  importFromJson(json: string): number {
    try {
      const practices = JSON.parse(json) as BestPractice[];
      let imported = 0;

      for (const practice of practices) {
        if (!this.practices.has(practice.id)) {
          this.practices.set(practice.id, practice);
          imported++;
        }
      }

      return imported;
    } catch (error) {
      console.error('[BestPracticeLibrary] 导入失败:', error);
      return 0;
    }
  }
}
