# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run tests
bun test

# Run a specific test file
bun test test/generator.test.ts

# Run integration tests (included in bun test)
# Integration tests include snapshot testing, TypeScript compilation, and runtime validation

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Development mode (run CLI locally)
bun run dev
```

## Project Architecture

This is a JSON Schema validator generator that creates TypeScript type definitions and runtime validators from JSON Schema files. The architecture follows a clear separation of concerns:

### Core Components

1. **Entry Points**
   - `src/cli.ts`: Command-line interface for the tool
   - `src/index.ts`: Programmatic API exports

2. **Main Generator** (`src/generator.ts`)
   - Orchestrates the generation process
   - Uses `json-schema-library` to compile and parse schemas
   - Handles file I/O operations
   - Combines type definitions and validator code

3. **Code Generators** (`src/generators/`)
   - `typescript.ts`: Generates TypeScript type definitions using the TypeScript Compiler API
   - `validator.ts`: Generates runtime validation functions

### Key Design Decisions

- **Zero Runtime Dependencies**: Generated validators are standalone
- **TypeScript Compiler API**: Uses `ts.factory` for AST-based code generation instead of string templates
- **Schema Compilation**: Leverages `json-schema-library` for schema parsing and validation
- **ValidationResult API**: Validators return `ValidationResult<T>` with detailed error information (code, path, expected, received)
- **Type Narrowing over Type Casting**: Generated code uses TypeScript's `in` operator for type narrowing instead of `as` casts (see Validator Code Generation Guidelines below)

### Testing Strategy

- **Unit Tests** (`test/generator.test.ts`): Test core functionality
- **Integration Tests** (`test/integration.test.ts`): 
  - Snapshot testing for generated code consistency
  - TypeScript compilation checks
  - Runtime validation tests with valid/invalid inputs
- Uses Bun's built-in test runner

### Supported JSON Schema Features

The generator supports most common JSON Schema features including:
- Basic types (string, number, integer, boolean, null, array, object)
- Type constraints (minimum/maximum, minLength/maxLength, pattern)
- Object validation (required properties, additionalProperties)
- Array validation (items schema)
- Enums and const values
- Union types (oneOf, anyOf, limited support)
- References ($ref, limited support)

## Commit Guidelines

When creating commits in this repository:

1. **Use Conventional Commits format**
   - Format: `<type>(<scope>): <subject>`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
   - Example: `feat: add support for anyOf schema validation`
   - Example: `fix: handle null values in object properties`

2. **Write commit messages in English**
   - Use present tense ("add feature" not "added feature")
   - Keep the subject line under 50 characters
   - Use the imperative mood ("fix bug" not "fixes bug")

## Validator Code Generation Guidelines

When modifying `src/generators/validator.ts`, follow these principles:

### Type Safety: Use Type Narrowing, Not Type Casting

Generated validator code must use TypeScript's type narrowing instead of `as` casts.

```typescript
// ❌ BAD: Type casting bypasses type checking
const obj = value as Record<string, unknown>;
if (typeof obj.id !== "number") { ... }

// ✅ GOOD: Type narrowing with 'in' operator
if (typeof value !== "object" || value === null || Array.isArray(value)) {
    // handle invalid type
}
if ("id" in value) {
    // value is narrowed to { id: unknown }
    if (typeof value.id !== "number") {
        // handle invalid type
    }
}
```

**Why avoid `as` casts?**
- Casts bypass TypeScript's type checking and can hide bugs
- Type narrowing provides compile-time safety
