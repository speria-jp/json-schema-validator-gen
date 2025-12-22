import type { JsonSchema, SchemaNode } from "json-schema-library";
import ts from "typescript";
import { generateValidatorName } from "../utils/name-generator";
import { getTupleInfo } from "../utils/tuple-helpers";

const { factory } = ts;

export function generateValidator(
  node: SchemaNode,
  validatorName: string,
  typeName: string,
  generatedTypes: Map<string, string> = new Map(),
  isExported: boolean = true,
): string {
  const visited = new WeakSet<SchemaNode>();
  const statements: ts.Statement[] = [];
  const varCounter = { count: 0 };

  // Create issues array declaration: const issues: ValidationIssue[] = [];
  statements.push(
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            "issues",
            undefined,
            factory.createArrayTypeNode(
              factory.createTypeReferenceNode("ValidationIssue", undefined),
            ),
            factory.createArrayLiteralExpression([]),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    ),
  );

  // Create abortEarly variable: const abortEarly = options?.abortEarly ?? false;
  statements.push(
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            "abortEarly",
            undefined,
            undefined,
            factory.createBinaryExpression(
              factory.createPropertyAccessChain(
                factory.createIdentifier("options"),
                factory.createToken(ts.SyntaxKind.QuestionDotToken),
                "abortEarly",
              ),
              ts.SyntaxKind.QuestionQuestionToken,
              factory.createFalse(),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    ),
  );

  // Generate validation checks
  const pathExpr = factory.createArrayLiteralExpression([]);
  generateChecks(
    node,
    factory.createIdentifier("value"),
    pathExpr,
    statements,
    visited,
    varCounter,
    generatedTypes,
  );

  // Add final return
  // if (issues.length > 0) { return { success: false, issues }; }
  statements.push(
    factory.createIfStatement(
      factory.createBinaryExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("issues"),
          "length",
        ),
        ts.SyntaxKind.GreaterThanToken,
        factory.createNumericLiteral(0),
      ),
      factory.createBlock(
        [
          factory.createReturnStatement(
            factory.createObjectLiteralExpression([
              factory.createPropertyAssignment(
                "success",
                factory.createFalse(),
              ),
              factory.createShorthandPropertyAssignment("issues"),
            ]),
          ),
        ],
        true,
      ),
    ),
  );

  // return { success: true, data: value as T };
  statements.push(
    factory.createReturnStatement(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment("success", factory.createTrue()),
        factory.createPropertyAssignment(
          "data",
          factory.createAsExpression(
            factory.createIdentifier("value"),
            factory.createTypeReferenceNode(typeName, undefined),
          ),
        ),
      ]),
    ),
  );

  // Create function body
  const functionBody = factory.createBlock(statements, true);

  // Create parameters: (value: unknown, options?: ValidationOptions)
  const parameters = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      "value",
      undefined,
      factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    ),
    factory.createParameterDeclaration(
      undefined,
      undefined,
      "options",
      factory.createToken(ts.SyntaxKind.QuestionToken),
      factory.createTypeReferenceNode("ValidationOptions", undefined),
    ),
  ];

  // Create return type: ValidationResult<T>
  const returnType = factory.createTypeReferenceNode("ValidationResult", [
    factory.createTypeReferenceNode(typeName, undefined),
  ]);

  // Control whether to include export keyword
  const modifiers = isExported
    ? [factory.createModifier(ts.SyntaxKind.ExportKeyword)]
    : [];

  // Create function declaration
  const functionDecl = factory.createFunctionDeclaration(
    modifiers,
    undefined,
    validatorName,
    undefined,
    parameters,
    returnType,
    functionBody,
  );

  // Only generate parse function for exported types
  const finalStatements: ts.Statement[] = [functionDecl];

  if (isExported) {
    // Create unsafeValidate function (throws on error)
    const unsafeFunctionName = `unsafeValidate${typeName}`;

    // Create parameter for unsafeValidate function
    const unsafeParameter = factory.createParameterDeclaration(
      undefined,
      undefined,
      "value",
      undefined,
      factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
    );

    // Create return type for unsafeValidate function
    const unsafeReturnType = factory.createTypeReferenceNode(
      typeName,
      undefined,
    );

    // Create unsafeValidate function body
    const unsafeStatements: ts.Statement[] = [
      // const result = validateXxx(value, { abortEarly: true });
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              "result",
              undefined,
              undefined,
              factory.createCallExpression(
                factory.createIdentifier(validatorName),
                undefined,
                [
                  factory.createIdentifier("value"),
                  factory.createObjectLiteralExpression([
                    factory.createPropertyAssignment(
                      "abortEarly",
                      factory.createTrue(),
                    ),
                  ]),
                ],
              ),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
      // if (!result.success) { throw new Error(...); }
      factory.createIfStatement(
        factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          factory.createPropertyAccessExpression(
            factory.createIdentifier("result"),
            "success",
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
      // return result.data;
      factory.createReturnStatement(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("result"),
          "data",
        ),
      ),
    ];

    const unsafeFunctionBody = factory.createBlock(unsafeStatements, true);

    // Create unsafeValidate function declaration
    const unsafeFunctionDecl = factory.createFunctionDeclaration(
      modifiers,
      undefined,
      unsafeFunctionName,
      undefined,
      [unsafeParameter],
      unsafeReturnType,
      unsafeFunctionBody,
    );

    finalStatements.push(unsafeFunctionDecl);
  }

  // Create source file
  const sourceFile = factory.createSourceFile(
    finalStatements,
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
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
  generatedTypes: Map<string, string> = new Map(),
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
    const refPath = schema.$ref;

    // If this reference is in generatedTypes, call the validator function
    const referencedTypeName = generatedTypes.get(refPath);
    if (referencedTypeName !== undefined) {
      const referencedValidatorName = generateValidatorName(referencedTypeName);

      // const _refResult = validateXxx(valueExpr);
      // if (!_refResult.success) {
      //   for (const issue of _refResult.issues) {
      //     issues.push({ ...issue, path: [...path, ...issue.path] });
      //   }
      //   if (abortEarly) return { success: false, issues };
      // }
      const refResultVarName = generateUniqueVarName("_refResult", varCounter);
      const refResultVar = factory.createIdentifier(refResultVarName);

      statements.push(
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                refResultVarName,
                undefined,
                undefined,
                factory.createCallExpression(
                  factory.createIdentifier(referencedValidatorName),
                  undefined,
                  [valueExpr, factory.createIdentifier("options")],
                ),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
      );

      const issueVarName = generateUniqueVarName("_issue", varCounter);
      const issueVar = factory.createIdentifier(issueVarName);

      statements.push(
        factory.createIfStatement(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createPropertyAccessExpression(refResultVar, "success"),
          ),
          factory.createBlock(
            [
              factory.createForOfStatement(
                undefined,
                factory.createVariableDeclarationList(
                  [factory.createVariableDeclaration(issueVar)],
                  ts.NodeFlags.Const,
                ),
                factory.createPropertyAccessExpression(refResultVar, "issues"),
                factory.createBlock(
                  [
                    factory.createExpressionStatement(
                      factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                          factory.createIdentifier("issues"),
                          "push",
                        ),
                        undefined,
                        [
                          factory.createObjectLiteralExpression([
                            factory.createSpreadAssignment(issueVar),
                            factory.createPropertyAssignment(
                              "path",
                              factory.createArrayLiteralExpression([
                                factory.createSpreadElement(pathExpr),
                                factory.createSpreadElement(
                                  factory.createPropertyAccessExpression(
                                    issueVar,
                                    "path",
                                  ),
                                ),
                              ]),
                            ),
                          ]),
                        ],
                      ),
                    ),
                  ],
                  true,
                ),
              ),
              createAbortEarlyReturn(),
            ],
            true,
          ),
        ),
      );
      return;
    }

    // If not in generatedTypes, try to resolve and expand inline (fallback for backward compatibility)
    console.warn(
      `Reference ${refPath} not in generatedTypes - falling back to inline expansion`,
    );

    // Try to resolve using the root node's getNode method
    try {
      const rootNode = node.getNodeRoot();
      const { node: refNode } = rootNode.getNode(schema.$ref);
      if (refNode?.schema) {
        generateChecks(
          refNode,
          valueExpr,
          pathExpr,
          statements,
          visited,
          varCounter,
          generatedTypes,
        );
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

      const rootNode = node.getNodeRoot();
      const rootSchema = rootNode.schema;

      const definition =
        rootSchema?.definitions?.[defName] || rootSchema?.$defs?.[defName];

      if (definition) {
        try {
          const definitionNode = rootNode.compileSchema(definition);
          generateChecks(
            definitionNode,
            valueExpr,
            pathExpr,
            statements,
            visited,
            varCounter,
            generatedTypes,
          );
          return;
        } catch (_error) {
          // Failed to compile definition, skip validation
        }
      }
    }

    return;
  }

  // Handle const
  if (schema.const !== undefined) {
    const expectedValue = JSON.stringify(schema.const);
    statements.push(
      createInvalidValueIf(
        factory.createBinaryExpression(
          valueExpr,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          createLiteralExpression(schema.const),
        ),
        pathExpr,
        factory.createStringLiteral(expectedValue),
        factory.createCallExpression(
          factory.createIdentifier("JSON.stringify"),
          undefined,
          [valueExpr],
        ),
      ),
    );
    return;
  }

  // Handle enum
  if (schema.enum) {
    // Cast to unknown[] so .includes() accepts unknown type value
    const enumArray = factory.createAsExpression(
      factory.createArrayLiteralExpression(
        schema.enum.map((v: unknown) => createLiteralExpression(v)),
      ),
      factory.createArrayTypeNode(
        factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
      ),
    );
    const includesCall = factory.createCallExpression(
      factory.createPropertyAccessExpression(enumArray, "includes"),
      undefined,
      [valueExpr],
    );

    const expectedValues = schema.enum
      .map((v: unknown) => JSON.stringify(v))
      .join(" | ");
    statements.push(
      createInvalidValueIf(
        factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          includesCall,
        ),
        pathExpr,
        factory.createStringLiteral(expectedValues),
        factory.createCallExpression(
          factory.createIdentifier("JSON.stringify"),
          undefined,
          [valueExpr],
        ),
      ),
    );
    return;
  }

  // Handle oneOf
  if (schema.oneOf && node.oneOf) {
    generateOneOfChecks(
      node,
      valueExpr,
      pathExpr,
      statements,
      varCounter,
      generatedTypes,
    );
    return;
  }

  // Handle anyOf
  if (schema.anyOf && node.anyOf) {
    generateAnyOfChecks(
      node,
      valueExpr,
      pathExpr,
      statements,
      varCounter,
      generatedTypes,
    );
    return;
  }

  // Handle type-specific validation
  const type = normalizeType(schema.type);

  switch (type) {
    case "string":
      generateStringChecks(schema, valueExpr, pathExpr, statements, varCounter);
      break;

    case "number":
    case "integer":
      generateNumberChecks(
        schema,
        type,
        valueExpr,
        pathExpr,
        statements,
        varCounter,
      );
      break;

    case "boolean":
      statements.push(
        createInvalidTypeIf(
          factory.createBinaryExpression(
            factory.createTypeOfExpression(valueExpr),
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
            factory.createStringLiteral("boolean"),
          ),
          pathExpr,
          "boolean",
          valueExpr,
        ),
      );
      break;

    case "null":
      statements.push(
        createInvalidTypeIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
            factory.createNull(),
          ),
          pathExpr,
          "null",
          valueExpr,
        ),
      );
      break;

    case "array":
      generateArrayChecks(
        node,
        schema,
        valueExpr,
        pathExpr,
        statements,
        visited,
        varCounter,
        generatedTypes,
      );
      break;

    case "object":
      generateObjectChecks(
        node,
        schema,
        valueExpr,
        pathExpr,
        statements,
        visited,
        varCounter,
        generatedTypes,
      );
      break;

    case "union":
      // Handle type arrays like ["string", "null"]
      if (Array.isArray(schema.type)) {
        generateUnionTypeChecks(schema.type, valueExpr, pathExpr, statements);
      }
      break;
  }
}

function generateStringChecks(
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  _varCounter: { count: number },
): void {
  // Create type check condition: typeof value === "string"
  const isStringCheck = factory.createBinaryExpression(
    factory.createTypeOfExpression(valueExpr),
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    factory.createStringLiteral("string"),
  );

  // String constraints (will go in the else block where TypeScript narrows value to string)
  const constraintChecks: ts.Statement[] = [];

  if (schema.minLength !== undefined) {
    constraintChecks.push(
      createTooSmallIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueExpr, "length"),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minLength),
        ),
        pathExpr,
        factory.createStringLiteral(
          `string with length >= ${schema.minLength}`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("string with length "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(valueExpr, "length"),
              factory.createTemplateTail(""),
            ),
          ],
        ),
      ),
    );
  }

  if (schema.maxLength !== undefined) {
    constraintChecks.push(
      createTooBigIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueExpr, "length"),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxLength),
        ),
        pathExpr,
        factory.createStringLiteral(
          `string with length <= ${schema.maxLength}`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("string with length "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(valueExpr, "length"),
              factory.createTemplateTail(""),
            ),
          ],
        ),
      ),
    );
  }

  if (schema.pattern) {
    try {
      // Validate pattern at build time
      new RegExp(schema.pattern);

      const escapedPattern = schema.pattern.replace(/\//g, "\\/");
      const regex = factory.createRegularExpressionLiteral(
        `/${escapedPattern}/`,
      );

      constraintChecks.push(
        createInvalidStringIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createCallExpression(
              factory.createPropertyAccessExpression(regex, "test"),
              undefined,
              [valueExpr],
            ),
          ),
          pathExpr,
          factory.createStringLiteral(
            `string matching pattern /${schema.pattern}/`,
          ),
          valueExpr,
        ),
      );
    } catch (_error) {
      console.warn(`Invalid regex pattern in schema: ${schema.pattern}`);
    }
  }

  // Create if-else structure: if (typeof value !== "string") { error } else { constraints }
  // This allows TypeScript to narrow the type in the else block
  statements.push(
    factory.createIfStatement(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        factory.createParenthesizedExpression(isStringCheck),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createIdentifier("_invalidType"),
              undefined,
              [
                factory.createIdentifier("issues"),
                pathExpr,
                factory.createStringLiteral("string"),
                valueExpr,
              ],
            ),
          ),
          createAbortEarlyReturn(),
        ],
        true,
      ),
      constraintChecks.length > 0
        ? factory.createBlock(constraintChecks, true)
        : undefined,
    ),
  );
}

function generateNumberChecks(
  schema: JsonSchema,
  type: string,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  _varCounter: { count: number },
): void {
  // Create type check condition: typeof value === "number"
  const isNumberCheck = factory.createBinaryExpression(
    factory.createTypeOfExpression(valueExpr),
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    factory.createStringLiteral("number"),
  );

  const constraintChecks: ts.Statement[] = [];

  // Integer check
  if (type === "integer") {
    constraintChecks.push(
      createNotIntegerIf(
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
        pathExpr,
        valueExpr,
      ),
    );
  }

  // Number constraints (no casts needed - TypeScript narrows in else block)
  if (schema.minimum !== undefined) {
    constraintChecks.push(
      createTooSmallIf(
        factory.createBinaryExpression(
          valueExpr,
          ts.SyntaxKind.LessThanToken,
          createNumericLiteralExpression(schema.minimum),
        ),
        pathExpr,
        factory.createStringLiteral(`number >= ${schema.minimum}`),
        factory.createCallExpression(
          factory.createIdentifier("String"),
          undefined,
          [valueExpr],
        ),
      ),
    );
  }

  if (schema.maximum !== undefined) {
    constraintChecks.push(
      createTooBigIf(
        factory.createBinaryExpression(
          valueExpr,
          ts.SyntaxKind.GreaterThanToken,
          createNumericLiteralExpression(schema.maximum),
        ),
        pathExpr,
        factory.createStringLiteral(`number <= ${schema.maximum}`),
        factory.createCallExpression(
          factory.createIdentifier("String"),
          undefined,
          [valueExpr],
        ),
      ),
    );
  }

  if (schema.exclusiveMinimum !== undefined) {
    if (typeof schema.exclusiveMinimum === "number") {
      constraintChecks.push(
        createTooSmallIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.LessThanEqualsToken,
            createNumericLiteralExpression(schema.exclusiveMinimum),
          ),
          pathExpr,
          factory.createStringLiteral(`number > ${schema.exclusiveMinimum}`),
          factory.createCallExpression(
            factory.createIdentifier("String"),
            undefined,
            [valueExpr],
          ),
        ),
      );
    } else if (
      schema.exclusiveMinimum === true &&
      schema.minimum !== undefined
    ) {
      constraintChecks.push(
        createTooSmallIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.LessThanEqualsToken,
            createNumericLiteralExpression(schema.minimum),
          ),
          pathExpr,
          factory.createStringLiteral(`number > ${schema.minimum}`),
          factory.createCallExpression(
            factory.createIdentifier("String"),
            undefined,
            [valueExpr],
          ),
        ),
      );
    }
  }

  if (schema.exclusiveMaximum !== undefined) {
    if (typeof schema.exclusiveMaximum === "number") {
      constraintChecks.push(
        createTooBigIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.GreaterThanEqualsToken,
            createNumericLiteralExpression(schema.exclusiveMaximum),
          ),
          pathExpr,
          factory.createStringLiteral(`number < ${schema.exclusiveMaximum}`),
          factory.createCallExpression(
            factory.createIdentifier("String"),
            undefined,
            [valueExpr],
          ),
        ),
      );
    } else if (
      schema.exclusiveMaximum === true &&
      schema.maximum !== undefined
    ) {
      constraintChecks.push(
        createTooBigIf(
          factory.createBinaryExpression(
            valueExpr,
            ts.SyntaxKind.GreaterThanEqualsToken,
            createNumericLiteralExpression(schema.maximum),
          ),
          pathExpr,
          factory.createStringLiteral(`number < ${schema.maximum}`),
          factory.createCallExpression(
            factory.createIdentifier("String"),
            undefined,
            [valueExpr],
          ),
        ),
      );
    }
  }

  // Create if-else structure: if (typeof value !== "number") { error } else { constraints }
  // This allows TypeScript to narrow the type in the else block
  statements.push(
    factory.createIfStatement(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        factory.createParenthesizedExpression(isNumberCheck),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createIdentifier("_invalidType"),
              undefined,
              [
                factory.createIdentifier("issues"),
                pathExpr,
                factory.createStringLiteral(type),
                valueExpr,
              ],
            ),
          ),
          createAbortEarlyReturn(),
        ],
        true,
      ),
      constraintChecks.length > 0
        ? factory.createBlock(constraintChecks, true)
        : undefined,
    ),
  );
}

function generateArrayChecks(
  node: SchemaNode,
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  // Create Array.isArray check condition
  const isArrayCheck = factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createIdentifier("Array"),
      "isArray",
    ),
    undefined,
    [valueExpr],
  );

  const arrayChecks: ts.Statement[] = [];

  // Generate array-specific checks (will go in the else block)
  const tupleInfo = getTupleInfo(node, schema);

  if (tupleInfo.isTuple) {
    generateTupleChecks(
      node,
      schema,
      tupleInfo,
      valueExpr,
      pathExpr,
      arrayChecks,
      visited,
      varCounter,
      generatedTypes,
    );
  } else {
    // Regular array checks
    generateRegularArrayChecks(
      node,
      schema,
      valueExpr,
      pathExpr,
      arrayChecks,
      visited,
      varCounter,
      generatedTypes,
    );
  }

  // Create if-else structure: if (!Array.isArray(value)) { error } else { checks }
  // This allows TypeScript to narrow the type in the else block
  statements.push(
    factory.createIfStatement(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        isArrayCheck,
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createIdentifier("_invalidType"),
              undefined,
              [
                factory.createIdentifier("issues"),
                pathExpr,
                factory.createStringLiteral("array"),
                valueExpr,
              ],
            ),
          ),
          createAbortEarlyReturn(),
        ],
        true,
      ),
      arrayChecks.length > 0
        ? factory.createBlock(arrayChecks, true)
        : undefined,
    ),
  );
}

function generateTupleChecks(
  node: SchemaNode,
  schema: JsonSchema,
  tupleInfo: ReturnType<typeof getTupleInfo>,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  if (tupleInfo.isDraft2020Tuple && tupleInfo.prefixItems) {
    if (tupleInfo.isFixedLength) {
      statements.push(
        createInvalidTypeExprIf(
          factory.createBinaryExpression(
            factory.createPropertyAccessExpression(valueExpr, "length"),
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
            factory.createNumericLiteral(tupleInfo.prefixItems.length),
          ),
          pathExpr,
          factory.createStringLiteral(
            `tuple with ${tupleInfo.prefixItems.length} elements`,
          ),
          factory.createTemplateExpression(
            factory.createTemplateHead("array with "),
            [
              factory.createTemplateSpan(
                factory.createPropertyAccessExpression(valueExpr, "length"),
                factory.createTemplateTail(" elements"),
              ),
            ],
          ),
        ),
      );
    } else {
      addArrayConstraintChecks(schema, valueExpr, pathExpr, statements);
    }

    // Validate each prefixItems element
    tupleInfo.prefixItems.forEach((itemNode, index) => {
      const elementAccess = factory.createElementAccessExpression(
        valueExpr,
        factory.createNumericLiteral(index),
      );
      const elementPath = createPathWithElement(
        pathExpr,
        factory.createNumericLiteral(index),
      );
      generateChecks(
        itemNode,
        elementAccess,
        elementPath,
        statements,
        visited,
        varCounter,
        generatedTypes,
      );
    });

    // Validate remaining elements if items schema exists
    if (schema.items && !Array.isArray(schema.items) && node.items) {
      const indexVarName = generateUniqueVarName("i", varCounter);
      const indexVar = factory.createIdentifier(indexVarName);
      const itemStatements: ts.Statement[] = [];

      const elementAccess = factory.createElementAccessExpression(
        valueExpr,
        indexVar,
      );
      const elementPath = createPathWithElement(pathExpr, indexVar);

      generateChecks(
        node.items,
        elementAccess,
        elementPath,
        itemStatements,
        visited,
        varCounter,
        generatedTypes,
      );

      if (itemStatements.length > 0) {
        statements.push(
          factory.createForStatement(
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  indexVar,
                  undefined,
                  undefined,
                  factory.createNumericLiteral(tupleInfo.prefixItems.length),
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
          ),
        );
      }
    }
  } else if (tupleInfo.isDraft07Tuple && tupleInfo.itemSchemas) {
    statements.push(
      createInvalidTypeExprIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueExpr, "length"),
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          factory.createNumericLiteral(tupleInfo.itemSchemas.length),
        ),
        pathExpr,
        factory.createStringLiteral(
          `tuple with ${tupleInfo.itemSchemas.length} elements`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("array with "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(valueExpr, "length"),
              factory.createTemplateTail(" elements"),
            ),
          ],
        ),
      ),
    );

    tupleInfo.itemSchemas.forEach((itemSchema, index) => {
      const elementAccess = factory.createElementAccessExpression(
        valueExpr,
        factory.createNumericLiteral(index),
      );
      const elementPath = createPathWithElement(
        pathExpr,
        factory.createNumericLiteral(index),
      );
      const itemNode = node.compileSchema(itemSchema);
      generateChecks(
        itemNode,
        elementAccess,
        elementPath,
        statements,
        visited,
        varCounter,
        generatedTypes,
      );
    });
  }
}

function generateRegularArrayChecks(
  node: SchemaNode,
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  addArrayConstraintChecks(schema, valueExpr, pathExpr, statements);

  // Validate all elements against the same items schema
  if (schema.items && node.items) {
    const indexVarName = generateUniqueVarName("i", varCounter);
    const indexVar = factory.createIdentifier(indexVarName);
    const itemStatements: ts.Statement[] = [];

    const elementAccess = factory.createElementAccessExpression(
      valueExpr,
      indexVar,
    );
    const elementPath = createPathWithElement(pathExpr, indexVar);

    generateChecks(
      node.items,
      elementAccess,
      elementPath,
      itemStatements,
      visited,
      varCounter,
      generatedTypes,
    );

    if (itemStatements.length > 0) {
      statements.push(
        factory.createForStatement(
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                indexVar,
                undefined,
                undefined,
                factory.createNumericLiteral(0),
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
        ),
      );
    }
  }
}

function addArrayConstraintChecks(
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
): void {
  if (schema.minItems !== undefined) {
    statements.push(
      createTooSmallIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueExpr, "length"),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minItems),
        ),
        pathExpr,
        factory.createStringLiteral(
          `array with at least ${schema.minItems} items`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("array with "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(valueExpr, "length"),
              factory.createTemplateTail(" items"),
            ),
          ],
        ),
      ),
    );
  }

  if (schema.maxItems !== undefined) {
    statements.push(
      createTooBigIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(valueExpr, "length"),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxItems),
        ),
        pathExpr,
        factory.createStringLiteral(
          `array with at most ${schema.maxItems} items`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("array with "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(valueExpr, "length"),
              factory.createTemplateTail(" items"),
            ),
          ],
        ),
      ),
    );
  }

  if (schema.uniqueItems) {
    statements.push(
      createNotUniqueIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createNewExpression(
              factory.createIdentifier("Set"),
              undefined,
              [valueExpr],
            ),
            "size",
          ),
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          factory.createPropertyAccessExpression(valueExpr, "length"),
        ),
        pathExpr,
      ),
    );
  }
}

function generateObjectChecks(
  node: SchemaNode,
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  visited: WeakSet<SchemaNode>,
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  // Create object check condition: typeof value === "object" && value !== null && !Array.isArray(value)
  const isObjectCheck = factory.createBinaryExpression(
    factory.createBinaryExpression(
      factory.createBinaryExpression(
        factory.createTypeOfExpression(valueExpr),
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        factory.createStringLiteral("object"),
      ),
      ts.SyntaxKind.AmpersandAmpersandToken,
      factory.createBinaryExpression(
        valueExpr,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        factory.createNull(),
      ),
    ),
    ts.SyntaxKind.AmpersandAmpersandToken,
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
  );

  const objectChecks: ts.Statement[] = [];

  // Object constraint checks (uses valueExpr directly, relies on in-operator narrowing)
  addObjectConstraintChecks(schema, valueExpr, pathExpr, objectChecks);

  // Required properties check
  if (schema.required && schema.required.length > 0) {
    for (const prop of schema.required) {
      objectChecks.push(
        createMissingKeyIf(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createParenthesizedExpression(
              factory.createBinaryExpression(
                factory.createStringLiteral(prop),
                ts.SyntaxKind.InKeyword,
                valueExpr,
              ),
            ),
          ),
          pathExpr,
          prop,
        ),
      );
    }
  }

  // Property validation
  // All property access must be wrapped in "prop" in value check for TypeScript narrowing
  if (schema.properties && node.properties) {
    for (const [prop, propNode] of Object.entries(node.properties)) {
      const propAccess = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop)
        ? factory.createPropertyAccessExpression(valueExpr, prop)
        : factory.createElementAccessExpression(
            valueExpr,
            factory.createStringLiteral(prop),
          );

      const propPath = createPathWithElement(
        pathExpr,
        factory.createStringLiteral(prop),
      );

      const propStatements: ts.Statement[] = [];
      generateChecks(
        propNode,
        propAccess,
        propPath,
        propStatements,
        visited,
        varCounter,
        generatedTypes,
      );

      if (propStatements.length > 0) {
        // Always wrap in "prop" in value check for TypeScript narrowing
        objectChecks.push(
          factory.createIfStatement(
            factory.createBinaryExpression(
              factory.createStringLiteral(prop),
              ts.SyntaxKind.InKeyword,
              valueExpr,
            ),
            factory.createBlock(propStatements, true),
          ),
        );
      }
    }
  }

  // Additional properties check
  if (schema.additionalProperties === false && schema.properties) {
    const knownProps = Object.keys(schema.properties);
    const keyVarName = generateUniqueVarName("key", varCounter);
    const keyVar = factory.createIdentifier(keyVarName);

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

    objectChecks.push(
      factory.createForInStatement(
        factory.createVariableDeclarationList(
          [factory.createVariableDeclaration(keyVar)],
          ts.NodeFlags.Const,
        ),
        valueExpr,
        factory.createBlock(
          [
            createUnrecognizedKeyIf(
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
              createPathWithElement(pathExpr, keyVar),
              factory.createTemplateExpression(
                factory.createTemplateHead("one of known properties ("),
                [
                  factory.createTemplateSpan(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        arrayLiteral,
                        "join",
                      ),
                      undefined,
                      [factory.createStringLiteral(", ")],
                    ),
                    factory.createTemplateTail(")"),
                  ),
                ],
              ),
              keyVar,
            ),
          ],
          true,
        ),
      ),
    );
  }

  // Create if-else structure: if (!isObject) { error } else { checks }
  // This allows TypeScript to narrow the type in the else block
  statements.push(
    factory.createIfStatement(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        factory.createParenthesizedExpression(isObjectCheck),
      ),
      factory.createBlock(
        [
          factory.createExpressionStatement(
            factory.createCallExpression(
              factory.createIdentifier("_invalidType"),
              undefined,
              [
                factory.createIdentifier("issues"),
                pathExpr,
                factory.createStringLiteral("object"),
                valueExpr,
              ],
            ),
          ),
          createAbortEarlyReturn(),
        ],
        true,
      ),
      objectChecks.length > 0
        ? factory.createBlock(objectChecks, true)
        : undefined,
    ),
  );
}

function addObjectConstraintChecks(
  schema: JsonSchema,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
): void {
  if (schema.minProperties !== undefined) {
    statements.push(
      createTooSmallIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("Object"),
                "keys",
              ),
              undefined,
              [valueExpr],
            ),
            "length",
          ),
          ts.SyntaxKind.LessThanToken,
          factory.createNumericLiteral(schema.minProperties),
        ),
        pathExpr,
        factory.createStringLiteral(
          `object with at least ${schema.minProperties} properties`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("object with "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier("Object"),
                    "keys",
                  ),
                  undefined,
                  [valueExpr],
                ),
                "length",
              ),
              factory.createTemplateTail(" properties"),
            ),
          ],
        ),
      ),
    );
  }

  if (schema.maxProperties !== undefined) {
    statements.push(
      createTooBigIf(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createCallExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier("Object"),
                "keys",
              ),
              undefined,
              [valueExpr],
            ),
            "length",
          ),
          ts.SyntaxKind.GreaterThanToken,
          factory.createNumericLiteral(schema.maxProperties),
        ),
        pathExpr,
        factory.createStringLiteral(
          `object with at most ${schema.maxProperties} properties`,
        ),
        factory.createTemplateExpression(
          factory.createTemplateHead("object with "),
          [
            factory.createTemplateSpan(
              factory.createPropertyAccessExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier("Object"),
                    "keys",
                  ),
                  undefined,
                  [valueExpr],
                ),
                "length",
              ),
              factory.createTemplateTail(" properties"),
            ),
          ],
        ),
      ),
    );
  }
}

function generateOneOfChecks(
  node: SchemaNode,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  if (!node.oneOf) return;

  const matchCountVarName = generateUniqueVarName("_matchCount", varCounter);
  statements.push(
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            matchCountVarName,
            undefined,
            undefined,
            factory.createNumericLiteral(0),
          ),
        ],
        ts.NodeFlags.Let,
      ),
    ),
  );

  for (const subNode of node.oneOf) {
    const subStatements: ts.Statement[] = [];
    const subVisited = new WeakSet<SchemaNode>();
    const subIssuesVarName = generateUniqueVarName("_subIssues", varCounter);

    // Create temp issues array
    subStatements.push(
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              subIssuesVarName,
              undefined,
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode("ValidationIssue", undefined),
              ),
              factory.createArrayLiteralExpression([]),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    );

    // Use temp issues in validation - we need to temporarily swap issues
    // This is complex, so we'll use an IIFE approach
    const tempStatements: ts.Statement[] = [];
    generateChecks(
      subNode,
      valueExpr,
      pathExpr,
      tempStatements,
      subVisited,
      varCounter,
      generatedTypes,
    );

    // Check if validation succeeded (no issues in temp array)
    const iifeBody = [
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              "_tempIssues",
              undefined,
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode("ValidationIssue", undefined),
              ),
              factory.createArrayLiteralExpression([]),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
      ...tempStatements.map((stmt) =>
        replaceIssuesReference(stmt, "_tempIssues"),
      ),
      factory.createReturnStatement(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("_tempIssues"),
            "length",
          ),
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          factory.createNumericLiteral(0),
        ),
      ),
    ];

    const iife = factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          factory.createBlock(iifeBody, true),
        ),
      ),
      undefined,
      [],
    );

    statements.push(
      factory.createIfStatement(
        iife,
        factory.createBlock(
          [
            factory.createExpressionStatement(
              factory.createPostfixUnaryExpression(
                factory.createIdentifier(matchCountVarName),
                ts.SyntaxKind.PlusPlusToken,
              ),
            ),
          ],
          true,
        ),
      ),
    );
  }

  // Check match count
  statements.push(
    createInvalidTypeExprIf(
      factory.createBinaryExpression(
        factory.createIdentifier(matchCountVarName),
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        factory.createNumericLiteral(1),
      ),
      pathExpr,
      factory.createStringLiteral("value matching exactly one schema"),
      factory.createTemplateExpression(
        factory.createTemplateHead("value matching "),
        [
          factory.createTemplateSpan(
            factory.createIdentifier(matchCountVarName),
            factory.createTemplateTail(" schemas"),
          ),
        ],
      ),
    ),
  );
}

function generateAnyOfChecks(
  node: SchemaNode,
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
  varCounter: { count: number },
  generatedTypes: Map<string, string>,
): void {
  if (!node.anyOf) return;

  const matchedVarName = generateUniqueVarName("_anyOfMatched", varCounter);
  statements.push(
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            matchedVarName,
            undefined,
            undefined,
            factory.createFalse(),
          ),
        ],
        ts.NodeFlags.Let,
      ),
    ),
  );

  for (const subNode of node.anyOf) {
    const tempStatements: ts.Statement[] = [];
    const subVisited = new WeakSet<SchemaNode>();
    generateChecks(
      subNode,
      valueExpr,
      pathExpr,
      tempStatements,
      subVisited,
      varCounter,
      generatedTypes,
    );

    const iifeBody = [
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              "_tempIssues",
              undefined,
              factory.createArrayTypeNode(
                factory.createTypeReferenceNode("ValidationIssue", undefined),
              ),
              factory.createArrayLiteralExpression([]),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
      ...tempStatements.map((stmt) =>
        replaceIssuesReference(stmt, "_tempIssues"),
      ),
      factory.createReturnStatement(
        factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("_tempIssues"),
            "length",
          ),
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          factory.createNumericLiteral(0),
        ),
      ),
    ];

    const iife = factory.createCallExpression(
      factory.createParenthesizedExpression(
        factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          factory.createBlock(iifeBody, true),
        ),
      ),
      undefined,
      [],
    );

    statements.push(
      factory.createIfStatement(
        factory.createBinaryExpression(
          factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            factory.createIdentifier(matchedVarName),
          ),
          ts.SyntaxKind.AmpersandAmpersandToken,
          iife,
        ),
        factory.createBlock(
          [
            factory.createExpressionStatement(
              factory.createBinaryExpression(
                factory.createIdentifier(matchedVarName),
                ts.SyntaxKind.EqualsToken,
                factory.createTrue(),
              ),
            ),
          ],
          true,
        ),
      ),
    );
  }

  statements.push(
    createInvalidTypeExprIf(
      factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        factory.createIdentifier(matchedVarName),
      ),
      pathExpr,
      factory.createStringLiteral("value matching at least one schema"),
      factory.createStringLiteral("value matching no schemas"),
    ),
  );
}

function generateUnionTypeChecks(
  types: string[],
  valueExpr: ts.Expression,
  pathExpr: ts.Expression,
  statements: ts.Statement[],
): void {
  const conditions: ts.Expression[] = [];
  for (const t of types) {
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
    const combined = conditions.reduce((acc, cond) =>
      factory.createBinaryExpression(acc, ts.SyntaxKind.BarBarToken, cond),
    );

    statements.push(
      createInvalidTypeIf(
        factory.createPrefixUnaryExpression(
          ts.SyntaxKind.ExclamationToken,
          factory.createParenthesizedExpression(combined),
        ),
        pathExpr,
        types.join(" | "),
        valueExpr,
      ),
    );
  }
}

// Helper function to replace references to "issues" with a different variable
function replaceIssuesReference(
  stmt: ts.Statement,
  newName: string,
): ts.Statement {
  const transformer: ts.TransformerFactory<ts.Statement> = (context) => {
    const visit: ts.Visitor = (node) => {
      if (ts.isIdentifier(node) && node.text === "issues") {
        return factory.createIdentifier(newName);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => {
      const result = ts.visitNode(node, visit);
      return result as ts.Statement;
    };
  };

  const result = ts.transform(stmt, [transformer]);
  const transformed = result.transformed[0];
  result.dispose();
  return transformed ?? stmt;
}

// Helper factory functions for each error type
function createInvalidTypeIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expected: string,
  valueExpr: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_invalidType"),
            undefined,
            [
              factory.createIdentifier("issues"),
              pathExpr,
              factory.createStringLiteral(expected),
              valueExpr,
            ],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

// Variant that takes expected/received as expressions (for special cases like tuple length)
function createInvalidTypeExprIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expectedExpr: ts.Expression,
  receivedExpr: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier("issues"),
              "push",
            ),
            undefined,
            [
              factory.createObjectLiteralExpression([
                factory.createPropertyAssignment(
                  "code",
                  factory.createStringLiteral("invalid_type"),
                ),
                factory.createPropertyAssignment("path", pathExpr),
                factory.createPropertyAssignment(
                  "message",
                  factory.createTemplateExpression(
                    factory.createTemplateHead("Expected "),
                    [
                      factory.createTemplateSpan(
                        expectedExpr,
                        factory.createTemplateMiddle(", received "),
                      ),
                      factory.createTemplateSpan(
                        receivedExpr,
                        factory.createTemplateTail(""),
                      ),
                    ],
                  ),
                ),
                factory.createPropertyAssignment("expected", expectedExpr),
                factory.createPropertyAssignment("received", receivedExpr),
              ]),
            ],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createMissingKeyIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  key: string,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_missingKey"),
            undefined,
            [
              factory.createIdentifier("issues"),
              pathExpr,
              factory.createStringLiteral(key),
            ],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createTooSmallIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expected: ts.Expression,
  received: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_tooSmall"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr, expected, received],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createTooBigIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expected: ts.Expression,
  received: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_tooBig"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr, expected, received],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createInvalidStringIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expected: ts.Expression,
  received: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_invalidString"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr, expected, received],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createInvalidValueIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expected: ts.Expression,
  received: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_invalidValue"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr, expected, received],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createNotIntegerIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  valueExpr: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_notInteger"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr, valueExpr],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createNotUniqueIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_notUnique"),
            undefined,
            [factory.createIdentifier("issues"), pathExpr],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createUnrecognizedKeyIf(
  condition: ts.Expression,
  pathExpr: ts.Expression,
  expectedExpr: ts.Expression,
  keyExpr: ts.Expression,
): ts.Statement {
  return factory.createIfStatement(
    condition,
    factory.createBlock(
      [
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier("_unrecognizedKey"),
            undefined,
            [
              factory.createIdentifier("issues"),
              pathExpr,
              expectedExpr,
              keyExpr,
            ],
          ),
        ),
        createAbortEarlyReturn(),
      ],
      true,
    ),
  );
}

function createAbortEarlyReturn(): ts.Statement {
  return factory.createIfStatement(
    factory.createIdentifier("abortEarly"),
    factory.createReturnStatement(
      factory.createObjectLiteralExpression([
        factory.createPropertyAssignment("success", factory.createFalse()),
        factory.createShorthandPropertyAssignment("issues"),
      ]),
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

function createNumericLiteralExpression(value: number): ts.Expression {
  if (value < 0) {
    return factory.createPrefixUnaryExpression(
      ts.SyntaxKind.MinusToken,
      factory.createNumericLiteral(Math.abs(value)),
    );
  }
  return factory.createNumericLiteral(value);
}

function normalizeType(type?: string | string[]): string {
  if (!type) return "any";
  if (Array.isArray(type)) {
    return type.length === 1 ? normalizeType(type[0]) : "union";
  }
  return type;
}

/**
 * Create a path expression by adding an element to the parent path.
 * Optimizes by avoiding spread when parent is an array literal.
 */
function createPathWithElement(
  parentPath: ts.Expression,
  element: ts.Expression,
): ts.Expression {
  if (ts.isArrayLiteralExpression(parentPath)) {
    // Parent is array literal - add element directly
    return factory.createArrayLiteralExpression([
      ...parentPath.elements,
      element,
    ]);
  }
  // Parent is a variable reference - need spread
  return factory.createArrayLiteralExpression([
    factory.createSpreadElement(parentPath),
    element,
  ]);
}

function generateUniqueVarName(
  baseName: string,
  counter: { count: number },
): string {
  counter.count++;
  return `${baseName}${counter.count}`;
}
