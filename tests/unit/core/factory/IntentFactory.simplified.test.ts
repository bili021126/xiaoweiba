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
  });
});
