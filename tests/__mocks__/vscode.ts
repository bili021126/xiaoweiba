// VS Code API Mock for Jest
module.exports = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    createWebviewPanel: jest.fn()
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
    },
    openTextDocument: jest.fn(),
    showTextDocument: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
    executeCommand: jest.fn()
  },
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, toString: () => path }))
  },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn(),
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
  }
};
