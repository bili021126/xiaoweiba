import { ProjectFingerprint } from '../../../src/utils/ProjectFingerprint';
import * as vscode from 'vscode';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockExec = require('child_process').exec as jest.MockedFunction<
  typeof import('child_process').exec
>;

describe('ProjectFingerprint', () => {
  let fingerprint: ProjectFingerprint;
  let mockWorkspaceFolders: vscode.WorkspaceFolder[] | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    fingerprint = new ProjectFingerprint();

    // Mock vscode.workspace.workspaceFolders
    mockWorkspaceFolders = [
      {
        uri: { fsPath: '/test/workspace' } as any,
        name: 'test',
        index: 0
      }
    ];
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      get: () => mockWorkspaceFolders,
      configurable: true
    });
  });

  afterEach(() => {
    fingerprint.clearCache();
  });

  describe('getCurrentProjectFingerprint', () => {
    it('should generate fingerprint with git remote url', async () => {
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        if (command.includes('get-url')) {
          callback(null, { stdout: 'git@github.com:user/repo.git\n', stderr: '' });
        } else {
          callback(null, { stdout: 'origin\n', stderr: '' });
        }
      }) as any);

      const result = await fingerprint.getCurrentProjectFingerprint();

      expect(result).toBeTruthy();
      expect(result!.length).toBe(64); // SHA256 hex length
    });

    it('should generate fingerprint without git', async () => {
      mockExec.mockImplementation(((_command: string, _options: any, callback: any) => {
        callback(new Error('Not a git repo'), { stdout: '', stderr: '' });
      }) as any);

      const result = await fingerprint.getCurrentProjectFingerprint();

      expect(result).toBeTruthy();
      expect(result!.length).toBe(64);
    });

    it('should return null when no workspace folders', async () => {
      mockWorkspaceFolders = undefined;

      const result = await fingerprint.getCurrentProjectFingerprint();

      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: 'git@github.com:user/repo.git\n', stderr: '' });
      }) as any);

      const first = await fingerprint.getCurrentProjectFingerprint();
      const second = await fingerprint.getCurrentProjectFingerprint();

      expect(first).toBe(second);
      expect(mockExec).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should clear cache correctly', async () => {
      mockExec.mockImplementation(((command: string, options: any, callback: any) => {
        if (typeof options === 'function') {
          callback = options;
        }
        callback(null, { stdout: 'git@github.com:user/repo.git\n', stderr: '' });
      }) as any);

      await fingerprint.getCurrentProjectFingerprint();
      fingerprint.clearCache();
      await fingerprint.getCurrentProjectFingerprint();

      expect(mockExec).toHaveBeenCalledTimes(2); // Called twice after cache clear
    });
  });

  describe('clearCache', () => {
    it('should clear all cached fingerprints', () => {
      fingerprint.clearCache();
      // No exception means success
    });
  });
});
