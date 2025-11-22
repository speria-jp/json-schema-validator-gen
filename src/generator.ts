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
import type { GenerateOptions, GenerateResult, Target } from "./types";
import { collectDependencies } from "./utils/dependency-collector";
import { getGeneratedHeader } from "./utils/header";
import {
  generateTypeNameFromPath,
  generateValidatorName,
} from "./utils/name-generator";
import { getSchemaAtPath } from "./utils/ref-parser";
import { parseTargets } from "./utils/target-parser";

export async function generate(
  options: GenerateOptions,
): Promise<GenerateResult[]> {
  // Default to root schema if no targets specified
  const targetStrings =
    options.targets && options.targets.length > 0 ? options.targets : ["#"];

  // Parse targets
  const targets = parseTargets(targetStrings);

  // Read and parse schema
  const schemaContent = await readFile(options.schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  // Generate types for all targets
  const results = generateForTargets(schema, options, targets);

  // Write output to file
  await writeOutput(results, options.outputPath);

  return results;
}

function generateForTargets(
  schema: JsonSchema,
  options: GenerateOptions,
  targets: Target[],
): GenerateResult[] {
  // 1. Collect all dependencies (order doesn't matter)
  const targetPaths = targets.map((t) => t.path);
  const allPaths = collectDependencies(schema, targetPaths);

  // 2. Build target name map (path → custom name)
  const targetNameMap = new Map<string, string>();
  for (const target of targets) {
    if (target.name) {
      targetNameMap.set(target.path, target.name);
    }
  }

  // 3. Check for type name collisions & build generatedTypes map
  const generatedTypes = new Map<string, string>(); // refPath → typeName
  const typeNameToPath = new Map<string, string>(); // typeName → refPath (for collision detection)

  for (const path of allPaths) {
    // Determine type name (priority: 1. target.name, 2. derived from path, 3. derived from schema path)
    let typeName: string;
    const customName = targetNameMap.get(path);
    if (customName !== undefined) {
      typeName = customName;
    } else if (path === "#") {
      typeName = deriveTypeName(options.schemaPath);
    } else {
      typeName = generateTypeNameFromPath(path);
    }

    // Check for type name collision
    const existingPath = typeNameToPath.get(typeName);
    if (existingPath !== undefined) {
      throw new Error(
        `Type name collision: "${typeName}" is used by both "${existingPath}" and "${path}". ` +
          `Please specify unique names using --target format "path:name".`,
      );
    }

    typeNameToPath.set(typeName, path);
    generatedTypes.set(path, typeName);
  }

  // 4. Generate code in any order
  const results: GenerateResult[] = [];

  for (const path of allPaths) {
    const typeName = generatedTypes.get(path);
    if (typeName === undefined) {
      throw new Error(`Internal error: Type name not found for path "${path}"`);
    }
    const validatorNameForType = generateValidatorName(typeName);

    // Only export types/validators specified in --target
    const isExported = targetPaths.includes(path);

    // Get schema at path
    const targetSchema = path === "#" ? schema : getSchemaAtPath(schema, path);

    // Compile the schema with root schema context for $ref resolution
    // Merge $defs and definitions from root schema so $ref can be resolved
    const schemaWithDefs: JsonSchema =
      path === "#"
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

    // Generate TypeScript type (don't expand $ref)
    const typeDefinition = generateTypeScript(
      schemaNode,
      typeName,
      generatedTypes,
      isExported,
    );

    // Generate validator (call validator functions for $ref)
    const validatorCode = generateValidator(
      schemaNode,
      validatorNameForType,
      typeName,
      generatedTypes,
      isExported,
    );

    results.push({
      typeName,
      validatorName: validatorNameForType,
      typeDefinition,
      validatorCode,
      isExported,
    });
  }

  return results;
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

function combineOutput(typeDefinition: string, validatorCode: string): string {
  // Add header only once at the top
  return `${getGeneratedHeader()}${typeDefinition}

${validatorCode}`;
}
