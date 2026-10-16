export interface SecurityHeader {
  key: string;
  value: string;
}

export declare const SECURITY_HEADERS: readonly SecurityHeader[];

export declare function withSecurityHeaders<T extends Record<string, unknown>>(
  config?: T,
): T & {
  headers(): Promise<Array<{ source: string; headers: SecurityHeader[] }>>;
};
