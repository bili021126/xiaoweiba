/**
 * 工具层统一接口定义
 */

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export interface FileReadOptions {
  encoding?: 'utf-8' | 'binary';
  maxBytes?: number;
}

export interface FileWriteOptions {
  createBackup?: boolean;
}

export interface GitDiffOptions {
  cached?: boolean;
  unstaged?: boolean;
}

export interface ShellExecuteOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface LLMCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface DatabaseQueryOptions {
  readonly?: boolean;
  timeout?: number;
}

// 工具接口
export interface IFileTool {
  readFile(path: string, options?: FileReadOptions): Promise<ToolResult<string>>;
  writeFile(path: string, content: string, options?: FileWriteOptions): Promise<ToolResult<void>>;
  fileExists(path: string): Promise<boolean>;
  listFiles(dir: string): Promise<ToolResult<string[]>>;
}

export interface IGitTool {
  getDiff(options?: GitDiffOptions): Promise<ToolResult<string>>;
  commit(message: string): Promise<ToolResult<void>>;
  getStatus(): Promise<ToolResult<string>>;
  getRemoteUrl(): Promise<ToolResult<string>>;
  createCheckpoint(description: string): Promise<ToolResult<string>>;
  restoreCheckpoint(checkpointId: string): Promise<ToolResult<void>>;
}

export interface IShellTool {
  execute(command: string, options?: ShellExecuteOptions): Promise<ToolResult<string>>;
}

export interface IDatabaseTool {
  query(sql: string, params?: any[], options?: DatabaseQueryOptions): Promise<ToolResult<any[]>>;
  execute(sql: string, params?: any[]): Promise<ToolResult<void>>;
  getExplain(sql: string): Promise<ToolResult<string>>;
}

export interface ILLMTool {
  call(options: LLMCallOptions): Promise<ToolResult<string>>;
  callStream(
    options: LLMCallOptions,
    onChunk: (chunk: string) => void
  ): Promise<ToolResult<string>>;
}
