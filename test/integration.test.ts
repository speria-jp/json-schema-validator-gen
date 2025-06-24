import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const generatedDir = join(__dirname, "..", "examples", "generated");

describe("Generated code snapshots", () => {
  // Generate validators using CLI before running tests
  const cliPath = join(__dirname, "..", "src", "cli.ts");
  const examplesDir = join(__dirname, "..", "examples");
  
  // Generate user-validator
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t User -v validateUser`, {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });
  
  // Generate complex-validator
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t Complex -v validateComplex`, {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });
  
  // Generate ref-validator
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t Ref -v validateRef`, {
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
  // Generate validators using CLI before running type check tests
  const cliPath = join(__dirname, "..", "src", "cli.ts");
  const examplesDir = join(__dirname, "..", "examples");
  
  // Generate all validators
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t User -v validateUser`, {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });
  
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t Complex -v validateComplex`, {
    stdio: "pipe",
    cwd: join(__dirname, ".."),
  });
  
  execSync(`bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t Ref -v validateRef`, {
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
