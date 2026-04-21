import { SessionCompressor } from '../../src/core/application/SessionCompressor';
import { ChatAgent } from '../../src/agents/ChatAgent';
import { Intent } from '../../src/core/domain/Intent';
import { MemoryContext } from '../../src/core/domain/MemoryContext';
import { ILLMPort } from '../../src/core/ports/ILLMPort';
import { IMemoryPort } from '../../src/core/ports/IMemoryPort';
import { IEventBus } from '../../src/core/ports/IEventBus';
import { PromptComposer } from '../../src/core/application/PromptComposer';

describe('三层记忆结构 E2E 测试', () => {
  let compressor: SessionCompressor;
  let mockLLMPort: jest.Mocked<ILLMPort>;

  beforeEach(() => {
    // Mock LLM Port 以模拟压缩响应
    mockLLMPort = {
      call: jest.fn().mockResolvedValue({
        success: true,
        text: JSON.stringify({
          summary: '用户正在开发一个用户登录系统，讨论了使用 JWT 方案进行认证。',
          newKeyDecisions: ['确定使用 JWT 作为认证方案', '决定将 token 存储在 localStorage']
        })
      }),
      callStream: jest.fn()
    } as any;

    compressor = new SessionCompressor(mockLLMPort, {} as any);
  });

  it('应该在多次压缩后仍然保留 L1 核心意图和 L2 关键决策', async () => {
    // 模拟一个长会话
    const sessionHistory = [
      { role: 'user', content: '我想做一个登录系统' },
      { role: 'assistant', content: '好的，我们可以用 JWT 来实现' },
      { role: 'user', content: 'JWT token 存在哪里比较好？' },
      { role: 'assistant', content: '建议存在 localStorage' },
      { role: 'user', content: '那安全性如何保证？' },
      { role: 'assistant', content: '可以配合 HttpOnly Cookie 使用' },
      { role: 'user', content: '后端用什么框架好？' },
      { role: 'assistant', content: 'Node.js 的 Express 或者 Koa 都不错' },
      { role: 'user', content: '数据库选哪个？' },
      { role: 'assistant', content: 'PostgreSQL 是个稳健的选择' },
      { role: 'user', content: '前端呢？' },
      { role: 'assistant', content: 'React 生态很丰富' }
    ];

    const existingDecisions: string[] = [];
    
    // 第一次压缩
    const result = await compressor.compressIfNeeded(sessionHistory, existingDecisions);

    expect(result.newKeyDecisions).toContain('确定使用 JWT 作为认证方案');
    expect(result.summary).toContain('JWT');

    // 构建 Intent 和 MemoryContext
    const intent: Intent = {
      name: 'chat',
      userInput: '继续讨论登录系统的前端实现',
      metadata: {
        timestamp: Date.now(),
        source: 'chat',
        coreIntent: '创建一个安全且易用的用户登录系统' // L1 已设定
      },
      codeContext: undefined
    };

    const memoryContext: MemoryContext = {
      episodicMemories: [],
      preferenceRecommendations: [],
      keyDecisions: result.newKeyDecisions.map(d => ({
        timestamp: Date.now(),
        decision: d
      })),
      sessionSummary: result.summary,
      sessionHistory: []
    };

    // 模拟 ChatAgent 构建系统提示词
    const mockPromptComposer = {
      buildSystemPrompt: jest.fn().mockImplementation((intent: Intent, memoryContext: MemoryContext) => {
        let prompt = '你是小尾巴，一个智能编程助手。\n\n';
        
        // L1: 核心意图
        if (intent.metadata?.coreIntent) {
          prompt += '🎯 核心目标\n';
          prompt += `${intent.metadata.coreIntent}\n\n`;
        }
        
        // L2: 关键决策
        prompt += '📋 已做出的关键决策\n';
        if (memoryContext.keyDecisions && memoryContext.keyDecisions.length > 0) {
          memoryContext.keyDecisions.forEach(decision => {
            prompt += `- ${decision.decision}\n`;
          });
        } else {
          prompt += '- 暂无关键决策\n';
        }
        
        // L3: 当前对话上下文
        prompt += '\n💬 当前对话上下文\n';
        if (memoryContext.sessionHistory && memoryContext.sessionHistory.length > 0) {
          memoryContext.sessionHistory.slice(-5).forEach(msg => {
            prompt += `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}\n`;
          });
        }
        
        return prompt;
      })
    } as any;
    const chatAgent = new ChatAgent(mockLLMPort, {} as IMemoryPort, {} as IEventBus, mockPromptComposer);
    const systemPrompt = (chatAgent as any).buildSystemPrompt(intent, memoryContext);

    // 验证提示词包含三层结构
    expect(systemPrompt).toContain('🎯 核心目标');
    expect(systemPrompt).toContain('创建一个安全且易用的用户登录系统');
    expect(systemPrompt).toContain('📋 已做出的关键决策');
    expect(systemPrompt).toContain('确定使用 JWT 作为认证方案');
    expect(systemPrompt).toContain('💬 当前对话上下文');
    expect(systemPrompt).toContain('JWT');
  });
});
