import 'reflect-metadata';
import { AgentRunner } from '../../../../src/infrastructure/agent/AgentRunner';
import { IEventBus } from '../../../../src/core/ports/IEventBus';
import { IAgentRegistry } from '../../../../src/core/ports/IAgentRegistry';
import { IMemoryPort } from '../../../../src/core/ports/IMemoryPort';
import { AuditLogger } from '../../../../src/core/security/AuditLogger';
import { IAgent, IAgentContext } from '../../../../src/core/agent/IAgent';
import { AgentSelectedEvent, TaskCompletedEvent, TaskFailedEvent } from '../../../../src/core/events/DomainEvent';
import { Intent } from '../../../../src/core/domain/Intent';
import { MemoryContext } from '../../../../src/core/domain/MemoryContext';

// Mock dependencies
const mockEventBus: jest.Mocked<IEventBus> = {
  publish: jest.fn(),
  subscribe: jest.fn().mockReturnValue(jest.fn())
} as any;

const mockAgentRegistry: jest.Mocked<IAgentRegistry> = {
  getAgent: jest.fn(),
  register: jest.fn(),
  unregister: jest.fn(),
  findAgentsForIntent: jest.fn(),
  getAll: jest.fn()
} as any;

const mockMemoryPort: jest.Mocked<IMemoryPort> = {
  recordAgentExecution: jest.fn()
} as any;

const mockAuditLogger: jest.Mocked<AuditLogger> = {
  log: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined)
} as any;

describe('AgentRunner', () => {
  let agentRunner: AgentRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    agentRunner = new AgentRunner(
      mockEventBus,
      mockAgentRegistry,
      mockAuditLogger,
      mockMemoryPort
    );
  });

  afterEach(() => {
    // Clean up any pending timers
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should subscribe to AgentSelectedEvent on construction', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        AgentSelectedEvent.type,
        expect.any(Function)
      );
    });
  });

  describe('executeWithTimeout - Type Safety (P1)', () => {
    it('should accept IAgentContext with proper types', async () => {
      const mockAgent: IAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        supportedIntents: ['test'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ success: true })
      };

      const context: IAgentContext = {
        intent: {
          name: 'test_intent' as any,
          userInput: 'test',
          metadata: { timestamp: Date.now(), source: 'chat' as const }
        },
        memoryContext: {} as MemoryContext
      };

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent);

      // Trigger execution via event
      const event = new AgentSelectedEvent(
        context.intent,
        'test-agent',
        context.memoryContext
      );

      // Simulate event handling
      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];
      await subscribeCallback(event);

      // Verify the agent was called with properly typed context
      expect(mockAgent.execute).toHaveBeenCalledWith(context);
    });

    it('should enforce type safety for intent parameter', () => {
      const context: IAgentContext = {
        intent: {
          name: 'test' as any,
          userInput: 'test input',
          metadata: { 
            timestamp: Date.now(),
            source: 'chat' as const
          }
        },
        memoryContext: {} as MemoryContext
      };

      // TypeScript should catch errors if we try to use wrong types
      expect(context.intent.name).toBeDefined();
      expect(context.intent.userInput).toBe('test input');
      expect(context.intent.metadata.timestamp).toBeDefined();
    });

    it('should enforce type safety for memoryContext parameter', () => {
      const context: IAgentContext = {
        intent: {
          name: 'test' as any,
          userInput: 'test',
          metadata: { timestamp: Date.now(), source: 'chat' as const }
        },
        memoryContext: {
          episodicMemories: [],
          semanticMemories: [],
          preferences: [],
          preferenceRecommendations: []
        } as MemoryContext
      };

      expect(context.memoryContext.episodicMemories).toEqual([]);
      expect(Array.isArray(context.memoryContext.episodicMemories)).toBe(true);
    });
  });

  describe('handleAgentSelected', () => {
    it('should execute agent successfully', async () => {
      const mockAgent: IAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        supportedIntents: ['test'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockResolvedValue({ 
          success: true,
          data: { result: 'success' }
        })
      };

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent);

      const intent: Intent = {
        name: 'test_intent' as any,
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext: MemoryContext = {
        episodicMemories: [],
        semanticMemories: [],
        preferences: []
      } as any;

      const event = new AgentSelectedEvent(intent, 'test-agent', memoryContext);

      // Get the subscription callback and call it
      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];
      await subscribeCallback(event);

      // Verify agent was executed
      expect(mockAgent.execute).toHaveBeenCalledWith({
        intent,
        memoryContext
      });

      // Verify performance was recorded
      expect(mockMemoryPort.recordAgentExecution).toHaveBeenCalledWith(
        'test-agent',
        'test_intent',
        true,
        expect.any(Number)
      );

      // Verify TaskCompletedEvent was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(TaskCompletedEvent)
      );
    });

    it('should handle agent not found', async () => {
      mockAgentRegistry.getAgent.mockReturnValue(undefined);

      const intent: Intent = {
        name: 'test_intent' as any,
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext: MemoryContext = {} as any;
      const event = new AgentSelectedEvent(intent, 'non-existent', memoryContext);

      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];
      await subscribeCallback(event);

      // Verify TaskFailedEvent was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(TaskFailedEvent)
      );
    });

    it('should handle agent execution failure', async () => {
      const mockAgent: IAgent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        supportedIntents: ['test'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockRejectedValue(new Error('Execution failed'))
      };

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent);

      const intent: Intent = {
        name: 'test_intent' as any,
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext: MemoryContext = {} as any;
      const event = new AgentSelectedEvent(intent, 'failing-agent', memoryContext);

      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];
      await subscribeCallback(event);

      // Verify audit log was recorded
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        'agent_execution',
        'failure',
        expect.any(Number),
        expect.objectContaining({
          parameters: expect.objectContaining({
            agentId: 'failing-agent',
            error: 'Execution failed'
          })
        })
      );

      // Verify TaskFailedEvent was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(TaskFailedEvent)
      );
    });

    it('should check agent availability before execution', async () => {
      const mockAgent: IAgent = {
        id: 'unavailable-agent',
        name: 'Unavailable Agent',
        supportedIntents: ['test'],
        getCapabilities: jest.fn().mockReturnValue([]),
        isAvailable: jest.fn().mockResolvedValue(false),
        execute: jest.fn()
      };

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent);

      const intent: Intent = {
        name: 'test_intent' as any,
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext: MemoryContext = {} as any;
      const event = new AgentSelectedEvent(intent, 'unavailable-agent', memoryContext);

      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];
      await subscribeCallback(event);

      // Verify availability was checked
      expect(mockAgent.isAvailable).toHaveBeenCalled();

      // Verify execute was NOT called
      expect(mockAgent.execute).not.toHaveBeenCalled();

      // Verify TaskFailedEvent was published
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(TaskFailedEvent)
      );
    });
  });

  describe('concurrency control', () => {
    it('should queue tasks when agent is already executing', async () => {
      const mockAgent: IAgent = {
        id: 'slow-agent',
        name: 'Slow Agent',
        supportedIntents: ['test'],
        getCapabilities: jest.fn().mockReturnValue([]),
        execute: jest.fn().mockImplementation(() => {
          return new Promise(resolve => setTimeout(() => resolve({ success: true }), 100));
        })
      };

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent);

      const intent: Intent = {
        name: 'test_intent' as any,
        userInput: 'test',
        metadata: { timestamp: Date.now(), source: 'chat' as const }
      };

      const memoryContext: MemoryContext = {} as any;

      const subscribeCallback = (mockEventBus.subscribe as jest.Mock).mock.calls[0][1];

      // Start first task
      const task1Promise = subscribeCallback(
        new AgentSelectedEvent(intent, 'slow-agent', memoryContext)
      );

      // Wait a bit to ensure first task started
      await new Promise(resolve => setTimeout(resolve, 10));

      // Start second task (should be queued)
      const task2Promise = subscribeCallback(
        new AgentSelectedEvent(intent, 'slow-agent', memoryContext)
      );

      // Wait for both to complete
      await Promise.all([task1Promise, task2Promise]);

      // Both tasks should have been executed
      expect(mockAgent.execute).toHaveBeenCalledTimes(2);
    });
  });
});
