import { defineConfig } from "tsup";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: ["src/index.ts", "src/client.ts"], // add client entry
  dts: true,
  format: ["esm", "cjs"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
});
