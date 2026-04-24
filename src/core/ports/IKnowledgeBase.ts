/**
 * 知识库端口 - 用于存储和检索编排模板、反思结果、知识碎片等
 * 
 * 设计原则：
 * - 端口-适配器模式：抽象层与实现分离
 * - 支持向量相似度搜索
 * - 支持模板复用与经验编译
 */

export interface OrchestrationTemplate {
  id: string;
  intentName: string;              // 意图名称
  intentVector: number[];          // 意图向量表征
  toolSequence: string[];          // 工具调用序列
  parameters: Record<string, any>; // 参数配置
  successRate: number;             // 成功率 (0-1)
  usageCount: number;              // 使用次数
  lastUsed: number;                // 最后使用时间戳
  createdAt: number;               // 创建时间戳
  compiledVirtualAgent?: string;   // 是否已编译为虚拟Agent
}

export interface TaskReflection {
  id: string;
  taskId: string;                  // 关联的任务ID
  reflection: string;              // 反思内容
  suggestions: string[];           // 改进建议
  knowledgeFragments: string[];    // 提取的知识片段ID列表
  createdAt: number;               // 创建时间戳
}

export interface KnowledgeFragment {
  id: string;
  content: string;                 // 知识内容
  vector: number[];                // 向量表征
  sourceTaskId: string;            // 来源任务ID
  tags: string[];                  // 标签
  createdAt: number;               // 创建时间戳
  lastUsed?: number;               // 最后使用时间戳
  score: number;                   // 评分 (0-1)
}

export interface VirtualAgent {
  name: string;                    // Agent名称
  description: string;             // 描述
  templateId: string;              // 关联的模板ID
  agentCode: string;               // 生成的Agent代码
  status: 'active' | 'review' | 'disabled'; // 状态
  createdAt: number;               // 创建时间戳
}

export interface IKnowledgeBase {
  // ========== 编排模板管理 ==========
  
  /**
   * 存储编排模板
   */
  storeTemplate(template: OrchestrationTemplate): Promise<void>;

  /**
   * 搜索相似的编排模板
   * @param intentVector 意图向量
   * @param options 搜索选项
   */
  searchTemplates(
    intentVector: number[],
    options?: { similarityThreshold?: number; limit?: number }
  ): Promise<OrchestrationTemplate[]>;

  /**
   * 更新模板统计信息
   * @param id 模板ID
   * @param success 是否成功
   */
  updateTemplateStats(id: string, success: boolean): Promise<void>;

  /**
   * 获取所有模板（用于编译器检查）
   */
  listTemplates(): Promise<OrchestrationTemplate[]>;

  // ========== 反思报告管理 ==========
  
  /**
   * 存储反思报告
   */
  storeReflection(reflection: TaskReflection): Promise<void>;

  /**
   * 获取任务的反思报告
   */
  getReflections(taskId: string): Promise<TaskReflection[]>;

  // ========== 知识碎片管理 ==========
  
  /**
   * 存储知识碎片
   */
  storeFragment(fragment: KnowledgeFragment): Promise<void>;

  /**
   * 搜索知识碎片
   */
  searchFragments(
    queryVector: number[],
    options?: { limit?: number; tags?: string[] }
  ): Promise<KnowledgeFragment[]>;

  // ========== 虚拟Agent管理 ==========
  
  /**
   * 注册虚拟Agent
   */
  registerVirtualAgent(agent: VirtualAgent): Promise<void>;

  /**
   * 获取虚拟Agent
   */
  getVirtualAgent(name: string): Promise<VirtualAgent | null>;

  /**
   * 列出所有虚拟Agent
   */
  listVirtualAgents(): Promise<VirtualAgent[]>;
}
