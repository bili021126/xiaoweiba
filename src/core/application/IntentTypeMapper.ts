/**
 * 意图类型映射器 - 负责将 IntentName 映射到任务类型
 * 
 * 设计原则：委托而非塞入
 * - MemoryAdapter 不应该知道映射规则
 * - 所有映射逻辑集中在此，便于维护和扩展
 */

import { injectable } from 'tsyringe';
import { IntentName } from '../domain/Intent';

@injectable()
export class IntentTypeMapper {
  /**
   * 将意图名称映射到任务类型
   */
  mapIntentToTaskType(intentName: IntentName): string {
    const mapping: Record<IntentName, string> = {
      explain_code: 'CODE_EXPLAIN',
      generate_code: 'CODE_GENERATION',
      generate_commit: 'COMMIT_MESSAGE',
      check_naming: 'NAMING_CHECK',
      optimize_sql: 'SQL_OPTIMIZATION',
      chat: 'CHAT',
      configure_api_key: 'CONFIGURATION',
      export_memory: 'MEMORY_EXPORT',
      import_memory: 'MEMORY_IMPORT',
      inline_completion: 'INLINE_COMPLETION',
      new_session: 'SESSION_MANAGEMENT',
      switch_session: 'SESSION_MANAGEMENT',
      delete_session: 'SESSION_MANAGEMENT'
    };

    return mapping[intentName] || 'OTHER';
  }
}
