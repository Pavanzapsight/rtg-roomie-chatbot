declare module "sql.js/dist/sql-asm.js" {
  export interface SqlJsExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  export interface Statement {
    bind(values?: Record<string, unknown> | unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, string | number | null>;
    free(): void;
  }

  export interface Database {
    exec(sql: string): SqlJsExecResult[];
    prepare(sql: string): Statement;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | number[]) => Database;
  }

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
