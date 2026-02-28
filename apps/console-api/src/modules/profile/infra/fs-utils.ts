export interface ErrnoLike {
  code?: unknown;
}

export function isErrnoError(error: unknown): error is ErrnoLike {
  return typeof error === "object" && error !== null && "code" in error;
}
