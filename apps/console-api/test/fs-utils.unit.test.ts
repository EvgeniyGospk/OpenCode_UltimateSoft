import { describe, expect, it } from "vitest";
import {
  expandHomeDirectory,
  ignoreEnoent,
  isErrnoError
} from "../src/modules/profile/infra/fs-utils.js";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// expandHomeDirectory
// ---------------------------------------------------------------------------
describe("expandHomeDirectory", () => {
  it("expands ~/path to home directory + path", () => {
    const result = expandHomeDirectory("~/documents/file.txt");
    const home = homedir();
    expect(result).toBe(`${home}/documents/file.txt`);
  });

  it("expands ~/ alone to home directory", () => {
    const result = expandHomeDirectory("~/");
    const home = homedir();
    expect(result).toBe(home);
  });

  it("returns absolute path unchanged", () => {
    expect(expandHomeDirectory("/etc/config")).toBe("/etc/config");
  });

  it("returns relative path unchanged", () => {
    expect(expandHomeDirectory("relative/path")).toBe("relative/path");
  });

  it("does not expand ~ without trailing slash", () => {
    expect(expandHomeDirectory("~noexpand")).toBe("~noexpand");
  });

  it("returns empty string unchanged", () => {
    expect(expandHomeDirectory("")).toBe("");
  });

  it("does not expand ~ in the middle of the path", () => {
    expect(expandHomeDirectory("/some/~/path")).toBe("/some/~/path");
  });

  it("handles ~/. path (join normalizes trailing dot)", () => {
    const result = expandHomeDirectory("~/.");
    const home = homedir();
    // node:path.join(home, ".") normalizes to just home
    expect(result).toBe(home);
  });
});

// ---------------------------------------------------------------------------
// ignoreEnoent
// ---------------------------------------------------------------------------
describe("ignoreEnoent", () => {
  it("returns result on success", async () => {
    const result = await ignoreEnoent(async () => "hello", "fallback");
    expect(result).toBe("hello");
  });

  it("returns complex result on success", async () => {
    const data = { key: "value", count: 42 };
    const fallback = { key: "", count: 0 };
    const result = await ignoreEnoent(async () => data, fallback);
    expect(result).toBe(data);
  });

  it("returns fallback on ENOENT error", async () => {
    const enoentError = Object.assign(new Error("not found"), {
      code: "ENOENT"
    });
    const result = await ignoreEnoent(async () => {
      throw enoentError;
    }, "default-value");
    expect(result).toBe("default-value");
  });

  it("returns fallback of different type on ENOENT", async () => {
    const enoentError = Object.assign(new Error("not found"), {
      code: "ENOENT"
    });
    const result = await ignoreEnoent(
      async () => {
        throw enoentError;
      },
      [] as string[]
    );
    expect(result).toEqual([]);
  });

  it("rethrows non-ENOENT errors with code property", async () => {
    const eaccesError = Object.assign(new Error("permission denied"), {
      code: "EACCES"
    });
    await expect(
      ignoreEnoent(async () => {
        throw eaccesError;
      }, "fallback")
    ).rejects.toThrow("permission denied");
  });

  it("rethrows errors without code property", async () => {
    const genericError = new Error("generic failure");
    await expect(
      ignoreEnoent(async () => {
        throw genericError;
      }, "fallback")
    ).rejects.toThrow("generic failure");
  });

  it("rethrows non-object errors (string throw)", async () => {
    await expect(
      ignoreEnoent(async () => {
        throw "raw string error";
      }, "fallback")
    ).rejects.toBe("raw string error");
  });

  it("rethrows null throw", async () => {
    await expect(
      ignoreEnoent(async () => {
        throw null;
      }, "fallback")
    ).rejects.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isErrnoError
// ---------------------------------------------------------------------------
describe("isErrnoError", () => {
  it("returns true for Error with code property", () => {
    const error = Object.assign(new Error("test"), { code: "ENOENT" });
    expect(isErrnoError(error)).toBe(true);
  });

  it("returns true for plain object with code property", () => {
    expect(isErrnoError({ code: "EACCES", message: "denied" })).toBe(true);
  });

  it("returns true for object with non-string code", () => {
    expect(isErrnoError({ code: 42 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isErrnoError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isErrnoError(undefined)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isErrnoError("error string")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isErrnoError(42)).toBe(false);
  });

  it("returns false for object without code property", () => {
    expect(isErrnoError({ message: "no code" })).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isErrnoError({})).toBe(false);
  });

  it("returns false for array", () => {
    expect(isErrnoError(["ENOENT"])).toBe(false);
  });

  it("returns true for Error subclass with code", () => {
    class CustomError extends Error {
      code = "CUSTOM";
    }
    expect(isErrnoError(new CustomError("test"))).toBe(true);
  });
});
