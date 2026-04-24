/**
 * IntentFactory 单元测试 - 简化版
 */

import 'reflect-metadata';
import { IntentFactory } from '../../../../src/core/factory/IntentFactory';

jest.mock('vscode', () => ({
  window: {
    activeTextEditor: null
  },
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('IntentFactory Simplified', () => {
  it('should build a chat intent', async () => {
    const intent = await IntentFactory.buildChatIntent('Hello');
    expect(intent.name).toBe('chat');
    expect(intent.userInput).toBe('Hello');
  });

  it('should include metadata in intents', async () => {
    const intent = await IntentFactory.buildChatIntent('Test');
    expect(intent.metadata).toBeDefined();
    expect(intent.metadata?.timestamp).toBeDefined();
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
});
