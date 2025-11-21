import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import {
  compileSchema,
  draft04,
  draft06,
  draft07,
  draft2019,
  draft2020,
  type JsonSchema,
} from "json-schema-library";
import { generateTypeScript } from "./generators/typescript";
import { generateValidator } from "./generators/validator";
import type { GenerateOptions, GenerateResult } from "./types";
import { getGeneratedHeader } from "./utils/header";
import {
  generateTypeNameFromPath,
  generateValidatorName,
} from "./utils/name-generator";
import { getSchemaAtPath } from "./utils/ref-parser";

export async function generate(
  options: GenerateOptions,
): Promise<GenerateResult[]> {
  // Validation: cannot specify typeName with multiple refs
  if (options.refs && options.refs.length > 1) {
    if (options.typeName) {
      throw new Error("Cannot specify typeName with multiple refs");
    }
  }

  // Read and parse schema
  const schemaContent = await readFile(options.schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  // Generate types
  let results: GenerateResult[];
  if (options.refs && options.refs.length > 0) {
    results = generateMultiple(schema, options);
  } else {
    const result = generateSingle(schema, options);
    results = [result];
  }

  // Write output to file
  await writeOutput(results, options.outputPath, {
    exportType: options.exportType || "named",
  });

  return results;
}

function generateSingle(
  schema: JsonSchema,
  options: GenerateOptions,
): GenerateResult {
  const typeName = options.typeName || deriveTypeName(options.schemaPath);
  const validatorName = `validate${typeName}`;

  // Compile schema using json-schema-library
  const schemaNode = compileSchema(schema, {
    drafts: [draft04, draft06, draft07, draft2019, draft2020],
  });

  const typeDefinition = generateTypeScript(schemaNode, typeName, {
    namespace: options.namespace,
  });

  const validatorCode = generateValidator(schemaNode, validatorName, typeName, {
    exportType: options.exportType || "named",
  });

  return {
    validatorCode,
    typeDefinition,
    typeName,
    validatorName,
  };
}

function generateMultiple(
  schema: JsonSchema,
  options: GenerateOptions,
): GenerateResult[] {
  const refs = options.refs || [];
  const types: GenerateResult[] = [];
  const typeNames = new Set<string>();

  // Process each ref
  for (const ref of refs) {
    // Get schema at ref path
    const subSchema = getSchemaAtPath(schema, ref);

    // Generate type name from ref path
    const typeName =
      refs.length === 1 && options.typeName
        ? options.typeName
        : generateTypeNameFromPath(ref);
    const validatorNameForType = generateValidatorName(typeName);

    // Check for duplicate type names
    if (typeNames.has(typeName)) {
      throw new Error(
        `Duplicate type name "${typeName}" generated from refs. Please ensure ref paths result in unique type names.`,
      );
    }
    typeNames.add(typeName);

    // Compile the sub-schema with root schema context for $ref resolution
    // Merge $defs and definitions from root schema so $ref can be resolved
    // Sub-schema's definitions take precedence over root schema's definitions
    const schemaWithDefs: JsonSchema = {
      ...subSchema,
      $defs: {
        ...(schema.$defs || {}),
        ...(subSchema.$defs || {}),
      },
      definitions: {
        ...(schema.definitions || {}),
        ...(subSchema.definitions || {}),
      },
    };

    const schemaNode = compileSchema(schemaWithDefs, {
      drafts: [draft04, draft06, draft07, draft2019, draft2020],
    });

    // Generate TypeScript type
    const typeDefinition = generateTypeScript(schemaNode, typeName, {
      namespace: options.namespace,
    });

    // Generate validator
    const validatorCode = generateValidator(
      schemaNode,
      validatorNameForType,
      typeName,
      {
        exportType: options.exportType || "named",
      },
    );

    types.push({
      typeName,
      validatorName: validatorNameForType,
      typeDefinition,
      validatorCode,
    });
  }

  return types;
}

async function writeOutput(
  results: GenerateResult[],
  outputPath: string,
  options: { exportType: "named" | "default" },
): Promise<void> {
  // Combine all types and validators
  const allTypeDefinitions = results.map((t) => t.typeDefinition).join("\n\n");
  const allValidatorCode = results.map((t) => t.validatorCode).join("\n\n");

  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const finalCode = combineOutput(
    allTypeDefinitions,
    allValidatorCode,
    options,
  );

  await writeFile(outputPath, finalCode, "utf-8");
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
