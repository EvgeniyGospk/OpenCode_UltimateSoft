/**
 * Shared validation helpers for the HTTP layer.
 *
 * `isJsonObject` is the canonical type-guard defined in the domain layer —
 * we re-export it here so route files don't couple directly to domain paths.
 */
export { isJsonObject } from "../modules/profile/domain/profile-types.js";
export type { JsonObject } from "../modules/profile/domain/profile-types.js";

import { isJsonObject } from "../modules/profile/domain/profile-types.js";
import type { JsonObject } from "../modules/profile/domain/profile-types.js";
import { ProfileServiceError } from "../modules/profile/domain/errors.js";

/**
 * Validate that `body` is a JSON object containing a `definition` object.
 *
 * Returns the parsed definition (and an optional extra-fields bag for
 * route-specific extensions like `keyPool`).
 *
 * Used by both agent and provider update routes.
 */
export function parseUpdateBody(body: unknown): {
  definition: JsonObject;
  raw: JsonObject;
} {
  if (!isJsonObject(body) || !isJsonObject(body.definition)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Field 'definition' must be a JSON object.",
      400
    );
  }

  return {
    definition: body.definition as JsonObject,
    raw: body
  };
}

/**
 * Throw a `ProfileServiceError` if `body` is not a JSON object.
 * Returns the narrowed object for further field validation.
 */
export function requireJsonBody(body: unknown): JsonObject {
  if (!isJsonObject(body)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      "Request body must be a JSON object.",
      400
    );
  }
  return body;
}

/**
 * Throw a `ProfileServiceError` if `value` is present but not a JSON object.
 * Returns the value typed as `JsonObject | undefined`.
 */
export function requireOptionalJsonField(
  value: unknown,
  fieldName: string
): JsonObject | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value)) {
    throw new ProfileServiceError(
      "INVALID_BODY",
      `Field '${fieldName}' must be a JSON object.`,
      400
    );
  }
  return value;
}

/**
 * Throw a `ProfileServiceError` if `value` is present but not a string.
 * Returns the value typed as `string | undefined`.
 */
export function requireOptionalStringField(
  value: unknown,
  fieldName: string
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ProfileServiceError(
      "INVALID_BODY",
      `Field '${fieldName}' must be a string.`,
      400
    );
  }
  return value;
}

/**
 * Throw a `ProfileServiceError` if `value` is not a string.
 */
export function requireStringField(
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string") {
    throw new ProfileServiceError(
      "INVALID_BODY",
      `Field '${fieldName}' must be a string.`,
      400
    );
  }
  return value;
}
