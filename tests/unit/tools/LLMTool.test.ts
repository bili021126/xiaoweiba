import { LLMTool } from '../../../src/tools/LLMTool';
import { ConfigManager } from '../../../src/storage/ConfigManager';
import { AuditLogger } from '../../../src/core/security/AuditLogger';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return function OpenAI() {
    return {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    };
  };
});

describe('LLMTool', () => {
  let llmTool: LLMTool;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        model: {
          default: 'deepseek',
          providers: [
            {
              id: 'deepseek',
              apiUrl: 'https://api.deepseek.com/v1',
              apiKey: 'test-key',
              maxTokens: 4096,
              temperature: 0.6
            },
            {
              id: 'ollama',
              apiUrl: 'http://localhost:11434/v1',
              maxTokens: 2048,
              temperature: 0.6
            }
          ]
        }
      }),
      getApiKey: jest.fn().mockResolvedValue('test-key')
    } as any;

    mockAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;

    llmTool = new LLMTool(mockConfigManager, mockAuditLogger);
  });

  describe('call', () => {
    it('should call LLM and return content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }]
      });

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Test response');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'llm_call',
        'success',
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should handle rate limit errors', async () => {
      mockCreate.mockRejectedValue(new Error('429 Too Many Requests'));

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('速率限制');
    });

    it('should return error for unknown provider', async () => {
      const result = await llmTool.call({
        model: 'unknown-provider',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider not found');
    });
  });

  describe('callStream', () => {
    it('should stream response chunks', async () => {
      const chunks = ['Hello', ' ', 'World'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield { choices: [{ delta: { content: chunk } }] };
          }
        }
      };
      mockCreate.mockResolvedValue(mockStream);

      const receivedChunks: string[] = [];
      const result = await llmTool.callStream(
        { messages: [{ role: 'user', content: 'Hello' }] },
        (chunk) => { receivedChunks.push(chunk); }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello World');
    });

    it('should handle stream errors', async () => {
      mockCreate.mockRejectedValue(new Error('Stream error'));

      const result = await llmTool.callStream(
        { messages: [{ role: 'user', content: 'Hello' }] },
        () => {}
      );

      expect(result.success).toBe(false);
    });
  });

  describe('clearClientCache', () => {
    it('should clear cached clients', () => {
      llmTool.clearClientCache();
    });
  });

  describe('异步错误处理', () => {
    it('应在provider不存在时抛出LLM_PROVIDER_NOT_FOUND错误', async () => {
      const result = await llmTool.call({
        model: 'nonexistent-provider',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider not found');
    });

    it('应在callStream中处理provider不存在错误', async () => {
      const result = await llmTool.callStream(
        {
          model: 'nonexistent-provider',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        () => {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider not found');
    });

    it('应在API Key未配置时抛出LLM_API_CALL_FAILED错误', async () => {
      // Mock config to return a provider without API key
      (mockConfigManager.getConfig as jest.Mock).mockReturnValue({
        model: {
          default: 'custom-provider',
          providers: [
            {
              id: 'custom-provider',
              apiUrl: 'https://api.custom.com/v1',
              maxTokens: 4096,
              temperature: 0.6
              // No apiKey
            }
          ]
        }
      });
      (mockConfigManager.getApiKey as jest.Mock).mockResolvedValue(undefined);

      const result = await llmTool.call({
        model: 'custom-provider',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    it('应在Ollama provider缺少API Key时正常工作', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Ollama response' } }]
      });

      const result = await llmTool.call({
        model: 'ollama',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Ollama response');
    });

    it('应在网络超时错误时返回适当错误', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockCreate.mockRejectedValue(timeoutError);

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('应在认证失败时返回适当错误', async () => {
      const authError = new Error('401 Unauthorized');
      mockCreate.mockRejectedValue(authError);

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      if (result.error) {
        expect(result.error).toMatch(/认证失败|401|Unauthorized/i);
      }
    });

    it('应在服务端错误时返回适当错误', async () => {
      const serverError = new Error('500 Internal Server Error');
      mockCreate.mockRejectedValue(serverError);

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
      if (result.error) {
        expect(result.error).toMatch(/服务器错误|500|Internal Server Error/i);
      }
    });

    it('应在无效响应格式时返回适当错误', async () => {
      mockCreate.mockResolvedValue({
        choices: [] // Empty choices
      });

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
    });

    it('应在stream中处理异步迭代器错误', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Stream iteration error');
        }
      };
      mockCreate.mockResolvedValue(mockStream);

      const receivedChunks: string[] = [];
      const result = await llmTool.callStream(
        { messages: [{ role: 'user', content: 'Hello' }] },
        (chunk) => { receivedChunks.push(chunk); }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stream iteration error');
    });

    it('应在getClientAsync中处理未知异常', async () => {
      // Simulate an unexpected error during client creation
      (mockConfigManager.getApiKey as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

      const result = await llmTool.call({
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.success).toBe(false);
    });
  });

  describe('内容脱敏', () => {
    it('应脱敏API密钥', () => {
      const content = 'My API key is sk-1234567890abcdef1234567890abcdef';
      const sanitized = llmTool['sanitizeContent'](content);
      
      expect(sanitized).toContain('[API_KEY_REDACTED]');
      expect(sanitized).not.toContain('sk-1234567890abcdef1234567890abcdef');
    });

    it('应脱敏Bearer Token', () => {
      const content = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const sanitized = llmTool['sanitizeContent'](content);
      
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('应脱敏GitHub Token', () => {
      const content = 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const sanitized = llmTool['sanitizeContent'](content);
      
      expect(sanitized).toContain('[GITHUB_TOKEN_REDACTED]');
      expect(sanitized).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    });

    it('应脱敏环境变量引用', () => {
      const content = 'Use ${API_KEY_SECRET} for authentication';
      const sanitized = llmTool['sanitizeContent'](content);
      
      expect(sanitized).toContain('[ENV_VAR_REDACTED]');
      expect(sanitized).not.toContain('${API_KEY_SECRET}');
    });

    it('应保持正常内容不变', () => {
      const content = 'This is a normal message without secrets';
      const sanitized = llmTool['sanitizeContent'](content);
      
      expect(sanitized).toBe(content);
    });

    it('应在call方法中自动脱敏消息', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }]
      });

      const messages = [{ role: 'user' as const, content: 'API key: sk-test1234567890abcdef1234567890ab' }];
      await llmTool.call({ messages });

      // 验证 OpenAI 客户端接收到的消息已脱敏
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('[API_KEY_REDACTED]')
            })
          ])
        })
      );
    });
  });
});
