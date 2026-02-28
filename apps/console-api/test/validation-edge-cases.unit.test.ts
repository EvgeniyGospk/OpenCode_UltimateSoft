import { describe, expect, it } from "vitest";
import {
  requireJsonBody,
  requireStringField,
  parseUpdateBody
} from "../src/utils/validation.js";
import { ProfileServiceError } from "../src/modules/profile/domain/errors.js";

// ---------------------------------------------------------------------------
// requireJsonBody — edge cases
// ---------------------------------------------------------------------------
describe("requireJsonBody", () => {
  it("returns the object when given a valid JSON object", () => {
    const body = { name: "test" };
    expect(requireJsonBody(body)).toBe(body);
  });

  it("returns empty object when given {}", () => {
    const body = {};
    expect(requireJsonBody(body)).toBe(body);
  });

  it("throws INVALID_BODY for null", () => {
    expect(() => requireJsonBody(null)).toThrow(ProfileServiceError);
    try {
      requireJsonBody(null);
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
      expect((error as ProfileServiceError).statusCode).toBe(400);
    }
  });

  it("throws INVALID_BODY for undefined", () => {
    expect(() => requireJsonBody(undefined)).toThrow(ProfileServiceError);
    try {
      requireJsonBody(undefined);
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
    }
  });

  it("throws INVALID_BODY for a string", () => {
    expect(() => requireJsonBody("hello")).toThrow(ProfileServiceError);
    try {
      requireJsonBody("hello");
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
      expect((error as ProfileServiceError).message).toBe(
        "Request body must be a JSON object."
      );
    }
  });

  it("throws INVALID_BODY for a number", () => {
    expect(() => requireJsonBody(42)).toThrow(ProfileServiceError);
    try {
      requireJsonBody(42);
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
    }
  });

  it("throws INVALID_BODY for an array", () => {
    expect(() => requireJsonBody([1, 2, 3])).toThrow(ProfileServiceError);
    try {
      requireJsonBody([1, 2, 3]);
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
    }
  });

  it("throws INVALID_BODY for an empty array", () => {
    expect(() => requireJsonBody([])).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for boolean true", () => {
    expect(() => requireJsonBody(true)).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for boolean false", () => {
    expect(() => requireJsonBody(false)).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for zero", () => {
    expect(() => requireJsonBody(0)).toThrow(ProfileServiceError);
  });
});

// ---------------------------------------------------------------------------
// requireStringField — edge cases
// ---------------------------------------------------------------------------
describe("requireStringField", () => {
  it("returns the string when given a valid string", () => {
    expect(requireStringField("hello", "name")).toBe("hello");
  });

  it("returns an empty string (does not reject it — only checks type)", () => {
    // requireStringField checks typeof only, not emptiness
    expect(requireStringField("", "name")).toBe("");
  });

  it("returns a whitespace-only string (does not reject it)", () => {
    expect(requireStringField("   ", "name")).toBe("   ");
  });

  it("throws INVALID_BODY when field is missing (undefined)", () => {
    expect(() => requireStringField(undefined, "name")).toThrow(
      ProfileServiceError
    );
    try {
      requireStringField(undefined, "name");
    } catch (error) {
      expect((error as ProfileServiceError).code).toBe("INVALID_BODY");
      expect((error as ProfileServiceError).message).toBe(
        "Field 'name' must be a string."
      );
      expect((error as ProfileServiceError).statusCode).toBe(400);
    }
  });

  it("throws INVALID_BODY for null", () => {
    expect(() => requireStringField(null, "key")).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for a number", () => {
    expect(() => requireStringField(42, "field")).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for a boolean", () => {
    expect(() => requireStringField(true, "flag")).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for an object", () => {
    expect(() => requireStringField({}, "data")).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY for an array", () => {
    expect(() => requireStringField(["a"], "tags")).toThrow(
      ProfileServiceError
    );
  });

  it("includes the field name in the error message", () => {
    try {
      requireStringField(123, "myField");
    } catch (error) {
      expect((error as ProfileServiceError).message).toBe(
        "Field 'myField' must be a string."
      );
    }
  });
});

// ---------------------------------------------------------------------------
// parseUpdateBody — edge cases
// ---------------------------------------------------------------------------
describe("parseUpdateBody", () => {
  it("returns definition and raw when given a valid body", () => {
    const body = { definition: { model: "gpt-4" } };
    const result = parseUpdateBody(body);
    expect(result.definition).toEqual({ model: "gpt-4" });
    expect(result.raw).toBe(body);
  });

  it("throws INVALID_BODY when body is null", () => {
    expect(() => parseUpdateBody(null)).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY when body is a string", () => {
    expect(() => parseUpdateBody("string")).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY when body is a number", () => {
    expect(() => parseUpdateBody(42)).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY when body is an array", () => {
    expect(() => parseUpdateBody([1, 2])).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY when body is undefined", () => {
    expect(() => parseUpdateBody(undefined)).toThrow(ProfileServiceError);
  });

  it("throws INVALID_BODY when definition is missing", () => {
    expect(() => parseUpdateBody({ other: "value" })).toThrow(
      ProfileServiceError
    );
    try {
      parseUpdateBody({ other: "value" });
    } catch (error) {
      expect((error as ProfileServiceError).message).toBe(
        "Field 'definition' must be a JSON object."
      );
    }
  });

  it("throws INVALID_BODY when definition is a string (non-object)", () => {
    expect(() => parseUpdateBody({ definition: "not-object" })).toThrow(
      ProfileServiceError
    );
  });

  it("throws INVALID_BODY when definition is a number", () => {
    expect(() => parseUpdateBody({ definition: 123 })).toThrow(
      ProfileServiceError
    );
  });

  it("throws INVALID_BODY when definition is null", () => {
    expect(() => parseUpdateBody({ definition: null })).toThrow(
      ProfileServiceError
    );
  });

  it("throws INVALID_BODY when definition is an array", () => {
    expect(() => parseUpdateBody({ definition: ["a", "b"] })).toThrow(
      ProfileServiceError
    );
  });

  it("throws INVALID_BODY when definition is a boolean", () => {
    expect(() => parseUpdateBody({ definition: true })).toThrow(
      ProfileServiceError
    );
  });

  it("accepts a body with extra fields alongside definition", () => {
    const body = { definition: { model: "gpt-4" }, keyPool: "software" };
    const result = parseUpdateBody(body);
    expect(result.definition).toEqual({ model: "gpt-4" });
    expect(result.raw).toBe(body);
    expect((result.raw as Record<string, unknown>).keyPool).toBe("software");
  });

  it("accepts an empty definition object", () => {
    const body = { definition: {} };
    const result = parseUpdateBody(body);
    expect(result.definition).toEqual({});
  });

  it("preserves nested objects inside definition", () => {
    const body = {
      definition: {
        nested: { deep: { value: 42 } },
        arr: [1, 2]
      }
    };
    const result = parseUpdateBody(body);
    expect(result.definition).toEqual({
      nested: { deep: { value: 42 } },
      arr: [1, 2]
    });
  });
});
