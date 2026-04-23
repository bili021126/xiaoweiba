import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { injectable, inject } from 'tsyringe';
import { ConfigManager } from './ConfigManager';
import { ErrorCode, createError } from '../utils/ErrorCodes';

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastError: string | null;
  tableCount: number;
  memoryCount: number;
}

@injectable()
export class DatabaseManager {
  private dbPath: string;
  private backupDir: string;
  private db: Database | null = null;
  private SqlJs: SqlJsStatic | null = null;
  private extensionContext: vscode.ExtensionContext | null = null;

  constructor(
    @inject(ConfigManager) private configManager: ConfigManager,
    @inject('extensionContext') context?: vscode.ExtensionContext
  ) {
    this.extensionContext = context || null;
    
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, '.xiaoweiba', 'data');
    this.dbPath = path.join(dataDir, 'memory.db');
    this.backupDir = path.join(homeDir, '.xiaoweiba', 'backups');

    // 确保目录存在
    if (!fs.existsSync(path.dirname(this.dbPath))) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    try {
      // 加载 sql.js
      let wasmPath: string;
      
      if (this.extensionContext) {
        // VS Code 扩展环境：使用 require.resolve 定位 WASM 文件
        try {
          wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
          console.log('[DatabaseManager] Resolved WASM path:', wasmPath);
        } catch (resolveError) {
          // 降级方案：手动构建路径
          const projectRoot = path.join(__dirname, '..', '..');
          const wasmFile = path.join(projectRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
          
          if (fs.existsSync(wasmFile)) {
            wasmPath = wasmFile;
          } else {
            throw new Error(`Cannot locate sql-wasm.wasm. Tried: ${wasmFile}`);
          }
        }
      } else {
        // 测试环境：使用 require.resolve
        wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      }
      
      console.log('[DatabaseManager] Loading WASM from:', wasmPath);
      
      this.SqlJs = await initSqlJs({
        locateFile: (file) => {
          if (file === 'sql-wasm.wasm') {
            return wasmPath;
          }
          return require.resolve(`sql.js/dist/${file}`);
        }
      });

      // 打开或创建数据库
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SqlJs.Database(fileBuffer);
        console.log('[DatabaseManager] Existing database loaded');
      } else {
        this.db = new this.SqlJs.Database();
        console.log('[DatabaseManager] New database created');
      }

      // 创建表结构
      this.createTables();

      // 执行迁移（添加memory_tier列）
      try {
        this.migrateAddMemoryTier();
      } catch (migrationError) {
        console.warn('[DatabaseManager] Migration skipped:', 
          migrationError instanceof Error ? migrationError.message : String(migrationError));
      }

      // 创建索引
      this.createIndexes();

      // ✅ 保存数据库（失败时不阻断初始化，稍后重试）
      try {
        this.saveDatabase();
      } catch (saveError) {
        console.warn('[DatabaseManager] Initial save failed, will retry on next write:', 
          saveError instanceof Error ? saveError.message : String(saveError));
        // 不抛出异常，允许插件继续激活
      }

      console.log('[DatabaseManager] Database initialized successfully at:', this.dbPath);
    } catch (error) {
      const homeDir = os.homedir();
      const detailedError = error instanceof Error ? error.message : String(error);
      console.error('[DatabaseManager] Initialization failed:', detailedError);
      console.error('[DatabaseManager] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      
      throw createError(
        ErrorCode.DB_CONNECTION_FAILED,
        `Failed to initialize database: ${detailedError}`,
        `数据库初始化失败，请检查 ${path.join(homeDir, '.xiaoweiba', 'data')} 目录权限`,
        { dbPath: this.dbPath, error: detailedError }
      );
    }
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): Database {
    if (!this.db) {
      throw createError(
        ErrorCode.DB_CONNECTION_FAILED,
        'Database not initialized',
        '数据库未初始化，请先调用 initialize()'
      );
    }
    return this.db;
  }

  /**
   * ✅ 保存数据库到磁盘（带降级策略）
   * - 优先使用原子重命名（安全）
   * - 失败后降级为直接覆盖写入（兼容性更好）
   */
  private async saveDatabase(): Promise<void> {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = Buffer.from(data);
    const tempPath = this.dbPath + '.tmp';

    // 1. 写入临时文件
    try {
      fs.writeFileSync(tempPath, buffer);
    } catch (error) {
      console.error('[DatabaseManager] Failed to write temp file:', error);
      throw error;
    }

    // 2. 尝试原子重命名（最多重试3次）
    const maxRetries = 3;
    let renameSuccess = false;
    for (let i = 0; i < maxRetries; i++) {
      try {
        fs.renameSync(tempPath, this.dbPath);
        renameSuccess = true;
        break;
      } catch (error) {
        console.warn(`[DatabaseManager] Rename attempt ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
        if (i < maxRetries - 1) {
          // ✅ 修复 #2：使用异步延迟替代忙等待
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    // 3. 降级策略：如果重命名失败，直接覆盖写入
    if (!renameSuccess) {
      console.warn('[DatabaseManager] Atomic rename failed, falling back to direct write');
      try {
        // 直接写入目标文件（非原子操作，但兼容性更好）
        fs.writeFileSync(this.dbPath, buffer);
        
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        
        console.log('[DatabaseManager] Database saved successfully (direct write)');
      } catch (error) {
        console.error('[DatabaseManager] Direct write also failed:', error);
        throw error;
      }
    } else {
      console.log('[DatabaseManager] Database saved successfully (atomic rename)');
    }
  }

  /**
   * 公开保存方法（供外部调用）
   */
  public save(): void {
    this.saveDatabase();
  }

  /**
   * 智能执行SQL写操作（自动持久化）
   * @param sql SQL语句
   * @param params 参数数组
   */
  public run(sql: string, params?: any[]): void {
    const db = this.getDatabase();
    
    // 执行SQL
    if (params && params.length > 0) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      db.run(sql);
    }
    
    // ✅ 自动判断是否为写操作，若是则立即持久化
    // 使用正则表达式匹配，支持注释、空格、REPLACE、TRUNCATE等
    const writeOpRegex = /^\s*(\/\/.*|\/\*[\s\S]*?\*\/)*\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|TRUNCATE)\s/i;
    const isWriteOperation = writeOpRegex.test(sql);
      
    if (isWriteOperation) {
      console.log(`[DatabaseManager] Write operation detected, saving to disk...`);
      this.saveDatabase();  // 立即落盘
      console.log(`[DatabaseManager] Database saved successfully`);
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      this.db = null;
      console.log('[DatabaseManager] Database closed');
    }
  }

  /**
   * 创建表结构
   */
  private createTables(): void {
    const db = this.getDatabase();

    // 情景记忆表
    db.run(`
      CREATE TABLE IF NOT EXISTS episodic_memory (
        id TEXT PRIMARY KEY,
        project_fingerprint TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        task_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        entities TEXT,
        decision TEXT,
        outcome TEXT NOT NULL,
        final_weight REAL NOT NULL,
        model_id TEXT NOT NULL,
        latency_ms INTEGER,
        vector BLOB,
        memory_tier TEXT DEFAULT 'LONG_TERM',
        last_accessed_at INTEGER,  -- 深化点4: 最后访问时间
        metadata TEXT  -- 新增：元数据（JSON格式）
      )
    `);

    // 偏好记忆表
    db.run(`
      CREATE TABLE IF NOT EXISTS preference_memory (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        pattern TEXT NOT NULL,
        confidence REAL NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 1,
        last_updated INTEGER NOT NULL,
        model_id TEXT,
        project_fingerprint TEXT,
        pattern_hash TEXT NOT NULL
      )
    `);

    // 程序性记忆表
    db.run(`
      CREATE TABLE IF NOT EXISTS procedural_memory (
        id TEXT PRIMARY KEY,
        skill_name TEXT NOT NULL,
        description TEXT,
        steps TEXT NOT NULL,
        dependencies TEXT,
        version TEXT NOT NULL,
        author TEXT,
        project_fingerprint TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        pattern_hash TEXT NOT NULL
      )
    `);

    // 任务状态表
    db.run(`
      CREATE TABLE IF NOT EXISTS task_state (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        project_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL,
        context TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // ✅ 会话表（P1-02: SessionManagementAgent持久化）
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        metadata TEXT  -- JSON格式：{title, tags, etc.}
      )
    `);

    // ✅ 会话消息表
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,  -- 'user' or 'assistant'
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
      )
    `);

    // ✅ P1-03: 反馈记录表（用于优化记忆检索权重）
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback_records (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        clicked_memory_id TEXT NOT NULL,
        dwell_time_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        project_fingerprint TEXT
      )
    `);
  }

  /**
   * 创建索引
   */
  private createIndexes(): void {
    const db = this.getDatabase();

    db.run(`CREATE INDEX IF NOT EXISTS idx_episodic_project ON episodic_memory(project_fingerprint)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_episodic_timestamp ON episodic_memory(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_episodic_task_type ON episodic_memory(task_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_episodic_outcome ON episodic_memory(outcome)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_episodic_memory_tier ON episodic_memory(memory_tier)`); // 新增：记忆层级索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_preference_domain ON preference_memory(domain)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_preference_project ON preference_memory(project_fingerprint)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_preference_pattern_hash ON preference_memory(pattern_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_preference_model ON preference_memory(model_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_procedural_hash ON procedural_memory(pattern_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_procedural_project ON procedural_memory(project_fingerprint)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_status ON task_state(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_task_project ON task_state(project_fingerprint)`);
    
    // ✅ 会话表索引（P1-02）
    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON chat_sessions(last_active_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp)`);
    
    // ✅ P1-02: feedback_records表索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback_records(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback_records(project_fingerprint)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_clicked_memory ON feedback_records(clicked_memory_id)`);
    
    // ✅ 表结构和索引创建完成后立即持久化
    this.saveDatabase();
  }

  /**
   * 健康检查
   */
  checkHealth(): DatabaseHealth {
    try {
      const db = this.getDatabase();
      
      const tableResult = db.exec("SELECT count(*) as count FROM sqlite_master WHERE type='table'");
      const memoryResult = db.exec("SELECT count(*) as count FROM episodic_memory");

      const tableCount = tableResult.length > 0 && tableResult[0].values.length > 0
        ? (tableResult[0].values[0][0] as number)
        : 0;
      
      const memoryCount = memoryResult.length > 0 && memoryResult[0].values.length > 0
        ? (memoryResult[0].values[0][0] as number)
        : 0;

      return {
        status: 'healthy',
        lastError: null,
        tableCount,
        memoryCount
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastError: error instanceof Error ? error.message : String(error),
        tableCount: 0,
        memoryCount: 0
      };
    }
  }

  /**
   * 修复数据库
   */
  repair(): boolean {
    try {
      const db = this.getDatabase();
      const result = db.exec("PRAGMA integrity_check");
      
      if (result.length > 0 && result[0].values.length > 0) {
        const checkResult = result[0].values[0][0] as string;
        if (checkResult === 'ok') {
          console.log('[DatabaseManager] Database integrity check passed');
          return true;
        } else {
          console.warn('[DatabaseManager] Database integrity check failed:', checkResult);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('[DatabaseManager] Database repair failed:', error);
      return false;
    }
  }

  /**
   * 备份数据库
   */
  backup(): string {
    // 先保存当前状态
    this.saveDatabase();
    
    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `memory_${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      // 确保备份目录存在
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // 复制数据库文件
      fs.copyFileSync(this.dbPath, backupPath);
      
      console.log('[DatabaseManager] Database backed up to:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('[DatabaseManager] Backup failed:', error);
      throw error;
    }
  }

  /**
   * 清理旧备份
   */
  cleanupOldBackups(maxFiles: number = 10): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return;
      }

      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('memory_') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // 删除超出数量的旧备份
      if (files.length > maxFiles) {
        files.slice(maxFiles).forEach(file => {
          fs.unlinkSync(file.path);
          console.log('[DatabaseManager] Deleted old backup:', file.name);
        });
      }
    } catch (error) {
      console.warn('[DatabaseManager] Failed to cleanup old backups:', error);
    }
  }

  /**
   * 导出数据库为 JSON
   */
  exportToJson(): any {
    const db = this.getDatabase();
    
    const episodicResult = db.exec('SELECT * FROM episodic_memory');
    const preferenceResult = db.exec('SELECT * FROM preference_memory');
    const proceduralResult = db.exec('SELECT * FROM procedural_memory');

    const episodicMemories = episodicResult.length > 0 ? episodicResult[0].values.map((row: any[]) => ({
      id: row[0],
      project_fingerprint: row[1],
      timestamp: row[2],
      task_type: row[3],
      summary: row[4],
      entities: row[5],
      decision: row[6],
      outcome: row[7],
      final_weight: row[8],
      model_id: row[9],
      input_tokens: row[10],
      output_tokens: row[11],
      latency_ms: row[12],
      cost_usd: row[13]
    })) : [];

    const preferenceMemories = preferenceResult.length > 0 ? preferenceResult[0].values.map((row: any[]) => ({
      id: row[0],
      domain: row[1],
      pattern: row[2],
      preference_value: row[3],
      confidence: row[4],
      usage_count: row[5],
      project_fingerprint: row[6],
      created_at: row[7],
      updated_at: row[8],
      pattern_hash: row[9]
    })) : [];

    const proceduralMemories = proceduralResult.length > 0 ? proceduralResult[0].values.map((row: any[]) => ({
      id: row[0],
      skill_name: row[1],
      description: row[2],
      steps: row[3],
      dependencies: row[4],
      version: row[5],
      author: row[6],
      project_fingerprint: row[7],
      created_at: row[8],
      updated_at: row[9],
      pattern_hash: row[10]
    })) : [];

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        episodicMemories,
        preferenceMemories,
        proceduralMemories
      }
    };
  }

  /**
   * 从 JSON 导入数据
   */
  importFromJson(data: any): void {
    const db = this.getDatabase();
    
    // 导入情景记忆
    if (data.data?.episodicMemories) {
      for (const memory of data.data.episodicMemories) {
        db.run(`
          INSERT OR REPLACE INTO episodic_memory 
          (id, project_fingerprint, timestamp, task_type, summary, entities, decision, outcome, final_weight, model_id, input_tokens, output_tokens, latency_ms, cost_usd)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          memory.id,
          memory.project_fingerprint,
          memory.timestamp,
          memory.task_type,
          memory.summary,
          memory.entities,
          memory.decision,
          memory.outcome,
          memory.final_weight,
          memory.model_id,
          memory.input_tokens,
          memory.output_tokens,
          memory.latency_ms,
          memory.cost_usd
        ]);
      }
    }

    // 导入偏好记忆
    if (data.data?.preferenceMemories) {
      for (const memory of data.data.preferenceMemories) {
        db.run(`
          INSERT OR REPLACE INTO preference_memory 
          (id, domain, pattern, preference_value, confidence, usage_count, project_fingerprint, created_at, updated_at, pattern_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          memory.id,
          memory.domain,
          memory.pattern,
          memory.preference_value,
          memory.confidence,
          memory.usage_count,
          memory.project_fingerprint,
          memory.created_at,
          memory.updated_at,
          memory.pattern_hash
        ]);
      }
    }

    // 导入程序性记忆
    if (data.data?.proceduralMemories) {
      for (const memory of data.data.proceduralMemories) {
        db.run(`
          INSERT OR REPLACE INTO procedural_memory 
          (id, skill_name, description, steps, dependencies, version, author, project_fingerprint, created_at, updated_at, pattern_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          memory.id,
          memory.skill_name,
          memory.description,
          memory.steps,
          memory.dependencies,
          memory.version,
          memory.author,
          memory.project_fingerprint,
          memory.created_at,
          memory.updated_at,
          memory.pattern_hash
        ]);
      }
    }

    // 保存更改
    this.saveDatabase();
    console.log('[DatabaseManager] Data imported successfully');
  }

  /**
   * 执行查询（返回多行）- 兼容接口
   */
  runQuery(sql: string, params?: any[]): any[] {
    const db = this.getDatabase();
    
    // 如果有参数，使用参数化查询
    if (params && params.length > 0) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      
      const results: any[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      
      return results;
    } else {
      // 无参数时使用exec
      const result = db.exec(sql);
      
      if (result.length === 0 || result[0].values.length === 0) {
        return [];
      }

      // 将sql.js的结果格式化为数组对象
      const columns = result[0].columns;
      return result[0].values.map((row: any[]) => {
        const obj: any = {};
        columns.forEach((col: string, idx: number) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
  }

  /**
   * 执行查询（返回单行）- 兼容接口
   */
  runQueryOne(sql: string, params?: any[]): any {
    const results = this.runQuery(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 执行修改操作（INSERT/UPDATE/DELETE）- 兼容接口
   */
  runMutation(sql: string, params?: any[]): any {
    const db = this.getDatabase();
    db.run(sql, params || []);
    
    // ✅ 自动持久化（与run方法保持一致）
    const writeOpRegex = /^\s*(\/\/.*|\/\*[\s\S]*?\*\/)*\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|TRUNCATE)\s/i;
    const isWriteOperation = writeOpRegex.test(sql);
      
    if (isWriteOperation) {
      console.log(`[DatabaseManager] Write operation detected in runMutation, saving to disk...`);
      this.saveDatabase();
      console.log(`[DatabaseManager] Database saved successfully`);
    }
    
    return { changes: db.getRowsModified() };
  }

  /**
   * 迁移：为现有数据添加memory_tier字段
   */
  migrateAddMemoryTier(): void {
    try {
      const db = this.getDatabase();
      
      // 检查是否已存在memory_tier列
      const columnsResult = db.exec("PRAGMA table_info(episodic_memory)");
      if (columnsResult.length === 0) return;
      
      const hasMemoryTier = columnsResult[0].values.some((row: any[]) => row[1] === 'memory_tier');
      if (hasMemoryTier) {
        console.log('[DatabaseManager] memory_tier column already exists, skip migration');
        return;
      }
      
      console.log('[DatabaseManager] Adding memory_tier column...');
      
      // SQLite不支持直接添加带默认值的列到已有数据的表，需要重建表
      db.run(`ALTER TABLE episodic_memory ADD COLUMN memory_tier TEXT DEFAULT 'LONG_TERM'`);
      
      // 根据时间自动分类：7天内的为SHORT_TERM，其他为LONG_TERM
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      db.run(`UPDATE episodic_memory SET memory_tier = 'SHORT_TERM' WHERE timestamp >= ?`, [sevenDaysAgo]);
      
      const updatedCount = db.getRowsModified();
      console.log(`[DatabaseManager] Migrated ${updatedCount} memories to SHORT_TERM tier`);
      
      this.saveDatabase();
    } catch (error) {
      console.error('[DatabaseManager] Migration failed:', error);
      throw error;
    }
  }
}
