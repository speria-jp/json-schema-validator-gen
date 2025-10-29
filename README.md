# json-schema-validator-gen

A lightweight JSON Schema validator generator that creates minimal TypeScript code and type definitions.

## Features

- 🚀 **Zero runtime dependencies** - Generated validators are standalone
- 📦 **Minimal bundle size** - Optimized code generation for small output
- 🔍 **Type-safe** - Full TypeScript support with generated type definitions
- ⚡ **Fast validation** - No runtime schema parsing, direct code execution
- 🌐 **Universal** - Works in Node.js and browsers

## Installation

```bash
npm install -D @speria-jp/json-schema-validator-gen
# or
yarn add -D @speria-jp/json-schema-validator-gen
# or
pnpm add -D @speria-jp/json-schema-validator-gen
# or
bun add -D @speria-jp/json-schema-validator-gen
```

## Usage

### CLI

Using npx:

```bash
npx @speria-jp/json-schema-validator-gen -s schema.json -o validator.ts
```

Or if installed locally in your project:

```bash
# npm
npx json-schema-validator-gen -s schema.json -o validator.ts

# yarn
yarn json-schema-validator-gen -s schema.json -o validator.ts

# pnpm
pnpm json-schema-validator-gen -s schema.json -o validator.ts

# bun
bun json-schema-validator-gen -s schema.json -o validator.ts
```

Options:
- `-s, --schema` - Path to JSON Schema file (required)
- `-o, --output` - Output path for generated code (required)
- `-r, --ref` - JSON Schema reference path (e.g., `#/$defs/User`). Can be specified multiple times to generate multiple types
- `-t, --typeName` - TypeScript type name (default: derived from schema or ref). Cannot be used with multiple `--ref` options
- `-v, --validatorName` - Validator function name (default: validate{TypeName}). Cannot be used with multiple `--ref` options
- `-n, --namespace` - Namespace for generated types
- `-e, --exportType` - Export type: 'named' or 'default' (default: 'named')
- `-m, --minify` - Minify generated code (default: false)
- `-h, --help` - Show help message

### Programmatic API

```typescript
import { generate } from '@speria-jp/json-schema-validator-gen';

const result = await generate({
  schemaPath: './schema.json',
  outputPath: './validator.ts',
  typeName: 'User',
  validatorName: 'validateUser'
});
```

### Generating Multiple Types from Sub-schemas

You can generate multiple types from a single JSON Schema file using the `--ref` option:

```bash
# Generate User and Post types from $defs
npx json-schema-validator-gen -s schema.json -o types.ts \
  -r '#/$defs/User' -r '#/$defs/Post'
```

Given a JSON Schema with `$defs`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$defs": {
    "Address": {
      "type": "object",
      "properties": {
        "street": { "type": "string" },
        "city": { "type": "string" },
        "zipCode": { "type": "string" }
      },
      "required": ["street", "city"]
    },
    "User": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string" },
        "address": { "$ref": "#/$defs/Address" }
      },
      "required": ["id", "name", "email"]
    },
    "Post": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "authorId": { "type": "string" }
      },
      "required": ["id", "title", "authorId"]
    }
  }
}
```

The generator creates both types in a single file:

```typescript
export type User = {
    id: string;
    name: string;
    email: string;
    address?: {
        street: string;
        city: string;
        zipCode?: string;
    };
};

export type Post = {
    id: string;
    title: string;
    authorId: string;
};

export function validateUser(value: unknown): value is User { /* ... */ }
export function unsafeValidateUser(value: unknown): User { /* ... */ }

export function validatePost(value: unknown): value is Post { /* ... */ }
export function unsafeValidatePost(value: unknown): Post { /* ... */ }
```

### Example

Given a JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "User",
  "required": ["id", "name", "email"],
  "properties": {
    "id": {
      "type": "integer",
      "minimum": 1
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "email": {
      "type": "string",
      "format": "email",
      "pattern": "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$"
    },
    "age": {
      "type": "integer",
      "minimum": 0,
      "maximum": 150
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "role": {
      "type": "string",
      "enum": ["admin", "user", "guest"]
    }
  },
  "additionalProperties": false
}
```

The generator creates:

```typescript
export type User = {
    id: number;
    name: string;
    email: string;
    age?: number;
    tags?: string[];
    role?: "admin" | "user" | "guest";
};

export function validateUser(value: unknown): value is User {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    if (!("id" in value && "name" in value && "email" in value))
        return false;
    if (typeof value.id !== "number")
        return false;
    if (!Number.isInteger(value.id))
        return false;
    if (value.id < 1)
        return false;
    if (typeof value.name !== "string")
        return false;
    if (value.name.length < 1)
        return false;
    if (value.name.length > 100)
        return false;
    if (typeof value.email !== "string")
        return false;
    if (!/^[\w.-]+@[\w.-]+\.[a-z]{2,}$/.test(value.email))
        return false;
    // ... additional validations for optional properties
    return true;
}
```

## Supported JSON Schema Features

- **Basic types**: string, number, integer, boolean, null, array, object
- **Type constraints**: 
  - Numbers: minimum, maximum
  - Strings: minLength, maxLength, pattern, format
  - Arrays: items validation
  - Integers: proper integer validation
- **Object validation**: required properties, additionalProperties
- **Array validation**: items schema validation
- **Enums and const values**: Full enum support
- **Union types**: Full support for oneOf and anyOf with validation
- **References**: $ref support for local definitions (#/definitions/ and #/$defs/)
- **Optional properties**: Proper handling of required vs optional fields

## Security Considerations

For general security considerations when working with JSON Schema validation, please refer to the [Ajv Security Guidelines](https://github.com/ajv-validator/ajv/blob/master/docs/security.md). While this tool generates code at build time rather than runtime, many of the same principles apply regarding input validation and schema design.

## Development

```bash
# Install dependencies
bun install

# Run development CLI
bun run dev

# Build the project
bun run build

# Run tests
bun test

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix
```

## License

MIT