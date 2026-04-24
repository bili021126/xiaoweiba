/**
 * ChatAgent 纯逻辑工具函数测试 - 无需 Mock，直接测试
 */

import { shouldRecordMemory, extractEntitiesFromMessage } from '../../../src/agents/chatAgentUtils';

describe('chatAgentUtils', () => {
  describe('extractEntitiesFromMessage', () => {
    it('应该提取代码关键词（中文）', () => {
      const entities = extractEntitiesFromMessage('请帮我写一个函数处理数据');
      expect(entities).toContain('函数');
    });

    it('应该提取代码关键词（英文）', () => {
      const entities = extractEntitiesFromMessage('Please help me write a function to process data');
      expect(entities).toContain('function');
    });

    it('应该提取文件名', () => {
      const entities = extractEntitiesFromMessage('修复 index.ts 中的 bug');
      expect(entities).toContain('index.ts');
    });

    it('应该提取多个文件名', () => {
      const entities = extractEntitiesFromMessage('修改 app.js 和 utils.py');
      expect(entities).toContain('app.js');
      expect(entities).toContain('utils.py');
    });

    it('空消息应返回空数组', () => {
      const entities = extractEntitiesFromMessage('');
      expect(entities).toEqual([]);
    });

    it('无匹配内容应返回空数组', () => {
      const entities = extractEntitiesFromMessage('你好世界');
      expect(entities).toEqual([]);
    });

    it('应该同时提取关键词和文件名', () => {
      const entities = extractEntitiesFromMessage('在 main.ts 中创建一个类');
      expect(entities).toContain('类');
      expect(entities).toContain('main.ts');
    });
  });

  describe('shouldRecordMemory', () => {
    it('非 chat 意图应始终记录', () => {
      const result = shouldRecordMemory(
        { name: 'explain_code' } as any,
        'hi',
        'ok'
      );
      expect(result).toBe(true);
    });

    it('chat 意图且复杂度高时应记录', () => {
      const result = shouldRecordMemory(
        { name: 'chat' } as any,
        '我想了解如何优化这个数据库查询性能，特别是索引策略',
        '这是一个很长的回复内容...'.repeat(10)
      );
      expect(result).toBe(true);
    });

    it('chat 意图且回复长度长时应记录', () => {
      const result = shouldRecordMemory(
        { name: 'chat' } as any,
        'hi',
        'This is a very long response that exceeds eighty characters in length to trigger memory recording based on the response length threshold condition.'
      );
      expect(result).toBe(true);
    });

    it('chat 意图且复杂度低、回复短时应不记录', () => {
      const result = shouldRecordMemory(
        { name: 'chat' } as any,
        'hi',
        'ok'
      );
      expect(result).toBe(false);
    });
  });
});
