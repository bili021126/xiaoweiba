/**
 * IntentFactory 单元测试 - 验证意图构建逻辑
 */

import 'reflect-metadata';
import { IntentFactory } from '../../../../src/core/factory/IntentFactory';

describe('IntentFactory Unit Tests', () => {
  it('should build a chat intent', async () => {
    const intent = await IntentFactory.buildChatIntent('Hello');
    expect(intent.name).toBe('chat');
    expect(intent.userInput).toBe('Hello');
  });

  it('should build an explain code intent', async () => {
    const intent = await IntentFactory.buildExplainCodeIntent();
    expect(intent.name).toBe('explain_code');
    expect(intent.codeContext).toBeDefined();
  });

  it('should build a switch session intent', async () => {
    const intent = await IntentFactory.buildSwitchSessionIntent('session_123');
    expect(intent.name).toBe('switch_session');
    expect(intent.metadata?.sessionId).toBe('session_123');
  });

  it('should build a generate commit intent', async () => {
    const intent = await IntentFactory.buildGenerateCommitIntent();
    expect(intent.name).toBe('generate_commit');
  });

  it('should include metadata in intents', async () => {
    const intent = await IntentFactory.buildChatIntent('Test');
    expect(intent.metadata).toBeDefined();
  });
});
