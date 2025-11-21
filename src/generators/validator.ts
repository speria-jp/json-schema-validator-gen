import type { JsonSchema, SchemaNode } from "json-schema-library";
import ts from "typescript";
import { getTupleInfo } from "../utils/tuple-helpers";

const { factory } = ts;

interface ValidatorGenOptions {
  exportType: "named" | "default";
}

export function generateValidator(
  node: SchemaNode,
  validatorName: string,
  typeName: string,
  options: ValidatorGenOptions,
): string {
  const visited = new WeakSet<SchemaNode>();
  const statements: ts.Statement[] = [];
  const varCounter = { count: 0 };

  // Generate validation checks
  generateChecks(
    node,
    factory.createIdentifier("value"),
    statements,
    visited,
    varCounter,
  );

  // Add final return true
  statements.push(factory.createReturnStatement(factory.createTrue()));

  // Create function body
  const functionBody = factory.createBlock(statements, true);

  // Create parameter with type annotation
  const parameter = factory.createParameterDeclaration(
    undefined,
    undefined,
    "value",
    undefined,
    factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
  );

  // Create return type with type predicate
  const returnType = factory.createTypePredicateNode(
    undefined,
    "value",
    factory.createTypeReferenceNode(typeName, undefined),
  );

  // Create function declaration
  const functionDecl = factory.createFunctionDeclaration(
    options.exportType === "named"
      ? [factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : undefined,
    undefined,
    validatorName,
    undefined,
    [parameter],
    returnType,
    functionBody,
  );

  // Create unsafe validator function
  const unsafeValidatorName = `unsafe${
    validatorName.charAt(0).toUpperCase() + validatorName.slice(1)
  }`;

  // Create parameter for unsafe validator
  const unsafeParameter = factory.createParameterDeclaration(
    undefined,
    undefined,
    "value",
    undefined,
    factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
  );

  // Create return type for unsafe validator
  const unsafeReturnType = factory.createTypeReferenceNode(typeName, undefined);

  // Create unsafe validator body
  const unsafeStatements: ts.Statement[] = [
    // if (!validateXXX(value)) throw new Error(...)
    factory.createIfStatement(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        factory.createCallExpression(
          factory.createIdentifier(validatorName),
          undefined,
          [factory.createIdentifier("value")],
        ),
      ),
      factory.createBlock(
        [
          factory.createThrowStatement(
            factory.createNewExpression(
              factory.createIdentifier("Error"),
              undefined,
              [
                factory.createStringLiteral(
                  `Validation failed: value is not ${typeName}`,
                ),
              ],
            ),
          ),
        ],
        true,
      ),
    ),
    // return value as TypeName
    factory.createReturnStatement(
      factory.createAsExpression(
        factory.createIdentifier("value"),
        factory.createTypeReferenceNode(typeName, undefined),
      ),
    ),
  ];

  const unsafeFunctionBody = factory.createBlock(unsafeStatements, true);

  // Create unsafe function declaration
  const unsafeFunctionDecl = factory.createFunctionDeclaration(
    options.exportType === "named"
      ? [factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : undefined,
    undefined,
    unsafeValidatorName,
    undefined,
    [unsafeParameter],
    unsafeReturnType,
    unsafeFunctionBody,
  );

  // Create source file
  const sourceFileStatements: ts.Statement[] =
    options.exportType === "default"
      ? [
          functionDecl,
          unsafeFunctionDecl,
          factory.createExportAssignment(
            undefined,
            undefined,
            factory.createIdentifier(validatorName),
          ),
        ]
      : [functionDecl, unsafeFunctionDecl];

  const sourceFile = factory.createSourceFile(
    sourceFileStatements,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  // Print with appropriate settings
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  // Don't add header - it will be added in combineOutput
  return printer.printFile(sourceFile);
}

function generateChecks(
  node: SchemaNode,
  valueExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
): void {
  if (visited.has(node)) return;
  visited.add(node);

  const schema = node.schema;

  // Handle missing schema
  if (!schema) {
    return;
  }

  // Handle $ref
  if (schema.$ref) {
    // Try to resolve using the root node's getNode method
    try {
      const rootNode = node.getNodeRoot();
      const { node: refNode } = rootNode.getNode(schema.$ref);
      if (refNode?.schema) {
        generateChecks(refNode, valueExpr, statements, visited, varCounter);
        return;
      }
    } catch (_error) {
      // Root getNode failed, continue to manual resolution
    }

    // Try alternative: manually parse the reference
    if (
      schema.$ref.startsWith("#/definitions/") ||
      schema.$ref.startsWith("#/$defs/")
    ) {
      const defName = schema.$ref
        .replace("#/definitions/", "")
        .replace("#/$defs/", "");

      // Get the root schema and look for definitions
      const rootNode = node.getNodeRoot();
      const rootSchema = rootNode.schema;

      // Check both definitions and $defs for backward compatibility
      const definition =
        rootSchema?.definitions?.[defName] || rootSchema?.$defs?.[defName];

      if (definition) {
        // Create a new node for this definition
        try {
          const definitionNode = rootNode.compileSchema(definition);
          generateChecks(
            definitionNode,
            valueExpr,
            statements,
            visited,
            varCounter,
          );
          return;
        } catch (_error) {
          // Failed to compile definition, skip validation
        }
      }
    }

    // If we can't resolve the reference, skip validation
    return;
  }

  // Handle const
  if (schema.const !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          valueExpr,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          createLiteralExpression(schema.const),
        ),
      ),
    );
    return;
  }

  // Handle enum
  if (schema.enum) {
    // First check the basic type based on the enum values
    const firstValue = schema.enum[0];
    const expectedType = typeof firstValue;
    if (
      expectedType === "string" ||
      expectedType === "number" ||
      expectedType === "boolean"
    ) {
      statements.push(createTypeCheck(valueExpr, expectedType));
    }

    const enumArray = factory.createArrayLiteralExpression(
      schema.enum.map((v: unknown) => createLiteralExpression(v)),
    );
    const includesCall = factory.createCallExpression(
      factory.createPropertyAccessExpression(enumArray, "includes"),
      undefined,
      [valueExpr],
    );
    statements.push(
      createReturnFalseIf(
        factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          includesCall,
        ),
      ),
    );
    return;
  }

  // Handle oneOf
  if (schema.oneOf && node.oneOf) {
    const conditions: ts.Expression[] = [];
    node.oneOf.forEach((subNode) => {
      const subStatements: ts.Statement[] = [];
      const subVisited = new WeakSet<SchemaNode>();
      generateChecks(subNode, valueExpr, subStatements, subVisited, varCounter);
      if (subStatements.length > 0) {
        subStatements.push(factory.createReturnStatement(factory.createTrue()));
        const iife = factory.createCallExpression(
          factory.createParenthesizedExpression(
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createBlock(subStatements, true),
            ),
          ),
          undefined,
          [],
        );
        conditions.push(iife);
      }
    });
    if (conditions.length > 0) {
      const combined = conditions.reduce(
        (acc: ts.Expression, cond: ts.Expression) =>
          factory.createBinaryExpression(acc, ts.SyntaxKind.BarBarToken, cond),
      );
      statements.push(
        createReturnFalseIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createParenthesizedExpression(combined),
          ),
        ),
      );
    }
    return;
  }

  // Handle anyOf
  if (schema.anyOf && node.anyOf) {
    const conditions: ts.Expression[] = [];
    node.anyOf.forEach((subNode) => {
      const subStatements: ts.Statement[] = [];
      const subVisited = new WeakSet<SchemaNode>();
      generateChecks(subNode, valueExpr, subStatements, subVisited, varCounter);
      if (subStatements.length > 0) {
        subStatements.push(factory.createReturnStatement(factory.createTrue()));
        const iife = factory.createCallExpression(
          factory.createParenthesizedExpression(
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createBlock(subStatements, true),
            ),
          ),
          undefined,
          [],
        );
        conditions.push(iife);
      }
    });
    if (conditions.length > 0) {
      const combined = conditions.reduce(
        (acc: ts.Expression, cond: ts.Expression) =>
          factory.createBinaryExpression(acc, ts.SyntaxKind.BarBarToken, cond),
      );
      statements.push(
        createReturnFalseIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createParenthesizedExpression(combined),
          ),
        ),
      );
    }
    return;
  }

  // Handle type-specific validation
  const type = normalizeType(schema.type);

  switch (type) {
    case "string":
      statements.push(createTypeCheck(valueExpr, "string"));
      addStringConstraints(schema, valueExpr, statements);
      break;

    case "number":
    case "integer":
      statements.push(createTypeCheck(valueExpr, "number"));
      if (type === "integer") {
        statements.push(
          createReturnFalseIf(
            factory.createPrefixUnaryExpression(
              ts.SyntaxKind.ExclamationToken,
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier("Number"),
                  "isInteger",
                ),
                undefined,
                [valueExpr],
              ),
            ),
          ),
        );
      }
      addNumberConstraints(schema, valueExpr, statements);
      break;

    case "boolean":
      statements.push(createTypeCheck(valueExpr, "boolean"));
      break;

    case "null":
      statements.push(
        createReturnFalseIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
            factory.createNull(),
          ),
        ),
      );
      break;

    case "array": {
      statements.push(
        createReturnFalseIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("Array"),
                "isArray",
              ),
              undefined,
              [valueExpr],
            ),
          ),
        ),
      );

      // Check if this is a tuple type
      const tupleInfo = getTupleInfo(node, schema);

      if (tupleInfo.isTuple) {
        if (tupleInfo.isDraft2020Tuple && tupleInfo.prefixItems) {
          // Handle Draft 2020-12 tuple with prefixItems
          if (tupleInfo.isFixedLength) {
            // Fixed-length tuple: array must have exactly prefixItems.length elements
            statements.push(
              createReturnFalseIf(
                factory.createBinaryExpression(
                  factory.createPropertyAccessExpression(valueExpr, "length"),
                  ts.SyntaxKind.ExclamationEqualsEqualsToken,
                  factory.createNumericLiteral(tupleInfo.prefixItems.length),
                ),
              ),
            );
          } else {
            // Variable-length tuple: use minItems/maxItems constraints if specified
            addArrayConstraints(schema, valueExpr, statements);
          }

          // Validate each prefixItems element against its schema
          tupleInfo.prefixItems.forEach((itemNode, index) => {
            const elementAccess = factory.createElementAccessExpression(
              valueExpr,
              factory.createNumericLiteral(index),
            );
            generateChecks(
              itemNode,
              elementAccess,
              statements,
              visited,
              varCounter,
            );
          });

          // If items schema is defined (and not an array), validate remaining elements
          if (schema.items && !Array.isArray(schema.items) && node.items) {
            // Validate all elements after prefixItems using the items schema
            const indexVarName = generateUniqueVarName("i", varCounter);
            const indexVar = factory.createIdentifier(indexVarName);
            const itemStatements: ts.Statement[] = [];

            const elementAccess = factory.createElementAccessExpression(
              valueExpr,
              indexVar,
            );

            generateChecks(
              node.items,
              elementAccess,
              itemStatements,
              visited,
              varCounter,
            );

            if (itemStatements.length > 0) {
              // for (let i = prefixItems.length; i < value.length; i++)
              const forLoop = factory.createForStatement(
                factory.createVariableDeclarationList(
                  [
                    factory.createVariableDeclaration(
                      indexVar,
                      undefined,
                      undefined,
                      factory.createNumericLiteral(
                        tupleInfo.prefixItems.length,
                      ),
                    ),
                  ],
                  ts.NodeFlags.Let,
                ),
                factory.createBinaryExpression(
                  indexVar,
                  ts.SyntaxKind.LessThanToken,
                  factory.createPropertyAccessExpression(valueExpr, "length"),
                ),
                factory.createPostfixUnaryExpression(
                  indexVar,
                  ts.SyntaxKind.PlusPlusToken,
                ),
                factory.createBlock(itemStatements, true),
              );
              statements.push(forLoop);
            }
          }
        } else if (tupleInfo.isDraft07Tuple && tupleInfo.itemSchemas) {
          // Handle Draft 07 tuple: items as array of schemas
          // This is always a fixed-length tuple
          statements.push(
            createReturnFalseIf(
              factory.createBinaryExpression(
                factory.createPropertyAccessExpression(valueExpr, "length"),
                ts.SyntaxKind.ExclamationEqualsEqualsToken,
                factory.createNumericLiteral(tupleInfo.itemSchemas.length),
              ),
            ),
          );

          // Validate each tuple element against its corresponding schema
          tupleInfo.itemSchemas.forEach((itemSchema, index) => {
            const elementAccess = factory.createElementAccessExpression(
              valueExpr,
              factory.createNumericLiteral(index),
            );
            const itemNode = node.compileSchema(itemSchema);
            generateChecks(
              itemNode,
              elementAccess,
              statements,
              visited,
              varCounter,
            );
          });
        }
      } else {
        // Regular array: items is a single schema or undefined
        addArrayConstraints(schema, valueExpr, statements);

        // Validate all elements against the same items schema
        if (schema.items && node.items) {
          const itemVarName = generateUniqueVarName("item", varCounter);
          const itemVar = factory.createIdentifier(itemVarName);
          const itemStatements: ts.Statement[] = [];
          generateChecks(
            node.items,
            itemVar,
            itemStatements,
            visited,
            varCounter,
          );

          if (itemStatements.length > 0) {
            const forOf = factory.createForOfStatement(
              undefined,
              factory.createVariableDeclarationList(
                [factory.createVariableDeclaration(itemVar)],
                ts.NodeFlags.Const,
              ),
              valueExpr,
              factory.createBlock(itemStatements, true),
            );
            statements.push(forOf);
          }
        }
      }
      break;
    }

    case "object": {
      // Object type check
      const objectCheck = factory.createBinaryExpression(
        factory.createBinaryExpression(
          factory.createBinaryExpression(
            factory.createTypeOfExpression(valueExpr),
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
            factory.createStringLiteral("object"),
          ),
          ts.SyntaxKind.BarBarToken,
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            factory.createNull(),
          ),
        ),
        ts.SyntaxKind.BarBarToken,
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("Array"),
            "isArray",
          ),
          undefined,
          [valueExpr],
        ),
      );
      statements.push(createReturnFalseIf(objectCheck));

      addObjectConstraints(schema, valueExpr, statements);

      // Required properties
      if (schema.required && schema.required.length > 0) {
        const conditions = schema.required.map((prop: string) =>
          factory.createBinaryExpression(
            factory.createStringLiteral(prop),
            ts.SyntaxKind.InKeyword,
            valueExpr,
          ),
        );
        const combined = conditions.reduce(
          (acc: ts.Expression, cond: ts.Expression) =>
            factory.createBinaryExpression(
              acc,
              ts.SyntaxKind.AmpersandAmpersandToken,
              cond,
            ),
        );
        statements.push(
          createReturnFalseIf(
            factory.createPrefixUnaryExpression(
              ts.SyntaxKind.ExclamationToken,
              factory.createParenthesizedExpression(combined),
            ),
          ),
        );
      }

      // Property validation
      if (schema.properties && node.properties) {
        for (const [prop, propNode] of Object.entries(node.properties)) {
          const propAccess = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop)
            ? factory.createPropertyAccessExpression(valueExpr, prop)
            : factory.createElementAccessExpression(
                valueExpr,
                factory.createStringLiteral(prop),
              );

          const propStatements: ts.Statement[] = [];
          generateChecks(
            propNode,
            propAccess,
            propStatements,
            visited,
            varCounter,
          );

          if (propStatements.length > 0) {
            if (schema.required?.includes(prop)) {
              statements.push(...propStatements);
            } else {
              const ifStatement = factory.createIfStatement(
                factory.createBinaryExpression(
                  factory.createStringLiteral(prop),
                  ts.SyntaxKind.InKeyword,
                  valueExpr,
                ),
                factory.createBlock(propStatements, true),
              );
              statements.push(ifStatement);
            }
          }
        }
      }

      // Additional properties check
      if (schema.additionalProperties === false && schema.properties) {
        const knownProps = Object.keys(schema.properties);
        const keyVarName = generateUniqueVarName("key", varCounter);
        const keyVar = factory.createIdentifier(keyVarName);

        // Create the array literal with explicit type annotation to avoid never[] type issues
        const arrayLiteral =
          knownProps.length > 0
            ? factory.createArrayLiteralExpression(
                knownProps.map((p) => factory.createStringLiteral(p)),
              )
            : factory.createAsExpression(
                factory.createArrayLiteralExpression([]),
                factory.createArrayTypeNode(
                  factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                ),
              );

        const checkBody = factory.createBlock(
          [
            createReturnFalseIf(
              factory.createPrefixUnaryExpression(
                ts.SyntaxKind.ExclamationToken,
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    arrayLiteral,
                    "includes",
                  ),
                  undefined,
                  [keyVar],
                ),
              ),
            ),
          ],
          true,
        );

        const forIn = factory.createForInStatement(
          factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(keyVar)],
            ts.NodeFlags.Const,
          ),
          valueExpr,
          checkBody,
        );
        statements.push(forIn);
      }
      break;
    }

    case "union":
      // Handle type arrays like ["string", "null"]
      if (Array.isArray(schema.type)) {
        const conditions: ts.Expression[] = [];
        for (const t of schema.type) {
          if (t === "null") {
            conditions.push(
              factory.createBinaryExpression(
                valueExpr,
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                factory.createNull(),
              ),
            );
          } else {
            conditions.push(
              factory.createBinaryExpression(
                factory.createTypeOfExpression(valueExpr),
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                factory.createStringLiteral(t),
              ),
            );
          }
        }
        if (conditions.length > 0) {
          const combined = conditions.reduce(
            (acc: ts.Expression, cond: ts.Expression) =>
              factory.createBinaryExpression(
                acc,
                ts.SyntaxKind.BarBarToken,
                cond,
              ),
          );
          statements.push(
            createReturnFalseIf(
              factory.createPrefixUnaryExpression(
                ts.SyntaxKind.ExclamationToken,
                factory.createParenthesizedExpression(combined),
              ),
            ),
          );
        }
      }
      break;
  }
}

function createReturnFalseIf(condition: ts.Expression): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createReturnStatement(factory.createFalse()),
  );
}

function createTypeCheck(value: ts.Expression, type: string): ts.Statement {
  return createReturnFalseIf(
    factory.createBinaryExpression(
      factory.createTypeOfExpression(value),
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      factory.createStringLiteral(type),
    ),
  );
}

function createLiteralExpression(value: unknown): ts.Expression {
  if (typeof value === "string") {
    return factory.createStringLiteral(value);
  } else if (typeof value === "number") {
    return createNumericLiteralExpression(value);
  } else if (typeof value === "boolean") {
    return value ? factory.createTrue() : factory.createFalse();
  } else if (value === null) {
    return factory.createNull();
  }
  return factory.createIdentifier("undefined");
}

// Helper function to create numeric literal that handles negative numbers
function createNumericLiteralExpression(value: number): ts.Expression {
  if (value < 0) {
    // For negative numbers, create a prefix unary expression: -N
    return factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      factory.createNumericLiteral(Math.abs(value)),
    );
  }
  return factory.createNumericLiteral(value);
}

function addStringConstraints(
  schema: JsonSchema,
  value: ts.Expression,
  statements: ts.Statement[],
) {
  if (schema.minLength !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(value, "length"),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minLength),
        ),
      ),
    );
  }

  if (schema.maxLength !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(value, "length"),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxLength),
        ),
      ),
    );
  }

  if (schema.pattern) {
    try {
      // Validate pattern at build time
      new RegExp(schema.pattern);

      // Escape forward slashes for regex literal
      const escapedPattern = schema.pattern.replace(/\//g, "\\/");
      const regex = factory.createRegularExpressionLiteral(
        `/${escapedPattern}/`,
      );

      statements.push(
        createReturnFalseIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(regex, "test"),
              undefined,
              [value],
            ),
          ),
        ),
      );
    } catch (_error) {
      // Invalid regex pattern - skip validation
      console.warn(`Invalid regex pattern in schema: ${schema.pattern}`);
    }
  }
}

function addNumberConstraints(
  schema: JsonSchema,
  value: ts.Expression,
  statements: ts.Statement[],
) {
  if (schema.minimum !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          value,
          ts.SyntaxKind.LessThanToken,
          createNumericLiteralExpression(schema.minimum),
        ),
      ),
    );
  }

  if (schema.maximum !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          value,
          ts.SyntaxKind.GreaterThanToken,
          createNumericLiteralExpression(schema.maximum),
        ),
      ),
    );
  }

  if (schema.exclusiveMinimum !== undefined) {
    if (typeof schema.exclusiveMinimum === "number") {
      statements.push(
        createReturnFalseIf(
          factory.createBinaryExpression(
            value,
            ts.SyntaxKind.LessThanEqualsToken,
            createNumericLiteralExpression(schema.exclusiveMinimum),
          ),
        ),
      );
    } else if (
      schema.exclusiveMinimum === true &&
      schema.minimum !== undefined
    ) {
      statements.push(
        createReturnFalseIf(
          factory.createBinaryExpression(
            value,
            ts.SyntaxKind.LessThanEqualsToken,
            createNumericLiteralExpression(schema.minimum),
          ),
        ),
      );
    }
  }

  if (schema.exclusiveMaximum !== undefined) {
    if (typeof schema.exclusiveMaximum === "number") {
      statements.push(
        createReturnFalseIf(
          factory.createBinaryExpression(
            value,
            ts.SyntaxKind.GreaterThanEqualsToken,
            createNumericLiteralExpression(schema.exclusiveMaximum),
          ),
        ),
      );
    } else if (
      schema.exclusiveMaximum === true &&
      schema.maximum !== undefined
    ) {
      statements.push(
        createReturnFalseIf(
          factory.createBinaryExpression(
            value,
            ts.SyntaxKind.GreaterThanEqualsToken,
            createNumericLiteralExpression(schema.maximum),
          ),
        ),
      );
    }
  }
}

function addArrayConstraints(
  schema: JsonSchema,
  value: ts.Expression,
  statements: ts.Statement[],
) {
  if (schema.minItems !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(value, "length"),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minItems),
        ),
      ),
    );
  }

  if (schema.maxItems !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(value, "length"),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxItems),
        ),
      ),
    );
  }

  if (schema.uniqueItems) {
    const sizeCheck = factory.createBinaryExpression(
      factory.createPropertyAccessExpression(
        factory.createNewExpression(
          factory.createIdentifier("Set"),
          undefined,
          [value],
        ),
        "size",
      ),
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      factory.createPropertyAccessExpression(value, "length"),
    );
    statements.push(createReturnFalseIf(sizeCheck));
  }
}

function addObjectConstraints(
  schema: JsonSchema,
  value: ts.Expression,
  statements: ts.Statement[],
) {
  if (schema.minProperties !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("Object"),
                "keys",
              ),
              undefined,
              [value],
            ),
            "length",
          ),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minProperties),
        ),
      ),
    );
  }

  if (schema.maxProperties !== undefined) {
    statements.push(
      createReturnFalseIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("Object"),
                "keys",
              ),
              undefined,
              [value],
            ),
            "length",
          ),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxProperties),
        ),
      ),
    );
  }
}

function normalizeType(type?: string | string[]): string {
  if (!type) return "any";
  if (Array.isArray(type)) {
    return type.length === 1 ? normalizeType(type[0]) : "union";
  }
  return type;
}

function generateUniqueVarName(
  baseName: string,
  counter: { count: number },
): string {
  counter.count++;
  return `${baseName}${counter.count}`;
}
