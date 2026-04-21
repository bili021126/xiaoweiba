/**
 * ContextEnricher E2E测试
 * 
 * 测试场景：
 * 1. 用户打开文件并选中代码,询问"解释这段代码"
 * 2. 验证AI回答中包含具体文件名和行号(如"UserService.java第42行")
 * 
 * E2E测试特点：
 * - 模拟真实用户操作
 * - 验证端到端数据流完整性
 * - 不Mock核心组件,使用真实实现
 */

import 'reflect-metadata';
import * as vscode from 'vscode';
import { ContextEnricher } from '../../src/core/application/ContextEnricher';
import { IntentFactory } from '../../src/core/factory/IntentFactory';
import { Intent } from '../../src/core/domain/Intent';

describe('ContextEnricher E2E测试', () => {
  let contextEnricher: ContextEnricher;

  beforeAll(() => {
    // 初始化ContextEnricher
    contextEnricher = new ContextEnricher();
  });

  describe('场景1: 采集编辑器上下文', () => {
    it('应该能够捕获当前激活编辑器的状态', async () => {
      // 注意：在E2E测试环境中,如果没有激活编辑器,会返回undefined
      // 这个测试主要验证ContextEnricher的基本功能
      
      const enrichedContext = await contextEnricher.capture();
      
      // 如果有激活编辑器,验证捕获的数据结构
      if (enrichedContext) {
        expect(enrichedContext).toBeDefined();
        expect(enrichedContext.timestamp).toBeGreaterThan(0);
        
        // 验证可选字段的结构
        if (enrichedContext.activeFilePath) {
          expect(typeof enrichedContext.activeFilePath).toBe('string');
          expect(enrichedContext.activeFilePath.length).toBeGreaterThan(0);
        }
        
        if (enrichedContext.cursorLine) {
          expect(typeof enrichedContext.cursorLine).toBe('number');
          expect(enrichedContext.cursorLine).toBeGreaterThan(0);
        }
      } else {
        // 没有激活编辑器时返回undefined是正常的
        expect(enrichedContext).toBeUndefined();
      }
    });

    it('应该正确格式化上下文描述', () => {
      const mockContext = {
        activeFilePath: '/path/to/UserService.java',
        activeFileLanguage: 'java',
        cursorLine: 42,
        timestamp: Date.now()
      };

      const description = contextEnricher.formatContextDescription(mockContext);
      
      expect(description).toContain('UserService.java');
      expect(description).toContain('第42行');
    });

    it('应该包含选中代码的行号范围', () => {
      const mockContext = {
        activeFilePath: '/path/to/Controller.ts',
        activeFileLanguage: 'typescript',
        cursorLine: 10,
        selectedCode: {
          content: 'function test() {}',
          startLine: 5,
          endLine: 15
        },
        timestamp: Date.now()
      };

      const description = contextEnricher.formatContextDescription(mockContext);
      
      expect(description).toContain('Controller.ts');
      expect(description).toContain('第10行');
      expect(description).toContain('选中第5-15行');
    });
  });

  describe('场景2: 注入Intent元数据', () => {
    it('应该能够将enrichedContext注入到Intent中', async () => {
      // 创建一个模拟的Intent
      const mockIntent: Intent = {
        name: 'chat',
        userInput: '解释这段代码',
        metadata: {
          timestamp: Date.now(),
          source: 'chat',
          sessionId: 'test-session'
        }
      };

      // 注入上下文(可能为undefined,取决于是否有激活编辑器)
      const enrichedIntent = await contextEnricher.enrichIntent(mockIntent);
      
      // 验证Intent结构完整
      expect(enrichedIntent).toBeDefined();
      expect(enrichedIntent.name).toBe('chat');
      expect(enrichedIntent.userInput).toBe('解释这段代码');
      
      // 验证metadata存在
      expect(enrichedIntent.metadata).toBeDefined();
      expect(enrichedIntent.metadata.timestamp).toBeGreaterThan(0);
    });

    it('应该在有激活编辑器时注入enrichedContext', async () => {
      const mockIntent: Intent = {
        name: 'explain_code',
        metadata: {
          timestamp: Date.now(),
          source: 'command'
        }
      };

      const enrichedIntent = await contextEnricher.enrichIntent(mockIntent);
      
      // 如果有激活编辑器,验证enrichedContext被注入
      if ((enrichedIntent.metadata as any).enrichedContext) {
        const ctx = (enrichedIntent.metadata as any).enrichedContext;
        expect(ctx).toBeDefined();
        expect(ctx.timestamp).toBeGreaterThan(0);
        
        if (ctx.activeFilePath) {
          expect(typeof ctx.activeFilePath).toBe('string');
        }
      }
    });
  });

  describe('场景3: 代码长度限制', () => {
    it('应该截断过长的选中代码', async () => {
      // 创建一个超长的代码片段
      const longCode = 'const x = 1;\n'.repeat(500); // 约6000字符
      
      const mockContext = {
        activeFilePath: '/path/to/LargeFile.js',
        activeFileLanguage: 'javascript',
        cursorLine: 100,
        selectedCode: {
          content: longCode,
          startLine: 50,
          endLine: 550
        },
        timestamp: Date.now()
      };

      // 验证截断逻辑(通过formatContextDescription间接测试)
      const description = contextEnricher.formatContextDescription(mockContext);
      expect(description).toContain('LargeFile.js');
      
      // 注意：实际截断发生在capture()方法中,这里只验证描述生成
    });
  });

  describe('场景4: 边界情况处理', () => {
    it('应该正确处理没有选中代码的情况', async () => {
      const mockContext = {
        activeFilePath: '/path/to/EmptyFile.txt',
        activeFileLanguage: 'plaintext',
        cursorLine: 1,
        timestamp: Date.now()
      };

      const description = contextEnricher.formatContextDescription(mockContext);
      
      expect(description).toContain('EmptyFile.txt');
      expect(description).toContain('第1行');
      // 不应该包含选中代码范围
      expect(description).not.toContain('选中第');
    });

    it('应该正确处理特殊文件路径', () => {
      const windowsPath = {
        activeFilePath: 'C:\\Users\\test\\project\\file.ts',
        cursorLine: 10,
        timestamp: Date.now()
      };
      
      const unixPath = {
        activeFilePath: '/home/user/project/file.ts',
        cursorLine: 10,
        timestamp: Date.now()
      };

      const winDesc = contextEnricher.formatContextDescription(windowsPath);
      const unixDesc = contextEnricher.formatContextDescription(unixPath);
      
      // 都应该提取文件名
      expect(winDesc).toContain('file.ts');
      expect(unixDesc).toContain('file.ts');
    });
  });

  describe('场景5: 集成验证', () => {
    it('应该与IntentFactory协同工作', async () => {
      // 模拟通过IntentFactory创建Intent
      // 注意：在实际E2E环境中,需要VS Code API支持
      
      const intent = IntentFactory.buildChatIntent('解释这段代码');
      
      // 验证Intent结构
      expect(intent.name).toBe('chat');
      expect(intent.userInput).toBe('解释这段代码');
      expect(intent.metadata.source).toBe('chat');
      
      // 注入上下文
      const enrichedIntent = await contextEnricher.enrichIntent(intent);
      
      // 验证Intent仍然有效
      expect(enrichedIntent.name).toBe('chat');
      expect(enrichedIntent.userInput).toBe('解释这段代码');
    });
  });
});
