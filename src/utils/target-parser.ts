import type { Target } from "../types";

/**
 * Parse target string into Target object
 *
 * Supports two formats:
 * 1. Simple path: "#/$defs/User"
 * 2. Key-value format: "path=#/$defs/User,name=Foo"
 *
 * @param target - Target string to parse
 * @returns Parsed Target object
 * @throws Error if path parameter is missing in key-value format
 */
export function parseTarget(target: string): Target {
  // Check if it's key=value format
  if (target.includes("=")) {
    const params = target.split(",").reduce(
      (acc, pair) => {
        const equalIndex = pair.indexOf("=");
        if (equalIndex === -1) {
          throw new Error(
            `Invalid target format: "${pair}". Expected "key=value" format.`,
          );
        }

        const key = pair.slice(0, equalIndex).trim();
        const value = pair.slice(equalIndex + 1).trim();

        if (!key || !value) {
          throw new Error(
            `Invalid target format: "${pair}". Key and value cannot be empty.`,
          );
        }

        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    if (!params.path) {
      throw new Error(
        `Invalid target format: "path" parameter is required. Got: "${target}"`,
      );
    }

    // Validate that only known parameters are used
    const knownParams = ["path", "name"];
    const unknownParams = Object.keys(params).filter(
      (key) => !knownParams.includes(key),
    );
    if (unknownParams.length > 0) {
      throw new Error(
        `Unknown target parameters: ${unknownParams.join(", ")}. Valid parameters are: ${knownParams.join(", ")}`,
      );
    }

    return {
      path: params.path,
      name: params.name,
    };
  }

  // Simple path format (backward compatible)
  return { path: target };
}

/**
 * Parse multiple target strings
 *
 * @param targets - Array of target strings
 * @returns Array of parsed Target objects
 */
export function parseTargets(targets: string[]): Target[] {
  return targets.map((target) => parseTarget(target));
}
