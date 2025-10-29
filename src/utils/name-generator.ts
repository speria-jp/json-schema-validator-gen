import { parseRef } from "./ref-parser";

/**
 * Generate a TypeScript type name from a JSON Schema reference path
 * @param ref - A JSON Schema reference string (e.g., "#/$defs/User")
 * @returns A PascalCase type name
 * @example
 * generateTypeNameFromPath("#/$defs/User") // "User"
 * generateTypeNameFromPath("#/$defs/blog-post") // "BlogPost"
 * generateTypeNameFromPath("#/$defs/user_profile") // "UserProfile"
 */
export function generateTypeNameFromPath(ref: string): string {
  const segments = parseRef(ref);

  // Get the last segment (the actual type name)
  const lastSegment = segments[segments.length - 1];

  if (!lastSegment) {
    throw new Error(`Cannot generate type name from empty path: "${ref}"`);
  }

  // Convert kebab-case, snake_case, or mixed to PascalCase
  return toPascalCase(lastSegment);
}

/**
 * Generate a validator function name from a type name
 * @param typeName - The TypeScript type name
 * @returns A camelCase validator function name with "validate" prefix
 * @example
 * generateValidatorName("User") // "validateUser"
 * generateValidatorName("BlogPost") // "validateBlogPost"
 */
export function generateValidatorName(typeName: string): string {
  // Ensure the first letter is uppercase
  const capitalizedTypeName =
    typeName.charAt(0).toUpperCase() + typeName.slice(1);
  return `validate${capitalizedTypeName}`;
}

/**
 * Convert a string to PascalCase
 * Handles kebab-case, snake_case, and mixed separators
 * @param str - The input string
 * @returns A PascalCase string
 * @example
 * toPascalCase("user-profile") // "UserProfile"
 * toPascalCase("user_profile") // "UserProfile"
 * toPascalCase("user-profile_info") // "UserProfileInfo"
 */
function toPascalCase(str: string): string {
  // Split by hyphens and underscores
  const parts = str.split(/[-_]/);

  return parts
    .map((part) => {
      if (!part) return "";
      // Capitalize first letter, lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}
