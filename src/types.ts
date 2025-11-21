export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  /** JSON Schema target paths to generate (e.g., ["#/$defs/User", "#/$defs/Post"]). Defaults to ["#"] (root) */
  targets?: string[];
  typeName?: string;
}

export interface GenerateResult {
  typeName: string;
  validatorName: string;
  typeDefinition: string;
  validatorCode: string;
}
