export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  /** JSON Schema reference paths to generate (e.g., ["#/$defs/User", "#/$defs/Post"]) */
  refs?: string[];
  typeName?: string;
  namespace?: string;
  exportType?: "named" | "default";
  validatorName?: string;
  minify?: boolean;
}

export interface GeneratedType {
  typeName: string;
  validatorName: string;
  typeDefinition: string;
  validatorCode: string;
}

export interface GenerateResult {
  // Legacy fields for backward compatibility (single schema generation)
  validatorCode: string;
  typeDefinition: string;
  typeName: string;
  validatorName: string;
  // New field for multiple refs
  types?: GeneratedType[];
}
