import { describe, expect, test } from "bun:test";
import { parseTarget, parseTargets } from "../src/utils/target-parser";

describe("parseTarget", () => {
  test("should parse simple path format", () => {
    const result = parseTarget("#/$defs/User");
    expect(result).toEqual({
      path: "#/$defs/User",
      name: undefined,
    });
  });

  test("should parse root path", () => {
    const result = parseTarget("#");
    expect(result).toEqual({
      path: "#",
      name: undefined,
    });
  });

  test("should parse key-value format with path and name", () => {
    const result = parseTarget("path=#/$defs/User,name=Foo");
    expect(result).toEqual({
      path: "#/$defs/User",
      name: "Foo",
    });
  });

  test("should parse key-value format with path only", () => {
    const result = parseTarget("path=#/$defs/User");
    expect(result).toEqual({
      path: "#/$defs/User",
      name: undefined,
    });
  });

  test("should parse key-value format with root path and name", () => {
    const result = parseTarget("path=#,name=RootSchema");
    expect(result).toEqual({
      path: "#",
      name: "RootSchema",
    });
  });

  test("should handle whitespace in key-value format", () => {
    const result = parseTarget("path = #/$defs/User , name = Foo ");
    expect(result).toEqual({
      path: "#/$defs/User",
      name: "Foo",
    });
  });

  test("should throw error when path is missing in key-value format", () => {
    expect(() => parseTarget("name=Foo")).toThrow(
      'Invalid target format: "path" parameter is required',
    );
  });

  test("should throw error for invalid key-value pair", () => {
    expect(() => parseTarget("path=#/$defs/User,invalid")).toThrow(
      "Invalid target format",
    );
  });

  test("should throw error for empty key or value", () => {
    expect(() => parseTarget("path=,name=Foo")).toThrow(
      "Invalid target format",
    );
  });

  test("should throw error for unknown parameters", () => {
    expect(() => parseTarget("path=#/$defs/User,unknown=value")).toThrow(
      "Unknown target parameters: unknown",
    );
  });

  test("should handle path with equals sign in value", () => {
    // This tests that we use indexOf instead of split('=')
    const result = parseTarget("path=#/$defs/User=v2,name=Foo");
    expect(result).toEqual({
      path: "#/$defs/User=v2",
      name: "Foo",
    });
  });
});

describe("parseTargets", () => {
  test("should parse multiple simple paths", () => {
    const results = parseTargets(["#/$defs/User", "#/$defs/Post"]);
    expect(results).toEqual([
      { path: "#/$defs/User", name: undefined },
      { path: "#/$defs/Post", name: undefined },
    ]);
  });

  test("should parse mixed formats", () => {
    const results = parseTargets([
      "#/$defs/User",
      "path=#/$defs/Post,name=BlogPost",
    ]);
    expect(results).toEqual([
      { path: "#/$defs/User", name: undefined },
      { path: "#/$defs/Post", name: "BlogPost" },
    ]);
  });

  test("should parse all key-value formats", () => {
    const results = parseTargets([
      "path=#/$defs/User,name=AppUser",
      "path=#/$defs/Post,name=BlogPost",
    ]);
    expect(results).toEqual([
      { path: "#/$defs/User", name: "AppUser" },
      { path: "#/$defs/Post", name: "BlogPost" },
    ]);
  });

  test("should handle empty array", () => {
    const results = parseTargets([]);
    expect(results).toEqual([]);
  });

  test("should handle single target", () => {
    const results = parseTargets(["path=#/$defs/User,name=Foo"]);
    expect(results).toEqual([{ path: "#/$defs/User", name: "Foo" }]);
  });
});
