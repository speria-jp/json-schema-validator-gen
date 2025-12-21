import type { ValidationIssue, ValidationIssueCode } from "../types";

/**
 * Add an issue to the issues array
 * This function is inlined in generated code to reduce code size
 */
export function addIssue(
  issues: ValidationIssue[],
  code: ValidationIssueCode,
  path: (string | number)[],
  expected: string,
  received: string,
): void {
  issues.push({
    code,
    path,
    message: `Expected ${expected}, received ${received}`,
    expected,
    received,
  });
}

/**
 * Convert path to a dot-separated string
 * @example
 * issuePath({ path: ["users", 0, "name"] }) // "users[0].name"
 * issuePath({ path: [] }) // ""
 */
export function issuePath(issue: Pick<ValidationIssue, "path">): string {
  if (issue.path.length === 0) return "";

  return issue.path.reduce<string>((acc, part, index) => {
    if (typeof part === "number") {
      return `${acc}[${part}]`;
    }
    return index === 0 ? part : `${acc}.${part}`;
  }, "");
}

/**
 * Flatten issues into a form-friendly object
 */
export function flattenIssues(issues: ValidationIssue[]): {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
} {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    if (issue.path.length === 0) {
      formErrors.push(issue.message);
    } else {
      const path = issuePath(issue);
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
  }

  return { formErrors, fieldErrors };
}

/**
 * Format issues as a human-readable string
 */
export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return "No validation errors";

  return issues
    .map((issue) => {
      const path = issuePath(issue);
      const location = path ? `[${path}] ` : "";
      return `${location}${issue.message}`;
    })
    .join("\n");
}

/**
 * Get the type of a value as a string
 */
export function getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
