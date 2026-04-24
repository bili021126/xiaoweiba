/**
 * PromptComposer 单元测试 - 验证动态语气与提示词组装
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { PromptComposer } from '../../../../src/core/application/PromptComposer';
import { MemoryContext } from '../../../../src/core/domain/MemoryContext';

describe('PromptComposer Unit Tests', () => {
  let composer: PromptComposer;

  beforeEach(() => {
    container.clearInstances();
    composer = container.resolve(PromptComposer);
  });

  it('should generate novice tone when memory count is 0', () => {
    const context: MemoryContext = { episodicMemories: [], preferenceRecommendations: [] };
    const prompt = (composer as any).buildDynamicToneInstruction(context);
    expect(prompt).toContain('新手引导模式');
  });

  it('should generate expert tone when memory count is high', () => {
    const memories = Array(55).fill({ summary: 'test' });
    const context: MemoryContext = { episodicMemories: memories, preferenceRecommendations: [] };
    const prompt = (composer as any).buildDynamicToneInstruction(context);
    expect(prompt).toContain('资深伙伴模式');
  });

  it('should include enriched context in system prompt', () => {
    const intent: any = {
      metadata: {
        enrichedContext: {
          activeFilePath: '/test/file.ts',
          activeFileLanguage: 'typescript',
          cursorLine: 10
        }
      }
    };
    const context: MemoryContext = { episodicMemories: [], preferenceRecommendations: [] };
    const prompt = composer.buildSystemPrompt(intent, context);
    expect(prompt).toContain('当前工作环境');
    expect(prompt).toContain('file.ts');
  });
});
