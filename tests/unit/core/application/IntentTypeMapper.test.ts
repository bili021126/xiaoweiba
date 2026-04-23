import 'reflect-metadata';
import { IntentTypeMapper } from '../../../../src/core/application/IntentTypeMapper';

describe('IntentTypeMapper', () => {
  let mapper: IntentTypeMapper;

  beforeEach(() => {
    mapper = new IntentTypeMapper();
  });

  describe('mapIntentToTaskType', () => {
    it('should map explain_code to CODE_EXPLAIN', () => {
      expect(mapper.mapIntentToTaskType('explain_code' as any)).toBe('CODE_EXPLAIN');
    });

    it('should map generate_code to CODE_GENERATION', () => {
      expect(mapper.mapIntentToTaskType('generate_code' as any)).toBe('CODE_GENERATION');
    });

    it('should map generate_commit to COMMIT_MESSAGE', () => {
      expect(mapper.mapIntentToTaskType('generate_commit' as any)).toBe('COMMIT_MESSAGE');
    });

    it('should map check_naming to NAMING_CHECK', () => {
      expect(mapper.mapIntentToTaskType('check_naming' as any)).toBe('NAMING_CHECK');
    });

    it('should map optimize_sql to SQL_OPTIMIZATION', () => {
      expect(mapper.mapIntentToTaskType('optimize_sql' as any)).toBe('SQL_OPTIMIZATION');
    });

    it('should map chat to CHAT', () => {
      expect(mapper.mapIntentToTaskType('chat' as any)).toBe('CHAT');
    });

    it('should map configure_api_key to CONFIGURATION', () => {
      expect(mapper.mapIntentToTaskType('configure_api_key' as any)).toBe('CONFIGURATION');
    });

    it('should map export_memory to MEMORY_EXPORT', () => {
      expect(mapper.mapIntentToTaskType('export_memory' as any)).toBe('MEMORY_EXPORT');
    });

    it('should map import_memory to MEMORY_IMPORT', () => {
      expect(mapper.mapIntentToTaskType('import_memory' as any)).toBe('MEMORY_IMPORT');
    });

    it('should map inline_completion to INLINE_COMPLETION', () => {
      expect(mapper.mapIntentToTaskType('inline_completion' as any)).toBe('INLINE_COMPLETION');
    });

    it('should map session intents to SESSION_MANAGEMENT', () => {
      expect(mapper.mapIntentToTaskType('new_session' as any)).toBe('SESSION_MANAGEMENT');
      expect(mapper.mapIntentToTaskType('switch_session' as any)).toBe('SESSION_MANAGEMENT');
      expect(mapper.mapIntentToTaskType('delete_session' as any)).toBe('SESSION_MANAGEMENT');
    });

    it('should return OTHER for unknown intent', () => {
      expect(mapper.mapIntentToTaskType('unknown_intent' as any)).toBe('OTHER');
    });
  });
});
