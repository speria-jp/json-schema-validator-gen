import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import {
  compileSchema,
  draft04,
  draft06,
  draft07,
  draft2019,
  draft2020,
} from "json-schema-library";
import { generateTypeScript } from "./generators/typescript";
import { generateValidator } from "./generators/validator";
import type { GenerateOptions, GenerateResult } from "./types";
import { getGeneratedHeader } from "./utils/header";

export async function generate(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const schemaContent = await readFile(options.schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  const typeName = options.typeName || deriveTypeName(options.schemaPath);
  const validatorName = options.validatorName || `validate${typeName}`;

  // Compile schema using json-schema-library
  const schemaNode = compileSchema(schema, {
    drafts: [draft04, draft06, draft07, draft2019, draft2020],
  });

  const typeDefinition = generateTypeScript(schemaNode, typeName, {
    namespace: options.namespace,
  });

  const validatorCode = generateValidator(schemaNode, validatorName, typeName, {
    minify: options.minify,
    exportType: options.exportType || "named",
  });

  const outputDir = dirname(options.outputPath);
  await mkdir(outputDir, { recursive: true });

  const finalCode = combineOutput(typeDefinition, validatorCode, {
    exportType: options.exportType || "named",
  });

  await writeFile(options.outputPath, finalCode, "utf-8");

  return {
    validatorCode,
    typeDefinition,
    typeName,
    validatorName,
  };
}

function deriveTypeName(schemaPath: string): string {
  const filename = basename(schemaPath, ".json");
  return filename
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function combineOutput(
  typeDefinition: string,
  validatorCode: string,
  _options: { exportType: "named" | "default" },
): string {
  // Add header only once at the top
  return `${getGeneratedHeader()}${typeDefinition}

${validatorCode}`;
}
