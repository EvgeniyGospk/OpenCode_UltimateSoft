import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = new URL("../", import.meta.url);
const outputPath = new URL("../src/generated/schema.ts", import.meta.url);

const tempDir = mkdtempSync(join(tmpdir(), "opencode-contract-check-"));
const tempOutput = join(tempDir, "schema.ts");

try {
  execSync(
    `npx openapi-typescript ../../contracts/openapi/v1.yaml --output ${tempOutput}`,
    {
      cwd: packageRoot,
      stdio: "inherit"
    }
  );

  const current = readFileSync(outputPath, "utf8");
  const next = readFileSync(tempOutput, "utf8");

  if (current !== next) {
    console.error(
      "OpenAPI contract drift detected. Run: npm --prefix packages/api-client-generated run generate"
    );
    process.exit(1);
  }

  console.log("OpenAPI contract check passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
