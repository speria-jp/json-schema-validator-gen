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
  // Default to root schema if no targets specified
  const targets =
    options.targets && options.targets.length > 0 ? options.targets : ["#"];

  // Validation: cannot specify typeName with multiple targets
  if (targets.length > 1 && options.typeName) {
    throw new Error("Cannot specify typeName with multiple targets");
  }

  // Read and parse schema
  const schemaContent = await readFile(options.schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  // Generate types for all targets
  const results = generateForTargets(schema, { ...options, targets });

  // Write output to file
  await writeOutput(results, options.outputPath);

  return results;
}

function generateForTargets(
  schema: JsonSchema,
  options: GenerateOptions & { targets: string[] },
): GenerateResult[] {
  const { targets } = options;
  const types: GenerateResult[] = [];
  const typeNames = new Set<string>();

  // Process each target
  for (const target of targets) {
    // Get schema at target path (root "#" or specific path like "#/$defs/User")
    const targetSchema =
      target === "#" ? schema : getSchemaAtPath(schema, target);

    // Generate type name
    const typeName =
      targets.length === 1 && options.typeName
        ? options.typeName
        : target === "#"
          ? deriveTypeName(options.schemaPath)
          : generateTypeNameFromPath(target);
    const validatorNameForType = generateValidatorName(typeName);

    // Check for duplicate type names
    if (typeNames.has(typeName)) {
      throw new Error(
        `Duplicate type name "${typeName}" generated from targets. Please ensure target paths result in unique type names.`,
      );
    }
    typeNames.add(typeName);

    // Compile the schema with root schema context for $ref resolution
    // Merge $defs and definitions from root schema so $ref can be resolved
    const schemaWithDefs: JsonSchema =
      target === "#"
        ? schema
        : {
            ...targetSchema,
            $defs: {
              ...(schema.$defs || {}),
              ...(targetSchema.$defs || {}),
            },
            definitions: {
              ...(schema.definitions || {}),
              ...(targetSchema.definitions || {}),
            },
          };

    const schemaNode = compileSchema(schemaWithDefs, {
      drafts: [draft04, draft06, draft07, draft2019, draft2020],
    });

    // Generate TypeScript type
    const typeDefinition = generateTypeScript(schemaNode, typeName);

    // Generate validator
    const validatorCode = generateValidator(
      schemaNode,
      validatorNameForType,
      typeName,
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
): Promise<void> {
  // Combine all types and validators
  const allTypeDefinitions = results.map((t) => t.typeDefinition).join("\n\n");
  const allValidatorCode = results.map((t) => t.validatorCode).join("\n\n");

  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const finalCode = combineOutput(allTypeDefinitions, allValidatorCode);

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
): string {
  // Add header only once at the top
  return `${getGeneratedHeader()}${typeDefinition}

${validatorCode}`;
}
