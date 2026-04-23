/**
 * CommitStyleLearner 单元测试
 */

import 'reflect-metadata';
import { CommitStyleLearner, CommitStylePreference } from '../../../../src/core/memory/CommitStyleLearner';
import { EpisodicMemory } from '../../../../src/core/memory/EpisodicMemory';

// Mock EpisodicMemory
const mockEpisodicMemory: jest.Mocked<EpisodicMemory> = {
  retrieve: jest.fn(),
  record: jest.fn(),
  delete: jest.fn(),
  getStats: jest.fn(),
  retrieveAll: jest.fn()
} as any;

describe('CommitStyleLearner - 提交风格学习器', () => {
  let learner: CommitStyleLearner;

  beforeEach(() => {
    jest.clearAllMocks();
    learner = new CommitStyleLearner(mockEpisodicMemory);
  });

  describe('learnFromHistory - 从历史记忆学习', () => {
    it('应该从提交记忆中提取风格偏好', async () => {
      const mockMemories = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat(auth): add login' },
        { taskType: 'COMMIT_GENERATE', summary: 'fix(bug): resolve error' },
        { taskType: 'COMMIT_GENERATE', summary: 'refactor(core): optimize' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(mockMemories as any);

      const preference = await learner.learnFromHistory();

      expect(preference).toBeDefined();
      expect(preference.domain).toBe('COMMIT_STYLE');
      expect(preference.sampleCount).toBe(3);
    });

    it('无历史记录时应返回默认偏好', async () => {
      mockEpisodicMemory.retrieve.mockResolvedValue([]);

      const preference = await learner.learnFromHistory();

      expect(preference).toBeDefined();
      expect(preference.domain).toBe('COMMIT_STYLE');
      expect(preference.sampleCount).toBe(0);
    });
  });

  describe('风格模式提取', () => {
    it('应该提取常用的 commit type', async () => {
      const memories = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat: add user' },
        { taskType: 'COMMIT_GENERATE', summary: 'feat: add post' },
        { taskType: 'COMMIT_GENERATE', summary: 'fix: bug fix' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(memories as any);

      const preference = await learner.learnFromHistory();

      expect(preference.pattern.preferredTypes).toContain('feat');
    });

    it('应该检测是否总是包含 scope', async () => {
      const memoriesWithScope = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat(auth): add login' },
        { taskType: 'COMMIT_GENERATE', summary: 'fix(api): resolve error' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(memoriesWithScope as any);

      const preference = await learner.learnFromHistory();

      expect(preference.pattern.alwaysIncludeScope).toBe(true);
    });
  });

  describe('语言偏好检测', () => {
    it('应该检测中文提交信息', async () => {
      const chineseMemories = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat: 添加用户登录功能' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(chineseMemories as any);

      const preference = await learner.learnFromHistory();

      expect(preference.pattern.language).toBe('zh');
    });

    it('应该检测英文提交信息', async () => {
      const englishMemories = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat: add authentication' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(englishMemories as any);

      const preference = await learner.learnFromHistory();

      expect(preference.pattern.language).toBe('en');
    });
  });

  describe('边界情况处理', () => {
    it('应该处理无效的提交总结', async () => {
      const invalidMemories = [
        { taskType: 'COMMIT_GENERATE', summary: '' },
        { taskType: 'OTHER_TASK', summary: 'not a commit' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(invalidMemories as any);

      const preference = await learner.learnFromHistory();

      expect(preference.sampleCount).toBe(0);
    });

    it('应该过滤非 COMMIT_GENERATE 类型的记忆', async () => {
      const mixedMemories = [
        { taskType: 'COMMIT_GENERATE', summary: 'feat: valid' },
        { taskType: 'CODE_EXPLAIN', summary: 'explain code' }
      ];

      mockEpisodicMemory.retrieve.mockResolvedValue(mixedMemories as any);

      const preference = await learner.learnFromHistory();

      expect(preference.sampleCount).toBe(1);
    });
  });

  describe('置信度计算', () => {
    it('样本越多置信度越高', async () => {
      const smallSample = [{ taskType: 'COMMIT_GENERATE', summary: 'feat: test' }];
      const largeSample = Array.from({ length: 50 }, (_, i) => ({
        taskType: 'COMMIT_GENERATE',
        summary: `feat: feature ${i}`
      }));

      mockEpisodicMemory.retrieve.mockResolvedValueOnce(smallSample as any);
      const lowConfidence = await learner.learnFromHistory();

      mockEpisodicMemory.retrieve.mockResolvedValueOnce(largeSample as any);
      const highConfidence = await learner.learnFromHistory();

      expect(highConfidence.confidence).toBeGreaterThan(lowConfidence.confidence);
    });

    it('置信度应在 0-1 范围内', async () => {
      mockEpisodicMemory.retrieve.mockResolvedValue([
        { taskType: 'COMMIT_GENERATE', summary: 'feat: test' }
      ] as any);

      const preference = await learner.learnFromHistory();

      expect(preference.confidence).toBeGreaterThanOrEqual(0);
      expect(preference.confidence).toBeLessThanOrEqual(1);
    });
  });
});
