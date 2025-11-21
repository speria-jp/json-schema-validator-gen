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
      short: "t",
      multiple: true,
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
  -t, --target         JSON Schema target path (e.g., "#/$defs/User")
                       Can be specified multiple times for multiple types
                       Supports custom type names: "path=#/$defs/User,name=Foo"
                       Defaults to "#" (root schema)
  -h, --help           Show this help message

Examples:
  # Generate from root schema (default, type name derived from file name)
  json-schema-validator-gen -s schema.json -o validator.ts

  # Generate from single target (type name derived from target path)
  json-schema-validator-gen -s schema.json -o validator.ts -t '#/$defs/User'

  # Generate from single target with custom type name
  json-schema-validator-gen -s schema.json -o validator.ts \\
    -t 'path=#/$defs/User,name=CustomUser'

  # Generate from root with custom type name
  json-schema-validator-gen -s schema.json -o validator.ts \\
    -t 'path=#,name=MySchema'

  # Generate multiple types from targets
  json-schema-validator-gen -s schema.json -o types.ts \\
    -t '#/$defs/User' -t '#/$defs/Post'

  # Generate multiple types with custom names
  json-schema-validator-gen -s schema.json -o types.ts \\
    -t 'path=#/$defs/User,name=AppUser' \\
    -t 'path=#/$defs/Post,name=BlogPost'
`);
  process.exit(values.help ? 0 : 1);
}

async function main() {
  try {
    if (!values.schema || !values.output) {
      throw new Error("Both --schema and --output are required.");
    }

    const results = await generate({
      schemaPath: values.schema,
      outputPath: values.output,
      targets: values.target,
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
