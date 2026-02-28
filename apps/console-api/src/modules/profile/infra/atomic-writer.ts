import { randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isErrnoError } from "./fs-utils.js";

export async function fsyncDirectory(directoryPath: string) {
  const directoryHandle = await fs.open(directoryPath, constants.O_RDONLY);

  try {
    await directoryHandle.sync();
  } finally {
    await directoryHandle.close();
  }
}

export async function atomicWriteText(filePath: string, content: string) {
  const parentDirectory = dirname(filePath);
  const tempPath = join(
    parentDirectory,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );

  await fs.mkdir(parentDirectory, { recursive: true });

  let tempHandle:
    | Awaited<ReturnType<typeof fs.open>>
    | undefined;

  try {
    tempHandle = await fs.open(
      tempPath,
      constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY,
      0o600
    );
    await tempHandle.writeFile(content, "utf8");
    await tempHandle.sync();
    await tempHandle.close();
    tempHandle = undefined;

    await fs.rename(tempPath, filePath);
    await fsyncDirectory(parentDirectory);
  } catch (error) {
    if (tempHandle) {
      await tempHandle.close();
    }

    try {
      await fs.rm(tempPath, { force: true });
    } catch (cleanupError) {
      if (
        !isErrnoError(cleanupError) ||
        cleanupError.code !== "ENOENT"
      ) {
        throw cleanupError;
      }
    }

    throw error;
  }
}
