export interface StringKV {
    [key: string]: string[];
}

export interface HeaderMap {
    [key: string]: string;
}

/**
 * The model and policies produced by casbin's "CasbinJsGetPermissionForUser",
 * or the same data after it has been parsed from JSON.
 */
export interface EnforcerData {
    m: string;
    p?: string[][];
    g?: string[][];
    [key: string]: unknown;
}

export type PermissionSource = string | Record<string, unknown>;
