/**
 * Generate runtime type definitions and helper functions for generated validators.
 * These are included once at the top of the generated file.
 */
export function generateRuntimeCode(): string {
  return `// ============================================================================
// Validation Types (auto-generated)
// ============================================================================

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

interface ValidationIssue {
  code: ValidationIssueCode;
  path: (string | number)[];
  message: string;
  expected: string;
  received: string;
}

type ValidationIssueCode =
  | "invalid_type"
  | "invalid_value"
  | "too_small"
  | "too_big"
  | "invalid_string"
  | "not_integer"
  | "not_unique"
  | "unrecognized_key"
  | "missing_key";

interface ValidationOptions {
  abortEarly?: boolean;
}

// ============================================================================
// Validation Helpers (auto-generated)
// ============================================================================

function _getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function _invalidType(issues: ValidationIssue[], path: (string | number)[], expected: string, value: unknown): void {
  const received = _getType(value);
  issues.push({ code: "invalid_type", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _missingKey(issues: ValidationIssue[], path: (string | number)[], key: string): void {
  const expected = \`object with required property "\${key}"\`;
  const received = \`object without property "\${key}"\`;
  issues.push({ code: "missing_key", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _tooSmall(issues: ValidationIssue[], path: (string | number)[], expected: string, received: string): void {
  issues.push({ code: "too_small", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _tooBig(issues: ValidationIssue[], path: (string | number)[], expected: string, received: string): void {
  issues.push({ code: "too_big", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _invalidString(issues: ValidationIssue[], path: (string | number)[], expected: string, received: string): void {
  issues.push({ code: "invalid_string", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _invalidValue(issues: ValidationIssue[], path: (string | number)[], expected: string, received: string): void {
  issues.push({ code: "invalid_value", path, message: \`Expected \${expected}, received \${received}\`, expected, received });
}

function _notInteger(issues: ValidationIssue[], path: (string | number)[], value: number): void {
  issues.push({ code: "not_integer", path, message: \`Expected integer, received \${value}\`, expected: "integer", received: String(value) });
}

function _notUnique(issues: ValidationIssue[], path: (string | number)[]): void {
  issues.push({ code: "not_unique", path, message: "Expected array with unique items, received array with duplicate items", expected: "array with unique items", received: "array with duplicate items" });
}

function _unrecognizedKey(issues: ValidationIssue[], path: (string | number)[], expected: string, key: string): void {
  issues.push({ code: "unrecognized_key", path, message: \`Expected \${expected}, received \${key}\`, expected, received: key });
}
`;
}
