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

function _addIssue(
  issues: ValidationIssue[],
  code: ValidationIssueCode,
  path: (string | number)[],
  expected: string,
  received: string,
): void {
  issues.push({
    code,
    path,
    message: \`Expected \${expected}, received \${received}\`,
    expected,
    received,
  });
}

function _getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
`;
}
