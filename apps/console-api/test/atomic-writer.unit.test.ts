import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteText } from "../src/modules/profile/infra/atomic-writer.js";

const createdPaths: string[] = [];

async function createTempDirectory() {
  const directoryPath = await fs.mkdtemp(join(tmpdir(), "console-api-atomic-"));
  createdPaths.push(directoryPath);
  return directoryPath;
}

afterEach(async () => {
  for (const path of createdPaths.splice(0)) {
    await fs.rm(path, { recursive: true, force: true });
  }
});

describe("atomicWriteText", () => {
  it("replaces file content atomically and leaves no temp file", async () => {
    const directoryPath = await createTempDirectory();
    const targetPath = join(directoryPath, "opencode.json");

    await atomicWriteText(targetPath, '{"a":1}\n');
    await atomicWriteText(targetPath, '{"a":2}\n');

    const written = await fs.readFile(targetPath, "utf8");
    expect(written).toBe('{"a":2}\n');

    const entries = await fs.readdir(directoryPath);
    expect(entries).toEqual(["opencode.json"]);
  });
});

