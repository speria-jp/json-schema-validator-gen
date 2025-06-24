// This example shows how to use the generated validator

// First, generate the validator by running:
// bun run generate:examples
// or
// bun run dev -s examples/user-schema.json -o examples/generated/user-validator.ts -t User

// Then you can use it like this:
import { validateUser } from "./generated/user-validator";

// Valid user
const validUser = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  tags: ["developer", "typescript"],
  role: "user",
};

if (validateUser(validUser)) {
  // TypeScript knows that validUser is of type User here
  console.log(`Valid user: ${validUser.name} (${validUser.email})`);
} else {
  console.log("Invalid user data");
}

// Invalid user (missing required field)
const invalidUser1 = {
  id: 1,
  name: "Jane Doe",
  // missing email
};

console.log("Missing email:", validateUser(invalidUser1)); // false

// Invalid user (wrong type)
const invalidUser2 = {
  id: "not-a-number", // should be number
  name: "Bob",
  email: "bob@example.com",
};

console.log("Wrong id type:", validateUser(invalidUser2)); // false

// Invalid user (additional properties)
const invalidUser3 = {
  id: 2,
  name: "Alice",
  email: "alice@example.com",
  unknownField: "not allowed", // additionalProperties is false
};

console.log("Extra field:", validateUser(invalidUser3)); // false
