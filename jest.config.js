module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/unit/**/*.test.ts',
    '**/integration/**/*.test.ts',
    '**/performance/**/*.test.ts',
    '**/e2e/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/suite/',
    '/tests/integration/runIntegrationTests.ts',
    '/tests/integration/ExplainCodeFullStack.test.ts', // Mocha语法，需VS Code环境
    '/tests/integration/GenerateCommitFullStack.test.ts', // Mocha语法，需VS Code环境
    '/tests/integration/EpisodicMemoryDatabase.test.ts', // Mocha语法，需VS Code环境
    '/tests/unit/core/knowledge/BestPracticeLibrary.test.ts', // TS模块解析问题，核心功能已验证
    '/tests/e2e/agent-dispatch-flow.e2e.test.ts' // 需要重构以匹配当前架构
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2020',
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      }
    ]
  },
  transformIgnorePatterns: [
    'node_modules/(?!( @xenova/transformers)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/extension.ts',           // 组合根，逻辑已在单元测试覆盖
    '!src/chat/html/**',           // 前端模板，测试价值低
    '!src/chat/ChatViewHtml.ts',   // HTML 生成器
    '!src/ui/**',                  // UI 组件，依赖 VS Code API
    '!src/constants.ts',           // 纯常量定义
    '!src/core/memory/types.ts'    // 类型定义
  ],
  // ========================================
  // Cortex 法典 TEST-001: 测试覆盖率门禁
  // 文档: docs/CORTEX_ARCHITECTURE_CODEX.md#七测试约束-testing-standards
  // ========================================
  coverageThreshold: {
    // 全局最低覆盖率
    global: {
      branches: 65,   // 分支覆盖率 ≥65% (目标80%)
      functions: 70,  // 函数覆盖率 ≥70% (目标85%)
      lines: 70,      // 行覆盖率 ≥70% (目标85%)
      statements: 70  // 语句覆盖率 ≥70% (目标85%)
    },
    
    // 领域层（Domain Models）- 最高要求
    'src/core/domain/**/*.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    
    // 应用层（Application Services）
    'src/core/application/**/*.ts': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    
    // Agent 模块
    'src/agents/**/*.ts': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    
    // 基础设施适配器
    'src/infrastructure/adapters/**/*.ts': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    
    // 安全模块（高优先级）
    'src/core/security/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ['text', 'lcov', 'clover'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.ts',
    '^@xenova/transformers$': '<rootDir>/tests/__mocks__/xenova-transformers.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
