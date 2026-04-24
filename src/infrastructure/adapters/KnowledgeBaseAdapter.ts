/**
 * 知识库适配器 - 实现 IKnowledgeBase 端口
 * 
 * 职责：
 * - 将知识库操作映射到 SQLite 数据库
 * - 提供向量相似度搜索（P0阶段使用余弦相似度）
 * - 符合端口-适配器架构规范
 */

import { injectable, inject } from 'tsyringe';
import { IKnowledgeBase, OrchestrationTemplate, TaskReflection, KnowledgeFragment, VirtualAgent } from '../../core/ports/IKnowledgeBase';
import { DatabaseManager } from '../../storage/DatabaseManager';

@injectable()
export class KnowledgeBaseAdapter implements IKnowledgeBase {
  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager
  ) {}

  // ========== 编排模板管理 ==========

  async storeTemplate(template: OrchestrationTemplate): Promise<void> {
    const db = this.dbManager.getDatabase();
    db.run(
      `INSERT OR REPLACE INTO orchestration_templates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        template.id,
        template.intentName,
        JSON.stringify(template.intentVector),
        JSON.stringify(template.toolSequence),
        JSON.stringify(template.parameters),
        template.successRate,
        template.usageCount,
        template.lastUsed,
        template.createdAt,
        template.compiledVirtualAgent || null
      ]
    );
    console.log(`[KnowledgeBaseAdapter] Template stored: ${template.id}`);
  }

  async searchTemplates(
    intentVector: number[],
    options?: { similarityThreshold?: number; limit?: number }
  ): Promise<OrchestrationTemplate[]> {
    const threshold = options?.similarityThreshold ?? 0.8;
    const limit = options?.limit ?? 5;

    const db = this.dbManager.getDatabase();
    const results = db.exec('SELECT * FROM orchestration_templates');
    
    if (!results || results.length === 0) {
      return [];
    }

    const rows = results[0].values;

    const templates: OrchestrationTemplate[] = Array.from(rows).map((row: any[]) => ({
      id: row[0],
      intentName: row[1],
      intentVector: JSON.parse(row[2]),
      toolSequence: JSON.parse(row[3]),
      parameters: JSON.parse(row[4] || '{}'),
      successRate: row[5],
      usageCount: row[6],
      lastUsed: row[7],
      createdAt: row[8],
      compiledVirtualAgent: row[9] || undefined
    }));

    // P0 阶段：简单的余弦相似度计算
    return templates
      .map(t => ({
        ...t,
        similarity: this.cosineSimilarity(intentVector, t.intentVector)
      }))
      .filter(t => t.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async updateTemplateStats(id: string, success: boolean): Promise<void> {
    const db = this.dbManager.getDatabase();
    const now = Date.now();
    
    // 获取当前统计
    const rows = db.exec(`SELECT success_rate, usage_count FROM orchestration_templates WHERE id = '${id}'`);
    if (!rows || !rows.values || rows.values.length === 0) {
      return;
    }

    const [currentRate, currentCount] = rows.values[0];
    const newCount = currentCount + 1;
    const newRate = (currentRate * currentCount + (success ? 1 : 0)) / newCount;

    db.run(
      `UPDATE orchestration_templates SET success_rate = ?, usage_count = ?, last_used = ? WHERE id = ?`,
      [newRate, newCount, now, id]
    );
  }

  async listTemplates(): Promise<OrchestrationTemplate[]> {
    const db = this.dbManager.getDatabase();
    const rows = db.exec('SELECT * FROM orchestration_templates')[0];
    
    if (!rows || !rows.values) {
      return [];
    }

    return rows.values.map((row: any[]) => ({
      id: row[0],
      intentName: row[1],
      intentVector: JSON.parse(row[2]),
      toolSequence: JSON.parse(row[3]),
      parameters: JSON.parse(row[4] || '{}'),
      successRate: row[5],
      usageCount: row[6],
      lastUsed: row[7],
      createdAt: row[8],
      compiledVirtualAgent: row[9] || undefined
    }));
  }

  // ========== 反思报告管理 ==========

  async storeReflection(reflection: TaskReflection): Promise<void> {
    const db = this.dbManager.getDatabase();
    db.run(
      `INSERT INTO task_reflections VALUES (?, ?, ?, ?, ?, ?)`,
      [
        reflection.id,
        reflection.taskId,
        reflection.reflection,
        JSON.stringify(reflection.suggestions),
        JSON.stringify(reflection.knowledgeFragments),
        reflection.createdAt
      ]
    );
    console.log(`[KnowledgeBaseAdapter] Reflection stored for task: ${reflection.taskId}`);
  }

  async getReflections(taskId: string): Promise<TaskReflection[]> {
    const db = this.dbManager.getDatabase();
    const rows = db.exec(`SELECT * FROM task_reflections WHERE task_id = '${taskId}'`);
    
    if (!rows || !rows.values) {
      return [];
    }

    return rows.values.map((row: any[]) => ({
      id: row[0],
      taskId: row[1],
      reflection: row[2],
      suggestions: JSON.parse(row[3] || '[]'),
      knowledgeFragments: JSON.parse(row[4] || '[]'),
      createdAt: row[5]
    }));
  }

  // ========== 知识碎片管理 ==========

  async storeFragment(fragment: KnowledgeFragment): Promise<void> {
    const db = this.dbManager.getDatabase();
    db.run(
      `INSERT OR REPLACE INTO knowledge_fragments VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fragment.id,
        fragment.content,
        JSON.stringify(fragment.vector),
        fragment.sourceTaskId,
        JSON.stringify(fragment.tags),
        fragment.createdAt,
        fragment.lastUsed || null,
        fragment.score
      ]
    );
  }

  async searchFragments(
    queryVector: number[],
    options?: { limit?: number; tags?: string[] }
  ): Promise<KnowledgeFragment[]> {
    const limit = options?.limit ?? 10;
    const tags = options?.tags;

    const db = this.dbManager.getDatabase();
    let sql = 'SELECT * FROM knowledge_fragments';
    const params: any[] = [];

    if (tags && tags.length > 0) {
      sql += ' WHERE tags LIKE ?';
      params.push(`%${tags[0]}%`);
    }

    sql += ' ORDER BY score DESC LIMIT ?';
    params.push(limit);

    const rows = db.exec(sql.replace('?', `'${params[0]}'`).replace('?', `${params[1]}`));
    
    if (!rows || !rows.values) {
      return [];
    }

    return rows.values.map((row: any[]) => ({
      id: row[0],
      content: row[1],
      vector: JSON.parse(row[2]),
      sourceTaskId: row[3],
      tags: JSON.parse(row[4] || '[]'),
      createdAt: row[5],
      lastUsed: row[6],
      score: row[7]
    }));
  }

  // ========== 虚拟Agent管理 ==========

  async registerVirtualAgent(agent: VirtualAgent): Promise<void> {
    const db = this.dbManager.getDatabase();
    db.run(
      `INSERT OR REPLACE INTO virtual_agents VALUES (?, ?, ?, ?, ?, ?)`,
      [
        agent.name,
        agent.description,
        agent.templateId,
        agent.agentCode,
        agent.status,
        agent.createdAt
      ]
    );
    console.log(`[KnowledgeBaseAdapter] Virtual agent registered: ${agent.name}`);
  }

  async getVirtualAgent(name: string): Promise<VirtualAgent | null> {
    const db = this.dbManager.getDatabase();
    const rows = db.exec(`SELECT * FROM virtual_agents WHERE name = '${name}'`);
    
    if (!rows || !rows.values || rows.values.length === 0) {
      return null;
    }

    const row = rows.values[0];
    return {
      name: row[0],
      description: row[1],
      templateId: row[2],
      agentCode: row[3],
      status: row[4],
      createdAt: row[5]
    };
  }

  async listVirtualAgents(): Promise<VirtualAgent[]> {
    const db = this.dbManager.getDatabase();
    const rows = db.exec('SELECT * FROM virtual_agents');
    
    if (!rows || !rows.values) {
      return [];
    }

    return rows.values.map((row: any[]) => ({
      name: row[0],
      description: row[1],
      templateId: row[2],
      agentCode: row[3],
      status: row[4],
      createdAt: row[5]
    }));
  }

  // ========== 私有方法 ==========

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
