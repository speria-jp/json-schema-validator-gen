import type { JsonSchema } from "json-schema-library";
import { getSchemaAtPath } from "./ref-parser";

/**
 * Collect all definitions referenced by $ref in the schema
 *
 * @param rootSchema - Root schema
 * @param targetPaths - Target paths (e.g., ["#/$defs/User", "#/$defs/Post"])
 * @returns Set of all dependency paths (including targets themselves)
 *
 * @example
 * ```typescript
 * const schema = {
 *   $defs: {
 *     Address: { type: "object", properties: { street: { type: "string" } } },
 *     User: { type: "object", properties: { address: { $ref: "#/$defs/Address" } } }
 *   }
 * };
 * const deps = collectDependencies(schema, ["#/$defs/User"]);
 * // deps === Set(["#/$defs/User", "#/$defs/Address"])
 * ```
 */
export function collectDependencies(
  rootSchema: JsonSchema,
  targetPaths: string[],
): Set<string> {
  const allPaths = new Set<string>();
  const visited = new Set<string>();

  function collectRefs(path: string) {
    // Already visited (prevents circular references)
    if (visited.has(path)) {
      return;
    }
    visited.add(path);
    allPaths.add(path);

    try {
      // Handle root schema specially
      const targetSchema =
        path === "#" ? rootSchema : getSchemaAtPath(rootSchema, path);
      const refs = extractRefs(targetSchema);

      // Recursively collect dependencies
      for (const ref of refs) {
        collectRefs(ref);
      }
    } catch (error) {
      // Warn and skip if schema is not found
      console.warn(
        `Warning: Could not resolve schema at path "${path}":`,
        error,
      );
    }
  }

  // Recursively collect dependencies from each target path
  for (const targetPath of targetPaths) {
    collectRefs(targetPath);
  }

  return allPaths;
}

/**
 * Recursively extract $ref from schema
 *
 * @param schema - Schema to inspect
 * @returns Array of all found $ref paths
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: "object",
 *   properties: {
 *     user: { $ref: "#/$defs/User" },
 *     address: { $ref: "#/$defs/Address" }
 *   }
 * };
 * const refs = extractRefs(schema);
 * // refs === ["#/$defs/User", "#/$defs/Address"]
 * ```
 */
export function extractRefs(schema: JsonSchema): string[] {
  const refs: string[] = [];

  function traverse(obj: unknown) {
    // Skip if null or undefined
    if (obj === null || obj === undefined) {
      return;
    }

    // Skip if not an object (string, number, boolean, etc.)
    if (typeof obj !== "object") {
      return;
    }

    // If array, traverse each element
    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
      return;
    }

    // If object
    const record = obj as Record<string, unknown>;

    // Add to list if $ref exists
    if ("$ref" in record && typeof record.$ref === "string") {
      // Only support internal references (starting with #)
      if (record.$ref.startsWith("#/")) {
        refs.push(record.$ref);
      } else {
        // Warn about external references (not currently supported)
        console.warn(
          `Warning: External reference not supported: ${record.$ref}`,
        );
      }
    }

    // Recursively traverse each value in the object
    for (const value of Object.values(record)) {
      traverse(value);
    }
  }

  traverse(schema);
  return refs;
}
