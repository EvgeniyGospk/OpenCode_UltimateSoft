import { homedir } from "node:os";
import { join } from "node:path";

export interface ErrnoLike {
  code?: unknown;
}

export function isErrnoError(error: unknown): error is ErrnoLike {
  return typeof error === "object" && error !== null && "code" in error;
}

/**
 * Expand a leading `~/` to the user's home directory.
 */
export function expandHomeDirectory(pathValue: string): string {
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }

  return pathValue;
}

/**
 * Run `fn()` and return its result. If it throws an ENOENT error, return
 * `fallback` instead. Any other error is re-thrown.
 */
export async function ignoreEnoent<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isErrnoError(error) && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}
