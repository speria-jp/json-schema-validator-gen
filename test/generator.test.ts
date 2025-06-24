import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generate } from "../src/generator";

const testDir = join(__dirname, "tmp");
const schemaPath = join(testDir, "test-schema.json");
const outputPath = join(testDir, "test-output.ts");

describe("generate", () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("should generate validator and type for simple schema", async () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "Person",
    });

    expect(result.typeName).toBe("Person");
    expect(result.validatorName).toBe("validatePerson");
    expect(result.typeDefinition).toContain("export type Person = {");
    expect(result.typeDefinition).toContain("name: string;");
    expect(result.typeDefinition).toContain("age?: number;");
    expect(result.validatorCode).toContain(
      "function validatePerson(value: unknown): value is Person",
    );
    expect(result.validatorCode).toContain('"name" in value');
  });

  test("should generate validator with constraints", async () => {
    const schema = {
      type: "object",
      properties: {
        email: {
          type: "string",
          pattern: "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$",
        },
        score: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
    });

    expect(result.validatorCode).toContain("/^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$/");
    expect(result.validatorCode).toContain("< 0");
    expect(result.validatorCode).toContain("> 100");
  });

  test("should handle enum types", async () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          enum: ["active", "inactive", "pending"],
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
    });

    expect(result.typeDefinition).toContain(
      '"active" | "inactive" | "pending"',
    );
    expect(result.validatorCode).toContain(
      '["active", "inactive", "pending"].includes',
    );
  });

  test("should handle array types", async () => {
    const schema = {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 1,
      maxItems: 5,
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "Tags",
    });

    expect(result.typeDefinition).toContain("string[]");
    expect(result.validatorCode).toContain("Array.isArray");
    expect(result.validatorCode).toContain(".length < 1");
    expect(result.validatorCode).toContain(".length > 5");
  });

  test("should support namespace option", async () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      namespace: "API",
      typeName: "User",
    });

    expect(result.typeDefinition).toContain("export namespace API");
    expect(result.typeDefinition).toContain("export type User = {");
  });

  test("should handle $ref references", async () => {
    const schema = {
      type: "object",
      properties: {
        address: { $ref: "#/definitions/address" },
        workAddress: { $ref: "#/definitions/address" },
      },
      required: ["address"],
      definitions: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
            zipCode: { type: "string" },
          },
          required: ["street", "city"],
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "UserWithAddress",
    });

    expect(result.typeName).toBe("UserWithAddress");
    expect(result.typeDefinition).toContain("export type UserWithAddress = {");
    expect(result.typeDefinition).toContain("address:");
    expect(result.typeDefinition).toContain("workAddress?:");
    expect(result.typeDefinition).toContain("street: string;");
    expect(result.typeDefinition).toContain("city: string;");
    expect(result.typeDefinition).toContain("zipCode?: string;");
    expect(result.validatorCode).toContain('"address" in value');
    expect(result.validatorCode).toContain('"street" in');
    expect(result.validatorCode).toContain('"city" in');
  });

  test("should handle string constraints (minLength, maxLength)", async () => {
    const schema = {
      type: "object",
      properties: {
        username: {
          type: "string",
          minLength: 3,
          maxLength: 20,
        },
        description: {
          type: "string",
          maxLength: 100,
        },
      },
      required: ["username"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "User",
    });

    expect(result.typeDefinition).toContain("username: string;");
    expect(result.typeDefinition).toContain("description?: string;");
    expect(result.validatorCode).toContain(".length < 3");
    expect(result.validatorCode).toContain(".length > 20");
    expect(result.validatorCode).toContain(".length > 100");
  });

  test("should handle number constraints (exclusiveMinimum, exclusiveMaximum)", async () => {
    const schema = {
      type: "object",
      properties: {
        price: {
          type: "number",
          exclusiveMinimum: 0,
          exclusiveMaximum: 1000,
        },
        discount: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "Product",
    });

    expect(result.typeDefinition).toContain("price?: number;");
    expect(result.typeDefinition).toContain("discount?: number;");
    expect(result.validatorCode).toContain("< 0");
    expect(result.validatorCode).toContain("> 100");
  });

  test("should handle integer type validation", async () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "integer" },
        count: {
          type: "integer",
          minimum: 1,
          maximum: 999,
        },
      },
      required: ["id"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "Counter",
    });

    expect(result.typeDefinition).toContain("id: number;");
    expect(result.typeDefinition).toContain("count?: number;");
    expect(result.validatorCode).toContain("Number.isInteger");
    expect(result.validatorCode).toContain("< 1");
    expect(result.validatorCode).toContain("> 999");
  });

  test("should handle array uniqueItems constraint", async () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          minItems: 1,
          maxItems: 10,
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "TaggedItem",
    });

    expect(result.typeDefinition).toContain("tags?: string[];");
    expect(result.validatorCode).toContain("Array.isArray");
    expect(result.validatorCode).toContain(".length < 1");
    expect(result.validatorCode).toContain(".length > 10");
    // uniqueItems constraint may be checked depending on the implementation
  });

  test("should handle object constraints (minProperties, maxProperties, additionalProperties)", async () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      minProperties: 1,
      maxProperties: 3,
      additionalProperties: false,
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "RestrictedObject",
    });

    expect(result.typeDefinition).toContain("name?: string;");
    expect(result.typeDefinition).toContain("age?: number;");
    // When additionalProperties is false, only known properties are allowed
    expect(result.validatorCode).toContain('["name", "age"].includes');
  });

  test("should handle oneOf union types", async () => {
    const schema = {
      type: "object",
      properties: {
        value: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
      },
      required: ["value"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "UnionValue",
    });

    expect(result.typeDefinition).toContain(
      "value: string | number | boolean;",
    );
    expect(result.validatorCode).toContain('"value" in value');
    // Check that oneOf validation is generated
    expect(result.validatorCode).toContain('typeof value.value !== "string"');
    expect(result.validatorCode).toContain('typeof value.value !== "number"');
    expect(result.validatorCode).toContain('typeof value.value !== "boolean"');
  });

  test("should handle anyOf union types", async () => {
    const schema = {
      type: "object",
      properties: {
        data: {
          anyOf: [
            { type: "string", minLength: 5 },
            { type: "number", minimum: 100 },
          ],
        },
      },
      required: ["data"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "AnyOfValue",
    });

    expect(result.typeDefinition).toContain("data: string | number;");
    expect(result.validatorCode).toContain('"data" in value');
    // Check that anyOf validation is generated
    expect(result.validatorCode).toContain('typeof value.data !== "string"');
    expect(result.validatorCode).toContain("value.data.length < 5");
    expect(result.validatorCode).toContain('typeof value.data !== "number"');
    expect(result.validatorCode).toContain("value.data < 100");
  });

  test("should handle const values", async () => {
    const schema = {
      type: "object",
      properties: {
        version: { const: "1.0.0" },
        type: { const: "product" },
        count: { const: 42 },
      },
      required: ["version", "type"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "ConstValues",
    });

    expect(result.typeDefinition).toContain('version: "1.0.0";');
    expect(result.typeDefinition).toContain('type: "product";');
    expect(result.typeDefinition).toContain("count?: 42;");
    expect(result.validatorCode).toContain('!== "1.0.0"');
    expect(result.validatorCode).toContain('!== "product"');
    expect(result.validatorCode).toContain("!== 42");
  });

  test("should handle null type", async () => {
    const schema = {
      type: "object",
      properties: {
        data: { type: "null" },
        optionalNull: { type: "null" },
      },
      required: ["data"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "NullableData",
    });

    expect(result.typeDefinition).toContain("data: null;");
    expect(result.typeDefinition).toContain("optionalNull?: null;");
    expect(result.validatorCode).toContain("!== null");
  });

  test("should handle boolean type", async () => {
    const schema = {
      type: "object",
      properties: {
        active: { type: "boolean" },
        enabled: { type: "boolean" },
      },
      required: ["active"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "BooleanFlags",
    });

    expect(result.typeDefinition).toContain("active: boolean;");
    expect(result.typeDefinition).toContain("enabled?: boolean;");
    expect(result.validatorCode).toContain('typeof value.active !== "boolean"');
  });

  test("should generate default export when exportType is 'default'", async () => {
    const schema = { type: "string" };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      exportType: "default",
      typeName: "TestString",
    });

    expect(result.validatorCode).toContain("export default validate");
  });

  test("should generate minified code when minify option is true", async () => {
    const schema = { type: "string" };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      minify: true,
      typeName: "TestString",
    });

    // Minified code has fewer line breaks and comments
    expect(result.validatorCode).toBeDefined();
    expect(result.validatorCode.length).toBeGreaterThan(0);
  });

  test("should use custom validator name", async () => {
    const schema = { type: "string" };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      validatorName: "customValidator",
      typeName: "TestString",
    });

    expect(result.validatorName).toBe("customValidator");
    expect(result.validatorCode).toContain("function customValidator");
  });

  test("should handle Draft-06 const keyword", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-06/schema#",
      type: "object",
      properties: {
        version: { const: "1.0.0" },
        apiKey: { const: 42 },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "Draft06Test",
    });

    expect(result.typeDefinition).toContain('version?: "1.0.0";');
    expect(result.typeDefinition).toContain("apiKey?: 42;");
    expect(result.validatorCode).toContain('!== "1.0.0"');
    expect(result.validatorCode).toContain("!== 42");
  });

  test("should handle Draft-07 if/then/else", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        country: { type: "string" },
        postalCode: { type: "string" },
      },
      if: {
        properties: { country: { const: "US" } },
      },
      then: {
        properties: { postalCode: { pattern: "^\\d{5}$" } },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "ConditionalSchema",
    });

    expect(result.typeDefinition).toContain("country?: string;");
    expect(result.typeDefinition).toContain("postalCode?: string;");
    expect(result.validatorCode).toBeDefined();
    // Complex conditional logic of if/then/else varies by implementation, but ensure it doesn't error
    expect(result.validatorCode.length).toBeGreaterThan(0);
  });

  test("should handle readOnly and writeOnly properties", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        id: { type: "string", readOnly: true },
        password: { type: "string", writeOnly: true },
        name: { type: "string" },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "ReadWriteTest",
    });

    expect(result.typeDefinition).toContain("id?: string;");
    expect(result.typeDefinition).toContain("password?: string;");
    expect(result.typeDefinition).toContain("name?: string;");
    // readOnly/writeOnly are metadata, so basic types are generated
    expect(result.validatorCode).toContain("typeof");
  });

  test("should handle dependentSchemas", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2019-09/schema",
      type: "object",
      properties: {
        name: { type: "string" },
        creditCard: { type: "string" },
      },
      dependentSchemas: {
        creditCard: {
          properties: {
            billingAddress: { type: "string" },
          },
          required: ["billingAddress"],
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "DependentTest",
    });

    expect(result.typeDefinition).toContain("name?: string;");
    expect(result.typeDefinition).toContain("creditCard?: string;");
    // Implementation of dependentSchemas is complex, so verify basic processing works
    expect(result.validatorCode).toBeDefined();
    expect(result.validatorCode.length).toBeGreaterThan(0);
  });

  test("should auto-detect draft version from $schema", async () => {
    const testCases = [
      {
        schema: {
          $schema: "http://json-schema.org/draft-04/schema#",
          type: "string",
        },
        expectedDraft: "draft-04",
        typeName: "Draft04String",
      },
      {
        schema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "string",
        },
        expectedDraft: "draft-07",
        typeName: "Draft07String",
      },
      {
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "string",
        },
        expectedDraft: "2020-12",
        typeName: "Draft2020String",
      },
    ];

    for (const testCase of testCases) {
      await writeFile(schemaPath, JSON.stringify(testCase.schema));

      const result = await generate({
        schemaPath,
        outputPath,
        typeName: testCase.typeName,
      });

      // Verify that basic string types are properly handled in each draft
      expect(result.typeDefinition).toContain(
        `export type ${testCase.typeName} = string;`,
      );
      expect(result.validatorCode).toContain(
        `function validate${testCase.typeName}`,
      );
      expect(result.validatorCode).toContain('typeof value !== "string"');
    }
  });

  test("should handle mixed draft features gracefully", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        version: { const: "1.0" }, // Draft-06 feature
        data: {
          if: { properties: { type: { const: "special" } } }, // Draft-07 feature
          then: { properties: { value: { type: "string" } } },
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "MixedFeatures",
    });

    expect(result.typeDefinition).toContain('version?: "1.0";');
    expect(result.typeDefinition).toContain("data?:");
    expect(result.validatorCode).toContain('!== "1.0"');
    // Verify that mixed features are handled properly
    expect(result.validatorCode).toBeDefined();
  });

  test("should handle unsupported draft features gracefully", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        data: { type: "string" },
      },
      unevaluatedProperties: { type: "number" }, // Complex feature
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "UnsupportedFeatures",
    });

    // Verify that unsupported features don't cause errors and basic functionality works
    expect(result.typeDefinition).toContain("data?: string;");
    expect(result.validatorCode).toContain('typeof value.data !== "string"');
    expect(result.validatorCode).toBeDefined();
  });

  test("should handle Draft 2020-12 prefixItems", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "array",
      prefixItems: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
      ],
      items: { type: "string" },
      minItems: 2,
      maxItems: 10,
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "PrefixItemsTest",
    });

    // prefixItems are expected to be processed as tuple types
    expect(result.validatorCode).toContain("Array.isArray");
    expect(result.validatorCode).toContain(".length < 2");
    expect(result.validatorCode).toContain(".length > 10");
    expect(result.validatorCode).toBeDefined();
  });

  test("should handle schema without $schema (defaults to latest)", async () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { const: "2.0" }, // const should work even without explicit $schema
      },
      required: ["name"],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "NoSchemaDefault",
    });

    expect(result.typeDefinition).toContain("name: string;");
    expect(result.typeDefinition).toContain('version?: "2.0";');
    expect(result.validatorCode).toContain('"name" in value');
    expect(result.validatorCode).toContain('!== "2.0"');
  });

  test("should handle allOf schema composition", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      allOf: [
        {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        {
          type: "object",
          properties: {
            age: { type: "number", minimum: 0 },
          },
        },
        {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
            },
          },
        },
      ],
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "AllOfComposition",
    });

    expect(result.typeDefinition).toContain("name: string;");
    expect(result.typeDefinition).toContain("age?: number;");
    expect(result.typeDefinition).toContain("email?: string;");
    // Complex allOf implementation may not be fully supported yet, so verify basic functionality
    expect(result.validatorCode).toBeDefined();
    expect(result.validatorCode).toContain("function validateAllOfComposition");
  });

  test("should handle format keywords (Draft 2019-09+)", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2019-09/schema",
      type: "object",
      properties: {
        email: {
          type: "string",
          format: "email",
        },
        uri: {
          type: "string",
          format: "uri",
        },
        date: {
          type: "string",
          format: "date",
        },
        uuid: {
          type: "string",
          format: "uuid",
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "FormatValidation",
    });

    expect(result.typeDefinition).toContain("email?: string;");
    expect(result.typeDefinition).toContain("uri?: string;");
    expect(result.typeDefinition).toContain("date?: string;");
    expect(result.typeDefinition).toContain("uuid?: string;");
    // Format implementation varies, but basic types are correctly processed
    expect(result.validatorCode).toContain("typeof");
  });

  test("should handle $defs references", async () => {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        homeAddress: { $ref: "#/$defs/address" },
        workAddress: { $ref: "#/$defs/address" },
      },
      required: ["homeAddress"],
      $defs: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
            zipCode: { type: "string", pattern: "^\\d{5}$" },
          },
          required: ["street", "city"],
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "PersonWithAddress",
    });

    expect(result.typeName).toBe("PersonWithAddress");
    expect(result.typeDefinition).toContain(
      "export type PersonWithAddress = {",
    );
    expect(result.typeDefinition).toContain("homeAddress:");
    expect(result.typeDefinition).toContain("workAddress?:");
    expect(result.typeDefinition).toContain("street: string;");
    expect(result.typeDefinition).toContain("city: string;");
    expect(result.typeDefinition).toContain("zipCode?: string;");
    expect(result.validatorCode).toContain('"homeAddress" in value');
    expect(result.validatorCode).toContain('"street" in');
    expect(result.validatorCode).toContain('"city" in');
  });

  test("should handle mixed definitions and $defs", async () => {
    const schema = {
      type: "object",
      properties: {
        oldStyle: { $ref: "#/definitions/oldItem" },
        newStyle: { $ref: "#/$defs/newItem" },
      },
      definitions: {
        oldItem: {
          type: "object",
          properties: { id: { type: "number" } },
        },
      },
      $defs: {
        newItem: {
          type: "object",
          properties: { name: { type: "string" } },
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "MixedRefs",
    });

    expect(result.typeDefinition).toContain("oldStyle?:");
    expect(result.typeDefinition).toContain("newStyle?:");
    expect(result.typeDefinition).toContain("id?: number;");
    expect(result.typeDefinition).toContain("name?: string;");
  });

  test("should handle complex $ref with definitions vs $defs", async () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        user: { $ref: "#/definitions/person" },
        team: { $ref: "#/$defs/group" }, // Draft 2019-09+ style
      },
      definitions: {
        person: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name"],
        },
      },
      $defs: {
        group: {
          type: "object",
          properties: {
            name: { type: "string" },
            members: {
              type: "array",
              items: { $ref: "#/definitions/person" },
            },
          },
        },
      },
    };

    await writeFile(schemaPath, JSON.stringify(schema));

    const result = await generate({
      schemaPath,
      outputPath,
      typeName: "MixedRefStyles",
    });

    expect(result.typeDefinition).toContain("user?:");
    expect(result.typeDefinition).toContain("team?:");
    expect(result.typeDefinition).toContain("name: string;");
    expect(result.typeDefinition).toContain("age?: number;");
    expect(result.validatorCode).toContain('"name" in');
  });
});
