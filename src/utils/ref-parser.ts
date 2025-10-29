import type { JsonSchema } from "json-schema-library";

/**
 * Parse a JSON Schema $ref string into path segments
 * @param ref - A JSON Schema reference string (e.g., "#/$defs/User")
 * @returns Array of path segments
 * @throws Error if the reference format is invalid
 */
export function parseRef(ref: string): string[] {
  // Must start with #/
  if (!ref.startsWith("#/")) {
    throw new Error(`Invalid reference format: "${ref}". Must start with "#/"`);
  }

  // Remove the #/ prefix and split by /
  const path = ref.slice(2);

  if (!path) {
    throw new Error(`Invalid reference format: "${ref}". Path cannot be empty`);
  }

  return path.split("/");
}

/**
 * Get a schema at a specific path within a root schema
 * @param rootSchema - The root JSON Schema
 * @param ref - A JSON Schema reference string (e.g., "#/$defs/User")
 * @returns The schema at the specified path
 * @throws Error if the path does not exist
 */
export function getSchemaAtPath(
  rootSchema: JsonSchema,
  ref: string,
): JsonSchema {
  const segments = parseRef(ref);

  // Use unknown instead of any for better type safety
  let current: unknown = rootSchema;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      throw new Error(
        `Schema not found at path: "${ref}". Invalid path at segment "${segment}"`,
      );
    }

    if (typeof current !== "object") {
      throw new Error(
        `Schema not found at path: "${ref}". Cannot traverse through non-object at segment "${segment}"`,
      );
    }

    // Type guard: current is now known to be an object
    const currentObj = current as Record<string, unknown>;

    if (!(segment in currentObj)) {
      throw new Error(
        `Schema not found at path: "${ref}". Missing key "${segment}"`,
      );
    }

    current = currentObj[segment];
  }

  return current as JsonSchema;
}
