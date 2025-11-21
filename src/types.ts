export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  /** JSON Schema reference paths to generate (e.g., ["#/$defs/User", "#/$defs/Post"]) */
  refs?: string[];
  typeName?: string;
  namespace?: string;
  exportType?: "named" | "default";
}

export interface GenerateResult {
  typeName: string;
  validatorName: string;
  typeDefinition: string;
  validatorCode: string;
}
