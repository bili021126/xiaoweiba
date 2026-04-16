// VS Code API Mock for Jest
module.exports = {
  window: {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    })),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    createWebviewPanel: jest.fn(),
    withProgress: jest.fn(async (options: any, task: any) => {
      const progress = { report: jest.fn() };
      const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
      return await task(progress, token);
    })
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
    executeCommand: jest.fn(),
    getCommands: jest.fn().mockResolvedValue([
      'xiaoweiba.explainCode',
      'xiaoweiba.generateCommit',
      'xiaoweiba.checkNaming',
      'xiaoweiba.optimizeSQL',
      'xiaoweiba.repair-memory',
      'xiaoweiba.export-memory',
      'xiaoweiba.import-memory'
    ])
  },
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      isActive: true,
      activate: jest.fn().mockResolvedValue({}),
      exports: {}
    })
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
