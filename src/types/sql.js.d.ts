declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any): this;
    exec(sql: string): QueryExecResult[];
    each(sql: string, params: any, callback: (row: any) => void, complete: () => void): this;
    each(sql: string, callback: (row: any) => void, complete: () => void): this;
    prepare(sql: string, params?: any): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: any[]) => any): this;
    create_aggregate(name: string, funcs: { step: (...args: any[]) => any; finalize: () => any }): this;
    loadExtension(file: string): this;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export class Statement {
    bind(params?: any): this;
    step(): boolean;
    get(): any;
    getAsObject(): any;
    getColumnNames(): string[];
    getNumberValue(index: number): number;
    getStringValue(index: number): string;
    reset(): this;
    free(): void;
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
