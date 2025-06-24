import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const generatedDir = join(__dirname, "..", "examples", "generated");

describe("Snapshot tests", () => {
  // Generate validators before running tests
  execSync("bun run scripts/generate-examples.ts", {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });

  test("user-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "user-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });

  test("complex-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "complex-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });

  test("ref-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "ref-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });
});

describe("TypeScript type checking tests", () => {
  // Generate validators before running type check tests
  execSync("bun run scripts/generate-examples.ts", {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });

  test("generated code passes TypeScript type checking", () => {
    // Use the test-specific tsconfig for type checking
    const tsconfigPath = join(__dirname, "tsconfig.test.json");

    expect(() => {
      execSync(`bunx tsc --project ${tsconfigPath}`, {
        stdio: "pipe",
        cwd: join(__dirname, ".."),
        encoding: "utf-8",
      });
    }).not.toThrow();
  });
});
