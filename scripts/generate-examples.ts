#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { generate } from "../src/generator";

const examplesDir = join(__dirname, "..", "examples");
const generatedDir = join(examplesDir, "generated");

async function generateExamples() {
  console.log("Generating validators for examples...\n");

  // Find all JSON schema files
  const files = await readdir(examplesDir);
  const schemaFiles = files.filter((f) => f.endsWith("-schema.json"));

  let successCount = 0;
  let errorCount = 0;

  for (const schemaFile of schemaFiles) {
    const schemaPath = join(examplesDir, schemaFile);
    const baseName = basename(schemaFile, "-schema.json");
    const outputPath = join(generatedDir, `${baseName}-validator.ts`);
    const typeName = baseName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

    try {
      console.log(`Generating ${baseName}...`);
      await generate({
        schemaPath,
        outputPath,
        typeName,
        validatorName: `validate${typeName}`,
      });
      console.log(`  ✓ Generated ${baseName}-validator.ts`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed to generate ${baseName}:`, error);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} success, ${errorCount} errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

generateExamples().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
