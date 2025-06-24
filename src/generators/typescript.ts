import type { SchemaNode } from "json-schema-library";
import ts from "typescript";

const { factory } = ts;

interface TypeGenOptions {
  namespace?: string;
}

export function generateTypeScript(
  node: SchemaNode,
  typeName: string,
  options: TypeGenOptions = {},
): string {
  const typeNode = generateTypeNode(node);

  // Create type alias declaration
  const typeAlias = factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    typeName,
    undefined,
    typeNode,
  );

  let statements: ts.Statement[] = [typeAlias];

  // Wrap in namespace if specified
  if (options.namespace) {
    const namespaceDecl = factory.createModuleDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(options.namespace),
      factory.createModuleBlock(statements),
      ts.NodeFlags.Namespace,
    );
    statements = [namespaceDecl];
  }

  // Create source file and print
  const sourceFile = factory.createSourceFile(
    statements,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });

  const result = printer.printFile(sourceFile);

  // Add comment for non-namespace exports
  if (!options.namespace) {
    return `// Auto-generated type definition\n${result}`;
  }

  return result;
}

function generateTypeNode(node: SchemaNode): ts.TypeNode {
  const schema = node.schema;

  // Handle missing schema
  if (!schema) {
    return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  // Handle const
  if (schema.const !== undefined) {
    return createLiteralTypeNode(schema.const);
  }

  // Handle enum
  if (schema.enum) {
    const types = schema.enum.map((v: unknown) => createLiteralTypeNode(v));
    return factory.createUnionTypeNode(types);
  }

  // Handle combinators
  if (schema.oneOf && node.oneOf) {
    const types: ts.TypeNode[] = [];
    node.oneOf.forEach((subNode) => {
      types.push(generateTypeNode(subNode));
    });
    return types.length > 0
      ? factory.createUnionTypeNode(types)
      : factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  if (schema.anyOf && node.anyOf) {
    const types: ts.TypeNode[] = [];
    node.anyOf.forEach((subNode) => {
      types.push(generateTypeNode(subNode));
    });
    return types.length > 0
      ? factory.createUnionTypeNode(types)
      : factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  if (schema.allOf && node.allOf) {
    const types: ts.TypeNode[] = [];
    node.allOf.forEach((subNode) => {
      types.push(generateTypeNode(subNode));
    });
    return types.length > 0
      ? factory.createIntersectionTypeNode(types)
      : factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  // Handle $ref
  if (schema.$ref) {
    // Try to resolve using the root node's getNode method
    try {
      const rootNode = node.getNodeRoot();
      const { node: refNode } = rootNode.getNode(schema.$ref);
      if (refNode?.schema) {
        return generateTypeNode(refNode);
      }
    } catch (_error) {
      // Root getNode failed, continue to manual resolution
    }

    // Try alternative: manually parse the reference
    if (schema.$ref.startsWith("#/definitions/")) {
      const defName = schema.$ref.replace("#/definitions/", "");

      // Get the root schema and look for definitions
      const rootNode = node.getNodeRoot();
      const rootSchema = rootNode.schema;

      if (rootSchema?.definitions?.[defName]) {
        // Create a new node for this definition
        try {
          const definitionNode = rootNode.compileSchema(
            rootSchema.definitions[defName],
          );
          return generateTypeNode(definitionNode);
        } catch (_error) {
          // Failed to compile definition, continue to unknown
        }
      }
    }

    // If we can't resolve the reference, return unknown
    return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  // Handle basic types
  const type = normalizeType(schema.type);

  switch (type) {
    case "string":
      return factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);

    case "number":
    case "integer":
      return factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);

    case "boolean":
      return factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);

    case "null":
      return factory.createLiteralTypeNode(factory.createNull());

    case "array":
      if (schema.items && node.items) {
        const itemType = generateTypeNode(node.items);
        return factory.createArrayTypeNode(itemType);
      }
      return factory.createArrayTypeNode(
        factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
      );

    case "object": {
      if (!schema.properties) {
        return factory.createTypeReferenceNode("Record", [
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        ]);
      }

      const members: ts.TypeElement[] = [];
      if (node.properties) {
        for (const [key, propNode] of Object.entries(node.properties)) {
          const isRequired = schema.required?.includes(key);
          const propType = generateTypeNode(propNode);

          const propertySignature = factory.createPropertySignature(
            undefined,
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
              ? key
              : factory.createStringLiteral(key),
            isRequired
              ? undefined
              : factory.createToken(ts.SyntaxKind.QuestionToken),
            propType,
          );

          members.push(propertySignature);
        }
      }

      return factory.createTypeLiteralNode(members);
    }

    case "union":
      // Handle type arrays like ["string", "null"]
      if (Array.isArray(schema.type)) {
        const types = schema.type.map((t) => {
          const tempNode = { ...node, schema: { ...schema, type: t } };
          return generateTypeNode(tempNode as SchemaNode);
        });
        return factory.createUnionTypeNode(types);
      }
      return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);

    default:
      return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }
}

function createLiteralTypeNode(value: unknown): ts.TypeNode {
  if (typeof value === "string") {
    return factory.createLiteralTypeNode(factory.createStringLiteral(value));
  } else if (typeof value === "number") {
    return factory.createLiteralTypeNode(factory.createNumericLiteral(value));
  } else if (typeof value === "boolean") {
    return factory.createLiteralTypeNode(
      value ? factory.createTrue() : factory.createFalse(),
    );
  } else if (value === null) {
    return factory.createLiteralTypeNode(factory.createNull());
  }
  return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}

function normalizeType(type?: string | string[]): string {
  if (!type) return "any";
  if (Array.isArray(type)) {
    return type.length === 1 ? normalizeType(type[0]) : "union";
  }
  return type;
}
