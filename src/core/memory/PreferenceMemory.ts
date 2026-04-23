import { injectable, inject } from 'tsyringe';
import { DatabaseManager } from '../../storage/DatabaseManager';
import { AuditLogger } from '../security/AuditLogger';
import { ProjectFingerprint } from '../../utils/ProjectFingerprint';
import { ConfigManager } from '../../storage/ConfigManager';
import { createError } from '../../utils/ErrorCodes';
import * as crypto from 'crypto';
import { CONFIDENCE_THRESHOLDS } from '../../constants';

/**
 * 偏好领域类型
 */
export type PreferenceDomain = 
  | 'NAMING' 
  | 'SQL_STRATEGY' 
  | 'TEST_STYLE' 
  | 'COMMIT_STYLE' 
  | 'CODE_PATTERN';

/**
 * 偏好记忆记录接口
 */
export interface PreferenceMemoryRecord {
  /** 唯一标识 */
  id: string;
  /** 偏好领域 */
  domain: PreferenceDomain;
  /** 模式数据（JSON序列化存储） */
  pattern: Record<string, any>;
  /** 置信度（0-1） */
  confidence: number;
  /** 样本数量 */
  sampleCount: number;
  /** 最后更新时间戳 */
  lastUpdated: number;
  /** 模型ID（空表示通用） */
  modelId?: string;
  /** 项目指纹（空表示全局） */
  projectFingerprint?: string;
}

/**
 * 偏好查询选项
 */
export interface PreferenceQueryOptions {
  domain?: PreferenceDomain;
  projectFingerprint?: string;
  modelId?: string;
  minConfidence?: number;
  limit?: number;
}

/**
 * 偏好推荐结果
 */
export interface PreferenceRecommendation {
  record: PreferenceMemoryRecord;
  matchScore: number; // 匹配分数 0-1
}

/**
 * 偏好记忆管理器
 * 
 * 负责记录和检索用户偏好，支持基于相似度的智能推荐
 */
@injectable()
export class PreferenceMemory {
  private readonly coldStartThreshold: number; // 冷启动最小样本数

  constructor(
    @inject(DatabaseManager) private dbManager: DatabaseManager,
    @inject(AuditLogger) private auditLogger: AuditLogger,
    @inject(ProjectFingerprint) private projectFingerprint: ProjectFingerprint,
    @inject(ConfigManager) private configManager: ConfigManager
  ) {
    // 从配置获取冷启动阈值，默认3个样本
    const config = this.configManager.getConfig();
    this.coldStartThreshold = config.memory?.coldStartTrust || 3;
  }

  /**
   * 记录或更新偏好
   * @param domain 偏好领域
   * @param pattern 模式数据
   * @param isPositive 是否为正向反馈（true=采纳，false=拒绝）
   * @param modelId 可选的模型ID
   * @returns 偏好记录ID
   */
  async recordPreference(
    domain: PreferenceDomain,
    pattern: Record<string, any>,
    isPositive: boolean = true,
    modelId?: string
  ): Promise<string> {
    try {
      const now = Date.now();
      const projectFp = await this.projectFingerprint.getCurrentProjectFingerprint() || undefined;
      const patternHash = this.hashPattern(pattern);

      // 查找是否已存在相同模式的偏好
      const existing = await this.findExistingPreference(domain, patternHash, projectFp, modelId);

      if (existing) {
        // 更新现有偏好
        return this.updateExistingPreference(existing.id, isPositive, now);
      } else {
        // 创建新偏好
        return this.createNewPreference(domain, pattern, projectFp, modelId, now, isPositive);
      }
    } catch (error) {
      await this.auditLogger.logError('preference_record', error as Error, 0);
      throw error;
    }
  }

  /**
   * 查询相关偏好
   * @param options 查询选项
   * @returns 偏好记录列表（按置信度降序）
   */
  async queryPreferences(options: PreferenceQueryOptions = {}): Promise<PreferenceMemoryRecord[]> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (options.domain) {
        conditions.push('domain = ?');
        params.push(options.domain);
      }

      if (options.projectFingerprint) {
        conditions.push('(project_fingerprint = ? OR project_fingerprint IS NULL)');
        params.push(options.projectFingerprint);
      }

      if (options.modelId) {
        conditions.push('(model_id = ? OR model_id IS NULL)');
        params.push(options.modelId);
      }

      if (options.minConfidence !== undefined) {
        conditions.push('confidence >= ?');
        params.push(options.minConfidence);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // ✅ 验证并限制LIMIT值，防止注入
      const limit = options.limit ? Math.min(Math.max(options.limit, 1), 100) : undefined;
      const limitClause = limit ? 'LIMIT ?' : '';
      
      if (limit) {
        params.push(limit);
      }

      const sql = `
        SELECT id, domain, pattern, confidence, sample_count, 
               last_updated, model_id, project_fingerprint
        FROM preference_memory
        ${whereClause}
        ORDER BY confidence DESC, sample_count DESC
        ${limitClause}
      `;

      const result = this.dbManager.runQuery(sql, params);
      
      return result.map((row: any) => ({
        id: row.id,
        domain: row.domain as PreferenceDomain,
        pattern: JSON.parse(row.pattern),
        confidence: row.confidence,
        sampleCount: row.sample_count,
        lastUpdated: row.last_updated,
        modelId: row.model_id || undefined,
        projectFingerprint: row.project_fingerprint || undefined
      }));
    } catch (error) {
      await this.auditLogger.logError('preference_query', error as Error, 0);
      throw error;
    }
  }

  /**
   * 获取推荐偏好
   * @param domain 偏好领域
   * @param contextPattern 当前上下文模式（用于相似度匹配）
   * @param modelId 可选的模型ID
   * @returns 推荐列表（按匹配分数降序）
   */
  async getRecommendations(
    domain: PreferenceDomain,
    contextPattern: Record<string, any> = {},
    modelId?: string
  ): Promise<PreferenceRecommendation[]> {
    try {
      // 查询相关偏好
      const preferences = await this.queryPreferences({
        domain,
        modelId,
        minConfidence: 0.5 // 只推荐置信度>=50%的偏好
      });

      // 计算每个偏好的匹配分数
      const recommendations: PreferenceRecommendation[] = preferences.map(pref => {
        const matchScore = this.calculateMatchScore(pref.pattern, contextPattern);
        return {
          record: pref,
          matchScore
        };
      });

      // 过滤掉冷启动阶段的低置信度偏好
      const filtered = recommendations.filter(rec => {
        if (rec.record.sampleCount < this.coldStartThreshold) {
          // 冷启动阶段要求更高置信度
          return rec.record.confidence >= CONFIDENCE_THRESHOLDS.COLD_START_HIGH_CONFIDENCE;
        }
        return true;
      });

      // 按匹配分数降序排序
      return filtered.sort((a, b) => b.matchScore - a.matchScore);
    } catch (error) {
      await this.auditLogger.logError('preference_recommend', error as Error, 0);
      throw error;
    }
  }

  /**
   * 删除偏好记录
   * @param id 偏好ID
   */
  async deletePreference(id: string): Promise<void> {
    try {
      const sql = 'DELETE FROM preference_memory WHERE id = ?';
      this.dbManager.runMutation(sql, [id]);

      await this.auditLogger.log('preference_delete', 'success', 0);
    } catch (error) {
      await this.auditLogger.logError('preference_delete', error as Error, 0);
      throw error;
    }
  }

  /**
   * 获取偏好统计信息
   * @returns 统计数据
   */
  async getStats(): Promise<{
    totalCount: number;
    byDomain: Record<PreferenceDomain, number>;
    averageConfidence: number;
    coldStartCount: number;
  }> {
    try {
      // 总数
      const totalResult = this.dbManager.runQuery('SELECT COUNT(*) as count FROM preference_memory');
      const totalCount = totalResult[0]?.count || 0;

      // 按领域统计
      const domainResult = this.dbManager.runQuery(
        'SELECT domain, COUNT(*) as count FROM preference_memory GROUP BY domain'
      );
      const byDomain: Record<PreferenceDomain, number> = {
        NAMING: 0,
        SQL_STRATEGY: 0,
        TEST_STYLE: 0,
        COMMIT_STYLE: 0,
        CODE_PATTERN: 0
      };
      domainResult.forEach((row: any) => {
        const domain = row.domain as PreferenceDomain;
        if (domain in byDomain) {
          byDomain[domain] = row.count;
        }
      });

      // 平均置信度
      const avgResult = this.dbManager.runQuery(
        'SELECT AVG(confidence) as avg_conf FROM preference_memory'
      );
      const averageConfidence = avgResult[0]?.avg_conf || 0;

      // 冷启动数量（样本数 < 阈值）
      const coldResult = this.dbManager.runQuery(
        'SELECT COUNT(*) as count FROM preference_memory WHERE sample_count < ?',
        [this.coldStartThreshold]
      );
      const coldStartCount = coldResult[0]?.count || 0;

      return {
        totalCount,
        byDomain,
        averageConfidence,
        coldStartCount
      };
    } catch (error) {
      await this.auditLogger.logError('preference_stats', error as Error, 0);
      throw error;
    }
  }

  /**
   * 查找已存在的偏好（基于模式哈希）
   */
  private async findExistingPreference(
    domain: PreferenceDomain,
    patternHash: string,
    projectFingerprint?: string,
    modelId?: string
  ): Promise<PreferenceMemoryRecord | null> {
    const sql = `
      SELECT id, domain, pattern, confidence, sample_count, 
             last_updated, model_id, project_fingerprint
      FROM preference_memory
      WHERE domain = ? 
        AND substr(pattern, 1, 64) = ?
        AND (project_fingerprint = ? OR project_fingerprint IS NULL)
        AND (model_id = ? OR model_id IS NULL)
      LIMIT 1
    `;

    const result = this.dbManager.runQuery(sql, [
      domain,
      patternHash,
      projectFingerprint || '',
      modelId || ''
    ]);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      domain: row.domain as PreferenceDomain,
      pattern: JSON.parse(row.pattern),
      confidence: row.confidence,
      sampleCount: row.sample_count,
      lastUpdated: row.last_updated,
      modelId: row.model_id || undefined,
      projectFingerprint: row.project_fingerprint || undefined
    };
  }

  /**
   * 创建新偏好记录
   */
  private async createNewPreference(
    domain: PreferenceDomain,
    pattern: Record<string, any>,
    projectFingerprint: string | undefined,
    modelId: string | undefined,
    timestamp: number,
    isPositive: boolean
  ): Promise<string> {
    const id = `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const patternJson = JSON.stringify(pattern);
    const initialConfidence = isPositive ? 0.8 : 0.3;
    const initialSampleCount = isPositive ? 1 : 0;

    // ✅ 修复：计算 pattern_hash
    const patternHash = this.hashPattern(pattern);

    const sql = `
      INSERT INTO preference_memory 
      (id, domain, pattern, confidence, sample_count, last_updated, model_id, project_fingerprint, pattern_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.dbManager.runMutation(sql, [
      id,
      domain,
      patternJson,
      initialConfidence,
      initialSampleCount,
      timestamp,
      modelId || null,
      projectFingerprint || null,
      patternHash // ✅ 添加 pattern_hash
    ]);

    await this.auditLogger.log('preference_create', 'success', 0);

    return id;
  }

  /**
   * 更新现有偏好记录
   */
  private async updateExistingPreference(
    id: string,
    isPositive: boolean,
    timestamp: number
  ): Promise<string> {
    // 获取当前值
    const currentResult = this.dbManager.runQuery(
      'SELECT confidence, sample_count FROM preference_memory WHERE id = ?',
      [id]
    );

    if (currentResult.length === 0) {
      throw createError('XWB-DB-002' as any, '偏好记录不存在', '无法找到指定的偏好记录');
    }

    const current = currentResult[0];
    
    // 更新置信度和样本数
    const newSampleCount = current.sample_count + 1;
    // 使用移动平均更新置信度（增加最小置信度保护，避免永久失效）
    const MIN_CONFIDENCE = 0.1; // 最小置信度阈值
    const newConfidence = isPositive
      ? Math.min(1.0, current.confidence + (1 - current.confidence) / newSampleCount)
      : Math.max(MIN_CONFIDENCE, current.confidence - current.confidence / newSampleCount);

    const sql = `
      UPDATE preference_memory
      SET confidence = ?, sample_count = ?, last_updated = ?
      WHERE id = ?
    `;

    this.dbManager.runMutation(sql, [newConfidence, newSampleCount, timestamp, id]);

    await this.auditLogger.log('preference_update', 'success', 0);

    return id;
  }

  /**
   * 计算模式哈希（用于去重）
   */
  private hashPattern(pattern: Record<string, any>): string {
    const sorted = Object.keys(pattern)
      .sort()
      .reduce((obj, key) => {
        obj[key] = pattern[key];
        return obj;
      }, {} as Record<string, any>);
    
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }

  /**
   * 计算两个模式的匹配分数（Jaccard相似系数）
   * @param storedPattern 存储的模式
   * @param contextPattern 上下文模式
   * @returns 匹配分数 0-1
   */
  private calculateMatchScore(
    storedPattern: Record<string, any>,
    contextPattern: Record<string, any>
  ): number {
    if (Object.keys(contextPattern).length === 0) {
      // 没有上下文，返回基于置信度的分数
      return storedPattern.confidence;
    }

    // 提取键集合
    const storedKeys = new Set(Object.keys(storedPattern));
    const contextKeys = new Set(Object.keys(contextPattern));

    // 计算交集
    let intersection = 0;
    for (const key of contextKeys) {
      if (storedKeys.has(key)) {
        // 值也匹配则加分
        if (storedPattern[key] === contextPattern[key]) {
          intersection++;
        }
      }
    }

    // 计算并集
    const union = new Set([...storedKeys, ...contextKeys]).size;

    // Jaccard相似系数
    return union > 0 ? intersection / union : 0;
  }
}
