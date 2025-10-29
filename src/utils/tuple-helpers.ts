import type { JsonSchema, SchemaNode } from "json-schema-library";

/**
 * Information about tuple type detection in JSON Schema
 */
export interface TupleInfo {
  /** Whether this schema represents a tuple type */
  isTuple: boolean;
  /** Draft 2020-12+ tuple using prefixItems */
  isDraft2020Tuple: boolean;
  /** Draft 07 tuple using items as array */
  isDraft07Tuple: boolean;
  /** Parsed prefixItems (for Draft 2020-12+) */
  prefixItems?: SchemaNode[];
  /** Parsed item schemas (for Draft 07) */
  itemSchemas?: Array<Record<string, unknown>>;
  /** Whether this is a fixed-length tuple (no additional items allowed) */
  isFixedLength?: boolean;
}

/**
 * Analyzes a JSON Schema to determine if it represents a tuple type.
 *
 * Tuples can appear in two forms:
 * 1. Draft 2020-12+: Uses prefixItems property (json-schema-library may normalize to this)
 * 2. Draft 07: Uses items as an array of schemas (legacy tuple syntax)
 *
 * These are mutually exclusive - prefixItems takes precedence if both exist.
 *
 * @param node - The SchemaNode from json-schema-library
 * @param schema - The raw JSON Schema object
 * @returns TupleInfo object with detection results
 */
export function getTupleInfo(node: SchemaNode, schema: JsonSchema): TupleInfo {
  // Check for Draft 2020-12+ tuple with prefixItems
  const nodeWithPrefix = node as SchemaNode & {
    prefixItems?: SchemaNode[];
  };
  const prefixItems = nodeWithPrefix.prefixItems;

  if (prefixItems && Array.isArray(prefixItems)) {
    // For prefixItems, determine if it's fixed-length:
    // - If schema.items is an array: legacy representation (fixed-length)
    // - If schema.items is undefined: no additional items allowed (fixed-length)
    // - If schema.items is object/boolean: additional items allowed (variable-length)
    const isFixedLength = Array.isArray(schema.items) || !schema.items;

    return {
      isTuple: true,
      isDraft2020Tuple: true,
      isDraft07Tuple: false,
      prefixItems,
      isFixedLength,
    };
  }

  // Check for Draft 07 tuple with items as array
  if (schema.items && Array.isArray(schema.items)) {
    return {
      isTuple: true,
      isDraft2020Tuple: false,
      isDraft07Tuple: true,
      itemSchemas: schema.items as Array<Record<string, unknown>>,
      isFixedLength: true, // Draft 07 tuples are always fixed-length
    };
  }

  // Not a tuple
  return {
    isTuple: false,
    isDraft2020Tuple: false,
    isDraft07Tuple: false,
  };
}
