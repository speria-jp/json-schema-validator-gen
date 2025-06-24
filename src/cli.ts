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
    typeName: {
      type: "string",
      short: "t",
    },
    validatorName: {
      type: "string",
      short: "v",
    },
    namespace: {
      type: "string",
      short: "n",
    },
    exportType: {
      type: "string",
      short: "e",
    },
    minify: {
      type: "boolean",
      short: "m",
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
  -t, --typeName       TypeScript type name (default: derived from schema)
  -v, --validatorName  Validator function name (default: validate{TypeName})
  -n, --namespace      Namespace for generated types
  -e, --exportType     Export type: 'named' or 'default' (default: 'named')
  -m, --minify         Minify generated code (default: false)
  -h, --help           Show this help message

Example:
  json-schema-validator-gen -s schema.json -o validator.ts -t User
`);
  process.exit(values.help ? 0 : 1);
}

async function main() {
  try {
    if (!values.schema || !values.output) {
      throw new Error("Both --schema and --output are required.");
    }
    const result = await generate({
      schemaPath: values.schema,
      outputPath: values.output,
      typeName: values.typeName,
      validatorName: values.validatorName,
      namespace: values.namespace,
      exportType: values.exportType as "named" | "default" | undefined,
      minify: values.minify,
    });

    console.log(`✓ Generated validator for ${result.typeName}`);
    console.log(`  - Type: ${result.typeName}`);
    console.log(`  - Validator: ${result.validatorName}`);
    console.log(`  - Output: ${values.output}`);
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

main();
