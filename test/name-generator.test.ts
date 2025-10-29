import { describe, expect, test } from "bun:test";
import {
  generateTypeNameFromPath,
  generateValidatorName,
} from "../src/utils/name-generator";

describe("generateTypeNameFromPath", () => {
  test("should generate type name from simple path", () => {
    expect(generateTypeNameFromPath("#/$defs/User")).toBe("User");
  });

  test("should convert kebab-case to PascalCase", () => {
    expect(generateTypeNameFromPath("#/$defs/blog-post")).toBe("BlogPost");
  });

  test("should convert snake_case to PascalCase", () => {
    expect(generateTypeNameFromPath("#/$defs/user_profile")).toBe(
      "UserProfile",
    );
  });

  test("should capitalize first letter", () => {
    expect(generateTypeNameFromPath("#/$defs/user")).toBe("User");
  });

  test("should handle definitions path", () => {
    expect(generateTypeNameFromPath("#/definitions/User")).toBe("User");
  });

  test("should handle nested paths", () => {
    expect(generateTypeNameFromPath("#/$defs/api/User")).toBe("User");
  });

  test("should handle mixed separators", () => {
    expect(generateTypeNameFromPath("#/$defs/user-profile_info")).toBe(
      "UserProfileInfo",
    );
  });

  test("should handle numbers in names", () => {
    expect(generateTypeNameFromPath("#/$defs/user2")).toBe("User2");
  });

  test("should handle consecutive hyphens", () => {
    expect(generateTypeNameFromPath("#/$defs/user--profile")).toBe(
      "UserProfile",
    );
  });

  test("should handle consecutive underscores", () => {
    expect(generateTypeNameFromPath("#/$defs/user__profile")).toBe(
      "UserProfile",
    );
  });

  test("should handle mixed consecutive separators", () => {
    expect(generateTypeNameFromPath("#/$defs/user--_profile")).toBe(
      "UserProfile",
    );
  });

  test("should throw error for empty type name segment", () => {
    expect(() => generateTypeNameFromPath("#/$defs/")).toThrow(
      "Cannot generate type name from empty path",
    );
  });
});

describe("generateValidatorName", () => {
  test("should generate validator name from type name", () => {
    expect(generateValidatorName("User")).toBe("validateUser");
    expect(generateValidatorName("BlogPost")).toBe("validateBlogPost");
  });

  test("should handle single letter type name", () => {
    expect(generateValidatorName("A")).toBe("validateA");
  });

  test("should handle type names with numbers", () => {
    expect(generateValidatorName("User2")).toBe("validateUser2");
  });

  test("should handle already lowercase first letter", () => {
    expect(generateValidatorName("user")).toBe("validateUser");
  });
});
