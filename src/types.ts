export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  typeName?: string;
  namespace?: string;
  exportType?: "named" | "default";
  validatorName?: string;
  minify?: boolean;
}

export interface GenerateResult {
  validatorCode: string;
  typeDefinition: string;
  typeName: string;
  validatorName: string;
}
