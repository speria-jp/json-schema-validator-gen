/** Parsed target information */
export interface Target {
  /** JSON Schema path (e.g., "#/$defs/User") */
  path: string;
  /** Optional custom type name */
  name?: string;
}

export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  /** JSON Schema target paths to generate (e.g., ["#/$defs/User", "#/$defs/Post"]). Defaults to ["#"] (root) */
  targets?: string[];
}

export interface GenerateResult {
  typeName: string;
  validatorName: string;
  typeDefinition: string;
  validatorCode: string;
  /** Whether this type/validator should be exported (true if specified in --target) */
  isExported: boolean;
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

/**
 * Individual validation error
 */
export interface ValidationIssue {
  /** Error code */
  code: ValidationIssueCode;

  /** Error location (empty array for root) */
  path: (string | number)[];

  /** Human-readable error message */
  message: string;

  /** Expected type/value */
  expected: string;

  /** Actual type/value */
  received: string;
}

/**
 * Error code types
 */
export type ValidationIssueCode =
  | "invalid_type" // Type mismatch
  | "invalid_value" // Value mismatch (enum, const)
  | "too_small" // Below minimum value/length
  | "too_big" // Exceeds maximum value/length
  | "invalid_string" // Invalid string format (pattern)
  | "not_integer" // Not an integer
  | "not_unique" // Array elements are not unique (uniqueItems)
  | "unrecognized_key" // Unknown property
  | "missing_key"; // Required property missing

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Abort on first error (default: false) */
  abortEarly?: boolean;
}
