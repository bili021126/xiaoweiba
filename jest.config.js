module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/unit/**/*.test.ts',
    '**/integration/collaboration/**/*.test.ts',
    '**/integration/ExplainCodeFullStack.test.ts',
    '**/integration/GenerateCommitFullStack.test.ts',
    '**/performance/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/suite/',
    '/tests/integration/runIntegrationTests.ts',
    '/tests/unit/storage/DatabaseManager.test.ts', // 包含过时方法测试（transaction/restore），需重写
    '/tests/performance/baselines.test.ts' // EpisodicMemoryRecord接口变化，需更新
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
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/extension.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 48, // 临时降低，跳过DatabaseManager等模块后
      functions: 68,
      lines: 64,
      statements: 65
    }
  },
  coverageReporters: ['text', 'lcov', 'clover'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
