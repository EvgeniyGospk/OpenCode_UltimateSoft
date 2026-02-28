import type { JsonObject } from "../modules/profile/domain/profile-types.js";

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
