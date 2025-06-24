import { $ } from "bun";

async function build() {
  console.log("Building json-schema-validator-gen...");

  // Clean dist directory
  await $`rm -rf dist`;
  await $`mkdir -p dist`;

  // Build main entry point
  await Bun.build({
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    target: "node",
    format: "esm",
    minify: false,
    external: ["fs", "path", "util"],
  });

  // Build CLI
  await Bun.build({
    entrypoints: ["./src/cli.ts"],
    outdir: "./dist",
    target: "node",
    format: "esm",
    minify: false,
    external: ["fs", "path", "util"],
  });

  // Generate type definitions
  await $`tsc --project tsconfig.build.json`;

  // Make CLI executable
  await $`chmod +x dist/cli.js`;

  // Replace Bun shebang with Node.js shebang for compatibility
  const cliContent = await Bun.file("dist/cli.js").text();
  const nodeShebang = "#!/usr/bin/env node\n";
  const updatedContent = cliContent.replace(/^#!.*\n/, nodeShebang);
  await Bun.write("dist/cli.js", updatedContent);

  console.log("✓ Build completed successfully");
}

build().catch(console.error);
