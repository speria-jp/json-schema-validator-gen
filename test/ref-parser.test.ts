import { describe, expect, test } from "bun:test";
import type { JsonSchema } from "json-schema-library";
import { getSchemaAtPath, parseRef } from "../src/utils/ref-parser";

describe("parseRef", () => {
  test("should parse $defs reference", () => {
    const result = parseRef("#/$defs/User");
    expect(result).toEqual(["$defs", "User"]);
  });

  test("should parse definitions reference", () => {
    const result = parseRef("#/definitions/User");
    expect(result).toEqual(["definitions", "User"]);
  });

  test("should parse nested path", () => {
    const result = parseRef("#/properties/user/properties/name");
    expect(result).toEqual(["properties", "user", "properties", "name"]);
  });

  test("should throw error for invalid format", () => {
    expect(() => parseRef("invalid")).toThrow();
    expect(() => parseRef("/$defs/User")).toThrow();
  });

  test("should throw error for empty path", () => {
    expect(() => parseRef("#/")).toThrow();
  });
});

describe("getSchemaAtPath", () => {
  test("should get schema at $defs path", () => {
    const schema: JsonSchema = {
      $defs: {
        User: { type: "object" },
      },
    };
    const result = getSchemaAtPath(schema, "#/$defs/User");
    expect(result).toEqual({ type: "object" });
  });

  test("should get schema at definitions path", () => {
    const schema: JsonSchema = {
      definitions: {
        User: { type: "object" },
      },
    };
    const result = getSchemaAtPath(schema, "#/definitions/User");
    expect(result).toEqual({ type: "object" });
  });

  test("should get schema at nested path", () => {
    const schema: JsonSchema = {
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    };
    const result = getSchemaAtPath(schema, "#/properties/user/properties/name");
    expect(result).toEqual({ type: "string" });
  });

  test("should throw error for non-existent path", () => {
    const schema: JsonSchema = { $defs: {} };
    expect(() => getSchemaAtPath(schema, "#/$defs/User")).toThrow(
      "Schema not found at path",
    );
  });

  test("should throw error for invalid intermediate path", () => {
    const schema: JsonSchema = {
      $defs: {
        User: { type: "object" },
      },
    };
    expect(() => getSchemaAtPath(schema, "#/$defs/User/nonexistent")).toThrow();
  });
});
