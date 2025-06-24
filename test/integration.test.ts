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
    // biome-ignore lint/suspicious/noExplicitAny: User type is imported dynamically
    let unsafeValidateUser: (value: unknown) => any;

    test("setup", async () => {
      const userValidator = await import(
        join(generatedDir, "user-validator.ts")
      );
      validateUser = userValidator.validateUser;
      unsafeValidateUser = userValidator.unsafeValidateUser;
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

    test("unsafeValidateUser returns value for valid objects", () => {
      const validUser = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      };

      const result = unsafeValidateUser(validUser);
      expect(result).toEqual(validUser);
      expect(result).toBe(validUser); // Should be the same reference
    });

    test("unsafeValidateUser throws for invalid objects", () => {
      const invalidUsers = [
        { id: 1, name: "John" }, // missing email
        { id: "1", name: "John", email: "john@example.com" }, // invalid id type
        null,
        undefined,
        "string",
      ];

      for (const user of invalidUsers) {
        expect(() => unsafeValidateUser(user)).toThrow(
          "Validation failed: value is not User",
        );
      }
    });
  });

  describe("Complex validator", () => {
    let validateComplex: (value: unknown) => boolean;
    // biome-ignore lint/suspicious/noExplicitAny: Complex type is imported dynamically
    let unsafeValidateComplex: (value: unknown) => any;

    test("setup", async () => {
      const complexValidator = await import(
        join(generatedDir, "complex-validator.ts")
      );
      validateComplex = complexValidator.validateComplex;
      unsafeValidateComplex = complexValidator.unsafeValidateComplex;
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
        // Test oneOf - standard shipping
        {
          id: 2,
          name: "Product with Standard Shipping",
          price: 49.99,
          shippingMethod: {
            type: "standard",
            estimatedDays: 5,
          },
        },
        // Test oneOf - express shipping
        {
          id: 3,
          name: "Product with Express Shipping",
          price: 149.99,
          shippingMethod: {
            type: "express",
            guaranteedDate: "2025-12-25",
          },
        },
        // Test anyOf - credit card payment
        {
          id: 4,
          name: "Product with Credit Card",
          price: 299.99,
          paymentOptions: {
            creditCard: {
              lastFourDigits: "1234",
              brand: "visa",
            },
          },
        },
        // Test anyOf - PayPal payment
        {
          id: 5,
          name: "Product with PayPal",
          price: 99.99,
          paymentOptions: {
            paypal: {
              email: "user@example.com",
            },
          },
        },
        // Test anyOf - bank transfer payment
        {
          id: 6,
          name: "Product with Bank Transfer",
          price: 999.99,
          paymentOptions: {
            bankTransfer: {
              accountNumber: "1234567890ABCD",
            },
          },
        },
        // Test both oneOf and anyOf together
        {
          id: 7,
          name: "Product with Both Shipping and Payment",
          price: 599.99,
          shippingMethod: {
            type: "express",
            guaranteedDate: "2025-12-20",
          },
          paymentOptions: {
            creditCard: {
              lastFourDigits: "5678",
              brand: "mastercard",
            },
          },
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

        // Invalid oneOf - missing required field
        {
          id: 8,
          name: "Invalid Shipping - Missing Field",
          price: 99.99,
          shippingMethod: {
            type: "standard",
            // missing estimatedDays
          },
        },
        // Invalid oneOf - wrong type value
        {
          id: 9,
          name: "Invalid Shipping - Wrong Type",
          price: 99.99,
          shippingMethod: {
            type: "overnight", // not a valid type
            estimatedDays: 1,
          },
        },
        // Invalid oneOf - out of range
        {
          id: 10,
          name: "Invalid Shipping - Out of Range",
          price: 99.99,
          shippingMethod: {
            type: "standard",
            estimatedDays: 10, // max is 7
          },
        },
        // Invalid oneOf - wrong date format
        {
          id: 11,
          name: "Invalid Shipping - Wrong Date Format",
          price: 99.99,
          shippingMethod: {
            type: "express",
            guaranteedDate: "2025/12/25", // should be YYYY-MM-DD
          },
        },

        // Invalid anyOf - missing required field
        {
          id: 12,
          name: "Invalid Payment - Missing Field",
          price: 99.99,
          paymentOptions: {
            creditCard: {
              lastFourDigits: "1234",
              // missing brand
            },
          },
        },
        // Invalid anyOf - wrong pattern
        {
          id: 13,
          name: "Invalid Payment - Wrong Pattern",
          price: 99.99,
          paymentOptions: {
            creditCard: {
              lastFourDigits: "12345", // should be exactly 4 digits
              brand: "visa",
            },
          },
        },
        // Invalid anyOf - invalid enum value
        {
          id: 14,
          name: "Invalid Payment - Invalid Brand",
          price: 99.99,
          paymentOptions: {
            creditCard: {
              lastFourDigits: "1234",
              brand: "discover", // not in enum
            },
          },
        },
        // Invalid anyOf - short account number
        {
          id: 15,
          name: "Invalid Payment - Short Account",
          price: 99.99,
          paymentOptions: {
            bankTransfer: {
              accountNumber: "123456789", // min length is 10
            },
          },
        },
      ];

      for (const obj of invalidObjects) {
        expect(validateComplex(obj)).toBe(false);
      }
    });

    test("unsafeValidateComplex returns value for valid objects", () => {
      const validObject = {
        id: 1,
        name: "Product 1",
        price: 99.99,
      };

      const result = unsafeValidateComplex(validObject);
      expect(result).toEqual(validObject);
      expect(result).toBe(validObject); // Should be the same reference
    });

    test("unsafeValidateComplex throws for invalid objects", () => {
      const invalidObjects = [
        { id: 1, name: "Product" }, // missing price
        { id: 1, name: "Product", price: -1 }, // invalid price
        null,
        undefined,
      ];

      for (const obj of invalidObjects) {
        expect(() => unsafeValidateComplex(obj)).toThrow(
          "Validation failed: value is not Complex",
        );
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
