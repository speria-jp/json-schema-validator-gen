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
    ref: {
      type: "string",
      short: "r",
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
  -r, --ref            JSON Schema reference path (e.g., "#/$defs/User")
                       Can be specified multiple times for multiple types
  -t, --typeName       TypeScript type name (default: derived from schema or ref)
                       Cannot be used with multiple --ref options
  -n, --namespace      Namespace for generated types
  -e, --exportType     Export type: 'named' or 'default' (default: 'named')
  -h, --help           Show this help message

Examples:
  # Generate from root schema
  json-schema-validator-gen -s schema.json -o validator.ts -t User

  # Generate from single ref
  json-schema-validator-gen -s schema.json -o validator.ts -r '#/$defs/User'

  # Generate multiple types from refs
  json-schema-validator-gen -s schema.json -o types.ts \\
    -r '#/$defs/User' -r '#/$defs/Post'
`);
  process.exit(values.help ? 0 : 1);
}

async function main() {
  try {
    if (!values.schema || !values.output) {
      throw new Error("Both --schema and --output are required.");
    }

    // Validation: cannot use typeName with multiple refs
    const refs = values.ref;
    if (refs && refs.length > 1) {
      if (values.typeName) {
        console.error(
          "Error: Cannot specify --typeName with multiple --ref options",
        );
        process.exit(1);
      }
    }

    const results = await generate({
      schemaPath: values.schema,
      outputPath: values.output,
      refs: refs,
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
