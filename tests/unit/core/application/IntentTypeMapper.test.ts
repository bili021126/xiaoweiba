/**
 * IntentTypeMapper 单元测试 - 纯逻辑分支覆盖
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { IntentTypeMapper } from '../../../../src/core/application/IntentTypeMapper';

describe('IntentTypeMapper (Branch Coverage)', () => {
  let mapper: IntentTypeMapper;

  beforeEach(() => {
    container.clearInstances();
    mapper = container.resolve(IntentTypeMapper);
  });

  it('should map explain_code to CODE_EXPLAIN', () => {
    expect(mapper.mapIntentToTaskType('explain_code')).toBe('CODE_EXPLAIN');
  });

  it('should map generate_code to CODE_GENERATION', () => {
    expect(mapper.mapIntentToTaskType('generate_code')).toBe('CODE_GENERATION');
  });

  it('should map generate_commit to COMMIT_MESSAGE', () => {
    expect(mapper.mapIntentToTaskType('generate_commit')).toBe('COMMIT_MESSAGE');
  });

  it('should map check_naming to NAMING_CHECK', () => {
    expect(mapper.mapIntentToTaskType('check_naming')).toBe('NAMING_CHECK');
  });

  it('should map optimize_sql to SQL_OPTIMIZATION', () => {
    expect(mapper.mapIntentToTaskType('optimize_sql')).toBe('SQL_OPTIMIZATION');
  });

  it('should map chat to CHAT', () => {
    expect(mapper.mapIntentToTaskType('chat')).toBe('CHAT');
  });

  it('should map configure_api_key to CONFIGURATION', () => {
    expect(mapper.mapIntentToTaskType('configure_api_key')).toBe('CONFIGURATION');
  });

  it('should map export_memory to MEMORY_EXPORT', () => {
    expect(mapper.mapIntentToTaskType('export_memory')).toBe('MEMORY_EXPORT');
  });

  it('should map import_memory to MEMORY_IMPORT', () => {
    expect(mapper.mapIntentToTaskType('import_memory')).toBe('MEMORY_IMPORT');
  });

  it('should map inline_completion to INLINE_COMPLETION', () => {
    expect(mapper.mapIntentToTaskType('inline_completion')).toBe('INLINE_COMPLETION');
  });

  it('should map session intents to SESSION_MANAGEMENT', () => {
    expect(mapper.mapIntentToTaskType('new_session')).toBe('SESSION_MANAGEMENT');
    expect(mapper.mapIntentToTaskType('switch_session')).toBe('SESSION_MANAGEMENT');
    expect(mapper.mapIntentToTaskType('delete_session')).toBe('SESSION_MANAGEMENT');
  });

  it('should return OTHER for unknown intent', () => {
    expect(mapper.mapIntentToTaskType('unknown_intent' as any)).toBe('OTHER');
  });
});
