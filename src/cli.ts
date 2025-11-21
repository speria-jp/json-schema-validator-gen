#!/usr/bin/env node

import { parseArgs } from "node:util";
import { generate } from "./generator";

const { values } = parseArgs({
  args: process.argv,
  options: {
    schema: {
      type: "string",
      short: "s",
    },
    output: {
      type: "string",
      short: "o",
    },
    target: {
      type: "string",
      short: "T",
      multiple: true,
    },
    typeName: {
      type: "string",
      short: "t",
    },
    namespace: {
      type: "string",
      short: "n",
    },
    exportType: {
      type: "string",
      short: "e",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (values.help || !values.schema || !values.output) {
  console.log(`
Usage: json-schema-validator-gen -s <schema-path> -o <output-path> [options]

Options:
  -s, --schema         Path to JSON Schema file (required)
  -o, --output         Output path for generated code (required)
  -T, --target         JSON Schema target path (e.g., "#/$defs/User")
                       Can be specified multiple times for multiple types
                       Defaults to "#" (root schema)
  -t, --typeName       TypeScript type name (default: derived from schema or target)
                       Cannot be used with multiple --target options
  -n, --namespace      Namespace for generated types
  -e, --exportType     Export type: 'named' or 'default' (default: 'named')
  -h, --help           Show this help message

Examples:
  # Generate from root schema (default)
  json-schema-validator-gen -s schema.json -o validator.ts -t User

  # Generate from single target
  json-schema-validator-gen -s schema.json -o validator.ts -T '#/$defs/User'

  # Generate multiple types from targets
  json-schema-validator-gen -s schema.json -o types.ts \\
    -T '#/$defs/User' -T '#/$defs/Post'
`);
  process.exit(values.help ? 0 : 1);
}

async function main() {
  try {
    if (!values.schema || !values.output) {
      throw new Error("Both --schema and --output are required.");
    }

    // Validation: cannot use typeName with multiple targets
    const targets = values.target;
    if (targets && targets.length > 1) {
      if (values.typeName) {
        console.error(
          "Error: Cannot specify --typeName with multiple --target options",
        );
        process.exit(1);
      }
    }

    const results = await generate({
      schemaPath: values.schema,
      outputPath: values.output,
      targets: targets,
      typeName: values.typeName,
      namespace: values.namespace,
      exportType: values.exportType as "named" | "default" | undefined,
    });

    // Display results
    if (results.length > 1) {
      console.log(`✓ Generated ${results.length} types`);
      for (const result of results) {
        console.log(`  - ${result.typeName} (${result.validatorName})`);
      }
      console.log(`  - Output: ${values.output}`);
    } else if (results.length === 1) {
      const [result] = results;
      if (result) {
        console.log(`✓ Generated validator for ${result.typeName}`);
        console.log(`  - Type: ${result.typeName}`);
        console.log(`  - Validator: ${result.validatorName}`);
        console.log(`  - Output: ${values.output}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

main();
