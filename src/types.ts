/** Parsed target information */
export interface Target {
  /** JSON Schema path (e.g., "#/$defs/User") */
  path: string;
  /** Optional custom type name */
  name?: string;
}

export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  /** JSON Schema target paths to generate (e.g., ["#/$defs/User", "#/$defs/Post"]). Defaults to ["#"] (root) */
  targets?: string[];
}

export interface GenerateResult {
  typeName: string;
  validatorName: string;
  typeDefinition: string;
  validatorCode: string;
  /** Whether this type/validator should be exported (true if specified in --target) */
  isExported: boolean;
}
