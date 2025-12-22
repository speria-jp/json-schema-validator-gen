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
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t "path=#,name=User"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Generate complex-validator
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t "path=#,name=Complex"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Generate ref-validator
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t "path=#,name=Ref"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Generate multi-types (multiple targets)
  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "multi-schema.json")} -o ${join(generatedDir, "multi-types.ts")} -t '#/$defs/User' -t '#/$defs/Post' -t '#/$defs/Comment'`,
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

  test("multi-types.ts snapshot", async () => {
    const content = await readFile(
      join(generatedDir, "multi-types.ts"),
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
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t "path=#,name=User"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t "path=#,name=Complex"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t "path=#,name=Ref"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "multi-schema.json")} -o ${join(generatedDir, "multi-types.ts")} -t '#/$defs/User' -t '#/$defs/Post' -t '#/$defs/Comment'`,
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
    `bun run ${cliPath} -s ${join(examplesDir, "user-schema.json")} -o ${join(generatedDir, "user-validator.ts")} -t "path=#,name=User"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "complex-schema.json")} -o ${join(generatedDir, "complex-validator.ts")} -t "path=#,name=Complex"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "ref-schema.json")} -o ${join(generatedDir, "ref-validator.ts")} -t "path=#,name=Ref"`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  execSync(
    `bun run ${cliPath} -s ${join(examplesDir, "multi-schema.json")} -o ${join(generatedDir, "multi-types.ts")} -t '#/$defs/User' -t '#/$defs/Post' -t '#/$defs/Comment'`,
    {
      stdio: "pipe",
      cwd: join(__dirname, ".."),
    },
  );

  // Helper type for ValidationResult
  type ValidationIssue = {
    code: string;
    path: (string | number)[];
    message: string;
    expected: string;
    received: string;
  };

  type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; issues: ValidationIssue[] };

  describe("User validator", () => {
    let validateUser: (value: unknown) => ValidationResult<unknown>;
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
        // Test tuple field (location: [latitude, longitude])
        {
          id: 200,
          name: "Alice",
          email: "alice@example.com",
          location: [35.6762, 139.6503], // Tokyo coordinates
        },
        {
          id: 201,
          name: "Charlie",
          email: "charlie@example.com",
          location: [40.7128, -74.006], // New York coordinates
        },
      ];

      for (const user of validUsers) {
        const result = validateUser(user);
        expect(result.success).toBe(true);
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

        // Invalid tuple (location)
        { id: 1, name: "John", email: "john@example.com", location: [35.6762] }, // too few elements
        {
          id: 1,
          name: "John",
          email: "john@example.com",
          location: [35.6762, 139.6503, 100],
        }, // too many elements
        {
          id: 1,
          name: "John",
          email: "john@example.com",
          location: ["35.6762", "139.6503"],
        }, // wrong type
        { id: 1, name: "John", email: "john@example.com", location: [91, 0] }, // latitude out of range
        { id: 1, name: "John", email: "john@example.com", location: [0, 181] }, // longitude out of range

        // Not objects
        null,
        undefined,
        "string",
        123,
        [],
        true,
      ];

      for (const user of invalidUsers) {
        const result = validateUser(user);
        expect(result.success).toBe(false);
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
    let validateComplex: (value: unknown) => ValidationResult<unknown>;
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
          features: [
            {
              name: "color",
              values: "red",
            },
          ],
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
          features: [
            {
              name: "materials",
              values: ["aluminum", "glass"],
            },
            {
              name: "specifications",
              values: ["high-resolution", 120],
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
          features: [
            {
              name: "shipping",
              values: "standard",
            },
          ],
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
          features: [
            {
              name: "shipping",
              values: "express",
            },
          ],
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
          features: [
            {
              name: "payment",
              values: "credit-card",
            },
          ],
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
          features: [
            {
              name: "payment",
              values: "paypal",
            },
          ],
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
          features: [
            {
              name: "payment",
              values: "bank-transfer",
            },
          ],
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
          features: [
            {
              name: "comprehensive",
              values: ["shipping", "payment", "support"],
            },
            {
              name: "ratings",
              values: [5, 4.5, 4.8],
            },
          ],
        },
      ];

      for (const obj of validObjects) {
        const result = validateComplex(obj);
        expect(result.success).toBe(true);
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
        const result = validateComplex(obj);
        expect(result.success).toBe(false);
      }
    });

    test("unsafeValidateComplex returns value for valid objects", () => {
      const validObject = {
        id: 1,
        name: "Product 1",
        price: 99.99,
        features: [
          {
            name: "color",
            values: "red",
          },
        ],
      };

      const result = unsafeValidateComplex(validObject);
      expect(result).toEqual(validObject);
    });

    test("unsafeValidateComplex throws for invalid objects", () => {
      const invalidObjects = [
        { id: 1, name: "Product" }, // missing price
        { id: 1, name: "Product", price: -1 }, // invalid price
        { id: 1, name: "Product", price: 99.99 }, // missing features
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
    let validateRef: (value: unknown) => ValidationResult<unknown>;

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
        const result = validateRef(obj);
        expect(result.success).toBe(true);
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
        const result = validateRef(obj);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Multiple refs validators", () => {
    let validateUser: (value: unknown) => ValidationResult<unknown>;
    let validatePost: (value: unknown) => ValidationResult<unknown>;
    let validateComment: (value: unknown) => ValidationResult<unknown>;
    // biome-ignore lint/suspicious/noExplicitAny: Types are imported dynamically
    let unsafeValidateUser: (value: unknown) => any;
    // biome-ignore lint/suspicious/noExplicitAny: Types are imported dynamically
    let unsafeValidatePost: (value: unknown) => any;
    // biome-ignore lint/suspicious/noExplicitAny: Types are imported dynamically
    let unsafeValidateComment: (value: unknown) => any;

    test("setup", async () => {
      const multiTypes = await import(join(generatedDir, "multi-types.ts"));
      validateUser = multiTypes.validateUser;
      validatePost = multiTypes.validatePost;
      validateComment = multiTypes.validateComment;
      unsafeValidateUser = multiTypes.unsafeValidateUser;
      unsafeValidatePost = multiTypes.unsafeValidatePost;
      unsafeValidateComment = multiTypes.unsafeValidateComment;
    });

    test("validates valid User objects", () => {
      const validUsers = [
        {
          id: "user-1",
          name: "John Doe",
          email: "john@example.com",
        },
        {
          id: "user-2",
          name: "Jane Smith",
          email: "jane.smith@company.org",
        },
      ];

      for (const user of validUsers) {
        const result = validateUser(user);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid User objects", () => {
      const invalidUsers = [
        { id: "user-1", name: "John" }, // missing email
        { id: "user-1", email: "john@example.com" }, // missing name
        { name: "John", email: "john@example.com" }, // missing id
        { id: "user-1", name: "", email: "john@example.com" }, // empty name
        { id: "user-1", name: "John", email: "invalid-email" }, // invalid email
        {
          id: "user-1",
          name: "John",
          email: "john@example.com",
          extra: "field",
        }, // additional property
      ];

      for (const user of invalidUsers) {
        const result = validateUser(user);
        expect(result.success).toBe(false);
      }
    });

    test("validates valid Post objects", () => {
      const validPosts = [
        {
          id: "post-1",
          title: "First Post",
          content: "This is the content",
          authorId: "user-1",
        },
        {
          id: "post-2",
          title: "Second Post",
          content: "Another post content",
          authorId: "user-2",
          tags: ["javascript", "typescript"],
          published: true,
        },
      ];

      for (const post of validPosts) {
        const result = validatePost(post);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid Post objects", () => {
      const invalidPosts = [
        { id: "post-1", title: "Title", content: "Content" }, // missing authorId
        { id: "post-1", title: "", content: "Content", authorId: "user-1" }, // empty title
        {
          id: "post-1",
          title: "a".repeat(201),
          content: "Content",
          authorId: "user-1",
        }, // title too long
        {
          id: "post-1",
          title: "Title",
          content: "Content",
          authorId: "user-1",
          tags: "tag",
        }, // invalid tags type
        {
          id: "post-1",
          title: "Title",
          content: "Content",
          authorId: "user-1",
          published: "true",
        }, // invalid published type
      ];

      for (const post of invalidPosts) {
        const result = validatePost(post);
        expect(result.success).toBe(false);
      }
    });

    test("validates valid Comment objects", () => {
      const validComments = [
        {
          id: "comment-1",
          postId: "post-1",
          authorId: "user-1",
          text: "Great post!",
          createdAt: "2025-01-01T12:00:00Z",
        },
        {
          id: "comment-2",
          postId: "post-1",
          authorId: "user-2",
          text: "Thanks for sharing.",
          createdAt: "2025-01-02T14:30:00Z",
        },
      ];

      for (const comment of validComments) {
        const result = validateComment(comment);
        expect(result.success).toBe(true);
      }
    });

    test("rejects invalid Comment objects", () => {
      const invalidComments = [
        {
          id: "comment-1",
          postId: "post-1",
          authorId: "user-1",
          text: "Comment",
        }, // missing createdAt
        {
          id: "comment-1",
          postId: "post-1",
          authorId: "user-1",
          text: "",
          createdAt: "2025-01-01T12:00:00Z",
        }, // empty text
        {
          id: "comment-1",
          postId: "post-1",
          authorId: "user-1",
          text: "a".repeat(1001),
          createdAt: "2025-01-01T12:00:00Z",
        }, // text too long
      ];

      for (const comment of invalidComments) {
        const result = validateComment(comment);
        expect(result.success).toBe(false);
      }
    });

    test("unsafeValidateUser returns value for valid objects", () => {
      const validUser = {
        id: "user-1",
        name: "John Doe",
        email: "john@example.com",
      };

      const result = unsafeValidateUser(validUser);
      expect(result).toEqual(validUser);
    });

    test("unsafeValidateUser throws for invalid objects", () => {
      const invalidUser = { id: "user-1", name: "John" }; // missing email

      expect(() => unsafeValidateUser(invalidUser)).toThrow(
        "Validation failed: value is not User",
      );
    });

    test("unsafeValidatePost returns value for valid objects", () => {
      const validPost = {
        id: "post-1",
        title: "First Post",
        content: "This is the content",
        authorId: "user-1",
      };

      const result = unsafeValidatePost(validPost);
      expect(result).toEqual(validPost);
    });

    test("unsafeValidatePost throws for invalid objects", () => {
      const invalidPost = { id: "post-1", title: "Title", content: "Content" }; // missing authorId

      expect(() => unsafeValidatePost(invalidPost)).toThrow(
        "Validation failed: value is not Post",
      );
    });

    test("unsafeValidateComment returns value for valid objects", () => {
      const validComment = {
        id: "comment-1",
        postId: "post-1",
        authorId: "user-1",
        text: "Great post!",
        createdAt: "2025-01-01T12:00:00Z",
      };

      const result = unsafeValidateComment(validComment);
      expect(result).toEqual(validComment);
    });

    test("unsafeValidateComment throws for invalid objects", () => {
      const invalidComment = {
        id: "comment-1",
        postId: "post-1",
        authorId: "user-1",
        text: "Comment",
      }; // missing createdAt

      expect(() => unsafeValidateComment(invalidComment)).toThrow(
        "Validation failed: value is not Comment",
      );
    });
  });

  describe("Error detail verification", () => {
    let validateUser: (
      value: unknown,
      options?: { abortEarly?: boolean },
    ) => ValidationResult<unknown>;
    let validateComplex: (
      value: unknown,
      options?: { abortEarly?: boolean },
    ) => ValidationResult<unknown>;
    let validateRef: (
      value: unknown,
      options?: { abortEarly?: boolean },
    ) => ValidationResult<unknown>;

    test("setup", async () => {
      const userValidator = await import(
        join(generatedDir, "user-validator.ts")
      );
      validateUser = userValidator.validateUser;

      const complexValidator = await import(
        join(generatedDir, "complex-validator.ts")
      );
      validateComplex = complexValidator.validateComplex;

      const refValidator = await import(join(generatedDir, "ref-validator.ts"));
      validateRef = refValidator.validateRef;
    });

    test("invalid_type error for wrong type", () => {
      const result = validateUser({
        id: "not-a-number",
        name: "John",
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.path.join(".") === "id");
        expect(issue).toBeDefined();
        expect(issue?.code).toBe("invalid_type");
        expect(issue?.path).toEqual(["id"]);
        expect(issue?.expected).toBe("integer");
        expect(issue?.received).toBe("string");
      }
    });

    test("invalid_type error for non-object", () => {
      const result = validateUser("not-an-object");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.code).toBe("invalid_type");
        expect(result.issues[0]?.path).toEqual([]);
        expect(result.issues[0]?.expected).toBe("object");
        expect(result.issues[0]?.received).toBe("string");
      }
    });

    test("invalid_type error for null", () => {
      const result = validateUser(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.code).toBe("invalid_type");
        expect(result.issues[0]?.received).toBe("null");
      }
    });

    test("invalid_type error for array instead of object", () => {
      const result = validateUser([]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.code).toBe("invalid_type");
        expect(result.issues[0]?.received).toBe("array");
      }
    });

    test("missing_key error for required property", () => {
      const result = validateUser({ id: 1, name: "John" }); // missing email
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find(
          (i) => i.code === "missing_key" && i.expected.includes("email"),
        );
        expect(issue).toBeDefined();
        expect(issue?.code).toBe("missing_key");
        expect(issue?.path).toEqual([]);
        expect(issue?.expected).toBe('object with required property "email"');
        expect(issue?.received).toBe('object without property "email"');
      }
    });

    test("too_small error for number below minimum", () => {
      const result = validateUser({
        id: 0,
        name: "John",
        email: "john@example.com",
      }); // id < 1
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "too_small");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["id"]);
        expect(issue?.expected).toBe("number >= 1");
        expect(issue?.received).toBe("0");
      }
    });

    test("too_small error for string below minLength", () => {
      const result = validateUser({
        id: 1,
        name: "",
        email: "john@example.com",
      }); // empty name
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "too_small");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["name"]);
        expect(issue?.expected).toBe("string with length >= 1");
        expect(issue?.received).toBe("string with length 0");
      }
    });

    test("too_big error for number above maximum", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        age: 200,
      }); // age > 150
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "too_big");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["age"]);
        expect(issue?.expected).toBe("number <= 150");
        expect(issue?.received).toBe("200");
      }
    });

    test("too_big error for string above maxLength", () => {
      const result = validateUser({
        id: 1,
        name: "a".repeat(101),
        email: "john@example.com",
      }); // name > 100
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "too_big");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["name"]);
        expect(issue?.expected).toBe("string with length <= 100");
        expect(issue?.received).toBe("string with length 101");
      }
    });

    test("invalid_string error for pattern mismatch", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "invalid-email",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "invalid_string");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["email"]);
        expect(issue?.expected).toContain("pattern");
        expect(issue?.received).toBe("invalid-email");
      }
    });

    test("invalid_value error for invalid enum value", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        role: "superadmin",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "invalid_value");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["role"]);
        expect(issue?.expected).toBe('"admin" | "user" | "guest"');
        expect(issue?.received).toBe('"superadmin"');
      }
    });

    test("not_integer error for non-integer number", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        age: 25.5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "not_integer");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["age"]);
        expect(issue?.expected).toBe("integer");
        expect(issue?.received).toBe("25.5");
      }
    });

    test("not_unique error for array with duplicates", () => {
      const result = validateComplex({
        id: 1,
        name: "Product",
        price: 100,
        tags: ["a", "b", "a"], // duplicate "a"
        features: [{ name: "color", values: "red" }],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "not_unique");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["tags"]);
        expect(issue?.expected).toBe("array with unique items");
        expect(issue?.received).toBe("array with duplicate items");
      }
    });

    test("unrecognized_key error for additional properties", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        extra: "field",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "unrecognized_key");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["extra"]);
        expect(issue?.expected).toContain("known properties");
        expect(issue?.received).toBe("extra");
      }
    });

    test("nested path for nested object errors", () => {
      const result = validateRef({
        id: 1,
        name: "John",
        address: {
          street: "123 Main St",
          city: "New York",
          zipCode: "123", // invalid pattern (should be 5 digits)
        },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.code === "invalid_string");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["address", "zipCode"]);
      }
    });

    test("nested path for missing key in nested object", () => {
      const result = validateRef({
        id: 1,
        name: "John",
        address: {
          street: "123 Main St",
          // missing city
        },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find(
          (i) => i.code === "missing_key" && i.expected.includes("city"),
        );
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["address"]);
      }
    });

    test("array index in path for array item errors", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        tags: ["valid", 123, "also-valid"], // invalid item at index 1
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find((i) => i.path.includes(1));
        expect(issue).toBeDefined();
        expect(issue?.code).toBe("invalid_type");
        expect(issue?.path).toEqual(["tags", 1]);
        expect(issue?.expected).toBe("string");
        expect(issue?.received).toBe("number");
      }
    });

    test("tuple length error", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        location: [35.6762], // should be 2 elements
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find(
          (i) => i.path.join(".") === "location" && i.code === "invalid_type",
        );
        expect(issue).toBeDefined();
        expect(issue?.expected).toBe("tuple with 2 elements");
        expect(issue?.received).toBe("array with 1 elements");
      }
    });

    test("tuple element error with index path", () => {
      const result = validateUser({
        id: 1,
        name: "John",
        email: "john@example.com",
        location: ["not-a-number", 139.6503],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues.find(
          (i) => i.path.join(".") === "location.0",
        );
        expect(issue).toBeDefined();
        expect(issue?.code).toBe("invalid_type");
        expect(issue?.path).toEqual(["location", 0]);
        expect(issue?.expected).toBe("number");
        expect(issue?.received).toBe("string");
      }
    });

    test("collects multiple errors when abortEarly is false", () => {
      const result = validateUser({
        id: "not-a-number", // invalid_type
        name: "", // too_small
        email: "invalid-email", // invalid_string
        extra: "field", // unrecognized_key
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple issues
        expect(result.issues.length).toBeGreaterThan(1);

        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain("invalid_type");
        expect(codes).toContain("too_small");
        expect(codes).toContain("invalid_string");
        expect(codes).toContain("unrecognized_key");
      }
    });

    test("abortEarly propagates to nested $ref validators", () => {
      // Test data with multiple errors in nested $ref (address)
      const invalidData = {
        id: 1,
        name: "John",
        address: {
          street: 123, // invalid_type (should be string)
          city: 456, // invalid_type (should be string)
          zipCode: "abc", // invalid_string (pattern mismatch)
        },
      };

      // Without abortEarly - should collect all errors
      const resultAll = validateRef(invalidData);
      expect(resultAll.success).toBe(false);
      if (!resultAll.success) {
        // Should have multiple issues from nested address
        expect(resultAll.issues.length).toBeGreaterThan(1);
      }

      // With abortEarly - should stop at first error
      const resultEarly = validateRef(invalidData, { abortEarly: true });
      expect(resultEarly.success).toBe(false);
      if (!resultEarly.success) {
        // Should have only 1 issue due to abortEarly
        expect(resultEarly.issues.length).toBe(1);
      }
    });
  });
});
