/** Marks a type as either T or null (distinct from optional/undefined). */
export type Nullable<T> = T | null;

/** Marks a type as either T or undefined. */
export type Optional<T> = T | undefined;

/** Makes the given keys K of T optional, leaving the rest untouched. */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Makes the given keys K of T required, leaving the rest untouched. */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Recursively makes every property of T optional. */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** Recursively makes every property of T readonly. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** Standard shape for anything with created/updated timestamps (ISO 8601 strings). */
export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

/** Standard shape for anything identifiable by a string id. */
export interface Identifiable {
  id: string;
}

/** Ascending or descending sort direction, reused by every list endpoint. */
export type SortDirection = "asc" | "desc";

/** Generic sort parameter, parameterized by the sortable field names. */
export interface SortParam<TField extends string = string> {
  field: TField;
  direction: SortDirection;
}

/** Generic pagination request parameters. */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Generic pagination metadata returned alongside list results. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Generic paginated result envelope. */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Branding utility for creating nominal (non-structural) string types,
 * e.g. `type JobId = Brand<string, "JobId">`, so a raw string can't be
 * passed where a JobId is expected without an explicit cast.
 */
export type Brand<TBase, TBrand extends string> = TBase & {
  readonly __brand: TBrand;
};

export type JobId = Brand<string, "JobId">;
export type PrinterId = Brand<string, "PrinterId">;
export type AgentId = Brand<string, "AgentId">;
export type UserId = Brand<string, "UserId">;
export type FileId = Brand<string, "FileId">;

/** Discriminated-union helper: extracts the variant of TUnion whose `type` field equals TType. */
export type ExtractByType<TUnion extends { type: string }, TType extends TUnion["type"]> =
  Extract<TUnion, { type: TType }>;
