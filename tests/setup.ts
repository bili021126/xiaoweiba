// Jest 全局设置
import 'reflect-metadata';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    })),
    workspaceFolders: [],
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  },
  commands: {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
  },
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3
  }
}));

// 全局超时设置
jest.setTimeout(30000);
