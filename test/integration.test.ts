import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const generatedDir = join(__dirname, "..", "examples", "generated");

describe("Generated code snapshots", () => {
  // Generate validators using CLI before running tests
  const cliPath = join(__dirname, "..", "src", "cli.ts");
  const examplesDir = join(__dirname, "..", "examples");

  // Generate user-validator
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t User -v validateUser`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Generate complex-validator
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t Complex -v validateComplex`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Generate ref-validator
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t Ref -v validateRef`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  test("user-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "user-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });

  test("complex-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "complex-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });

  test("ref-validator.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "ref-validator.ts"),
      "utf-8",
    );
    expect(content).toMatchSnapshot();
  });
});

describe("TypeScript type checking tests", () => {
  // Generate validators using CLI before running type check tests
  const cliPath = join(__dirname, "..", "src", "cli.ts");
  const examplesDir = join(__dirname, "..", "examples");

  // Generate all validators
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t User -v validateUser`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t Complex -v validateComplex`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t Ref -v validateRef`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  test("generated code passes TypeScript type checking", () => {
    // Use the test-specific tsconfig for type checking
    const tsconfigPath = join(__dirname, "tsconfig.test.json");

    expect(() => {
      execSync(`bunx tsc --project ${tsconfigPath}`, {
        stdio: "pipe",
        cwd: join(__dirname, ".."),
        encoding: "utf-8",
      });
    }).not.toThrow();
  });
});

describe("Runtime validation tests", () => {
  // Generate validators before running runtime tests
  const cliPath = join(__dirname, "..", "src", "cli.ts");
  const examplesDir = join(__dirname, "..", "examples");

  // Generate all validators
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t User -v validateUser`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t Complex -v validateComplex`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t Ref -v validateRef`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  describe("User validator", () => {
    let validateUser: (value: unknown) => boolean;

    test("setup", async () => {
      const userValidator = await import(
        join(generatedDir, "user-validator.ts")
      );
      validateUser = userValidator.validateUser;
    });

    test("validates valid user objects", () => {
      const validUsers = [
        {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
        },
        {
          id: 42,
          name: "Jane Smith",
          email: "jane.smith@company.org",
          age: 30,
          tags: ["developer", "team-lead"],
          role: "admin",
        },
        {
          id: 100,
          name: "Bob",
          email: "bob@test.io",
          role: "user",
        },
      ];

      for (const user of validUsers) {
        expect(validateUser(user)).toBe(true);
      }
    });

    test("rejects invalid user objects", () => {
      const invalidUsers = [
        // Missing required fields
        { id: 1, name: "John" },
        { id: 1, email: "john@example.com" },
        { name: "John", email: "john@example.com" },

        // Invalid types
        { id: "1", name: "John", email: "john@example.com" },
        { id: 1, name: 123, email: "john@example.com" },
        { id: 1, name: "John", email: 123 },

        // Invalid values
        { id: 0, name: "John", email: "john@example.com" }, // id < 1
        { id: 1, name: "", email: "john@example.com" }, // empty name
        { id: 1, name: "a".repeat(101), email: "john@example.com" }, // name too long
        { id: 1, name: "John", email: "invalid-email" }, // invalid email format

        // Invalid optional fields
        { id: 1, name: "John", email: "john@example.com", age: -1 },
        { id: 1, name: "John", email: "john@example.com", age: 151 },
        { id: 1, name: "John", email: "john@example.com", age: 25.5 }, // not integer
        { id: 1, name: "John", email: "john@example.com", tags: "developer" }, // not array
        { id: 1, name: "John", email: "john@example.com", tags: [1, 2, 3] }, // not string array
        { id: 1, name: "John", email: "john@example.com", role: "superadmin" }, // invalid enum

        // Additional properties
        { id: 1, name: "John", email: "john@example.com", extra: "field" },

        // Not objects
        null,
        undefined,
        "string",
        123,
        [],
        true,
      ];

      for (const user of invalidUsers) {
        expect(validateUser(user)).toBe(false);
      }
    });
  });

  describe("Complex validator", () => {
    let validateComplex: (value: unknown) => boolean;

    test("setup", async () => {
      const complexValidator = await import(
        join(generatedDir, "complex-validator.ts")
      );
      validateComplex = complexValidator.validateComplex;
    });

    test("validates valid complex objects", () => {
      const validObjects = [
        {
          id: 1,
          name: "Product 1",
          price: 99.99,
        },
        {
          id: 100,
          name: "Premium Product",
          price: 999999.99,
          discount: 10,
          tags: ["electronics", "premium"],
          metadata: {
            manufacturer: "Apple",
            warranty: 24,
          },
          status: "available",
          variants: [
            {
              sku: "ABC123",
              attributes: { color: "red", size: "large" },
            },
          ],
        },
      ];

      for (const obj of validObjects) {
        expect(validateComplex(obj)).toBe(true);
      }
    });

    test("rejects invalid complex objects", () => {
      const invalidObjects = [
        // Invalid price
        { id: 1, name: "Product", price: -1 },
        { id: 1, name: "Product", price: 1000000 },

        // Invalid discount
        { id: 1, name: "Product", price: 100, discount: -1 },
        { id: 1, name: "Product", price: 100, discount: 101 },

        // Invalid tags
        { id: 1, name: "Product", price: 100, tags: [] }, // empty array
        {
          id: 1,
          name: "Product",
          price: 100,
          tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
        }, // too many
        { id: 1, name: "Product", price: 100, tags: ["a", "a"] }, // duplicates

        // Invalid metadata
        { id: 1, name: "Product", price: 100, metadata: {} }, // empty object
        {
          id: 1,
          name: "Product",
          price: 100,
          metadata: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
        }, // too many properties

        // Invalid variants
        {
          id: 1,
          name: "Product",
          price: 100,
          variants: [{ sku: "abc", attributes: {} }],
        }, // invalid SKU pattern
        { id: 1, name: "Product", price: 100, variants: [{ sku: "ABC123" }] }, // missing attributes
      ];

      for (const obj of invalidObjects) {
        expect(validateComplex(obj)).toBe(false);
      }
    });
  });

  describe("Ref validator", () => {
    let validateRef: (value: unknown) => boolean;

    test("setup", async () => {
      const refValidator = await import(join(generatedDir, "ref-validator.ts"));
      validateRef = refValidator.validateRef;
    });

    test("validates valid ref objects", () => {
      const validObjects = [
        {
          id: 1,
          name: "John",
          address: {
            street: "123 Main St",
            city: "New York",
          },
        },
        {
          id: 2,
          name: "Jane",
          address: {
            street: "456 Elm St",
            city: "Boston",
            zipCode: "12345",
          },
          workAddress: {
            street: "789 Oak St",
            city: "Chicago",
            zipCode: "67890",
          },
        },
      ];

      for (const obj of validObjects) {
        expect(validateRef(obj)).toBe(true);
      }
    });

    test("rejects invalid ref objects", () => {
      const invalidObjects = [
        // Missing address
        { id: 1, name: "John" },

        // Invalid address
        { id: 1, name: "John", address: "123 Main St" },
        { id: 1, name: "John", address: { street: "123 Main St" } }, // missing city
        { id: 1, name: "John", address: { city: "New York" } }, // missing street

        // Invalid zipCode
        {
          id: 1,
          name: "John",
          address: { street: "123 Main St", city: "New York", zipCode: "123" },
        }, // too short
        {
          id: 1,
          name: "John",
          address: {
            street: "123 Main St",
            city: "New York",
            zipCode: "1234a",
          },
        }, // not digits

        // Invalid workAddress
        {
          id: 1,
          name: "John",
          address: { street: "123 Main St", city: "New York" },
          workAddress: { street: "456 Elm St" },
        },
      ];

      for (const obj of invalidObjects) {
        expect(validateRef(obj)).toBe(false);
      }
    });
  });
});
