import { ErrorCode, XiaoWeibaException, createError, getUserFriendlyMessage } from '../../../src/utils/ErrorCodes';

describe('ErrorCodes', () => {
  describe('XiaoWeibaException', () => {
    it('should create an error with all properties', () => {
      const error = new XiaoWeibaException(
        ErrorCode.CONFIG_LOAD_FAILED,
        'Internal error message',
        'User friendly message',
        { detail: 'some detail' }
      );

      expect(error.code).toBe(ErrorCode.CONFIG_LOAD_FAILED);
      expect(error.message).toBe('Internal error message');
      expect(error.userMessage).toBe('User friendly message');
      expect(error.details).toEqual({ detail: 'some detail' });
      expect(error.name).toBe('XiaoWeibaException');
    });

    it('should serialize to JSON correctly', () => {
      const error = new XiaoWeibaException(
        ErrorCode.DB_CONNECTION_FAILED,
        'DB error',
        'Database connection failed',
        { path: '/tmp/db' }
      );

      const json = error.toJSON();
      expect(json.code).toBe(ErrorCode.DB_CONNECTION_FAILED);
      expect(json.message).toBe('DB error');
      expect(json.userMessage).toBe('Database connection failed');
      expect(json.details).toEqual({ path: '/tmp/db' });
      expect(json.stack).toBeDefined();
    });
  });

  describe('createError', () => {
    it('should create a XiaoWeibaException', () => {
      const error = createError(
        ErrorCode.SEC_AUTHORIZATION_DENIED,
        'Auth denied',
        'Authorization denied',
        { resource: 'file' }
      );

      expect(error).toBeInstanceOf(XiaoWeibaException);
      expect(error.code).toBe(ErrorCode.SEC_AUTHORIZATION_DENIED);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return userMessage for XiaoWeibaException', () => {
      const error = new XiaoWeibaException(
        ErrorCode.GEN_UNKNOWN_ERROR,
        'Internal',
        'Something went wrong'
      );

      expect(getUserFriendlyMessage(error)).toBe('Something went wrong');
    });

    it('should return generic message for standard Error', () => {
      const error = new Error('Standard error');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('Standard error');
    });

    it('should return default message for unknown error type', () => {
      const message = getUserFriendlyMessage('string error');
      expect(message).toBe('发生未知错误，请查看日志获取详细信息');
    });
  });

  describe('ErrorCode enum', () => {
    it('should have all required error codes', () => {
      // Config errors
      expect(ErrorCode.CONFIG_LOAD_FAILED).toBe('XWB-CFG-001');
      expect(ErrorCode.CONFIG_PARSE_ERROR).toBe('XWB-CFG-002');

      // Database errors
      expect(ErrorCode.DB_CONNECTION_FAILED).toBe('XWB-DB-001');
      expect(ErrorCode.DB_BACKUP_FAILED).toBe('XWB-DB-004');

      // LLM errors
      expect(ErrorCode.LLM_API_CALL_FAILED).toBe('XWB-LLM-001');
      expect(ErrorCode.LLM_RATE_LIMITED).toBe('XWB-LLM-002');

      // Security errors
      expect(ErrorCode.SEC_AUTHORIZATION_DENIED).toBe('XWB-SEC-001');
      expect(ErrorCode.SEC_PATH_TRAVERSAL_DETECTED).toBe('XWB-SEC-003');

      // Memory errors
      expect(ErrorCode.MEM_RECORD_FAILED).toBe('XWB-MEM-001');
      expect(ErrorCode.MEM_EXPORT_FAILED).toBe('XWB-MEM-003');

      // Skill errors
      expect(ErrorCode.SKL_LOAD_FAILED).toBe('XWB-SKL-001');
      expect(ErrorCode.SKL_EXECUTION_FAILED).toBe('XWB-SKL-003');

      // Tool errors
      expect(ErrorCode.TL_FILE_READ_FAILED).toBe('XWB-TL-001');
      expect(ErrorCode.TL_GIT_OPERATION_FAILED).toBe('XWB-TL-003');

      // General errors
      expect(ErrorCode.GEN_UNKNOWN_ERROR).toBe('XWB-GEN-001');
      expect(ErrorCode.GEN_TIMEOUT).toBe('XWB-GEN-002');
    });
  });
});
