import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

await mkdir("lib", { recursive: true });
await rm("lib/client.bundle.js", { force: true });
await build({
  entryPoints: ["src/client/index.jsx"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  outfile: "lib/client.bundle.js",
  jsx: "automatic",
  target: "es2022",
  charset: "utf8",
  external: ["react", "react-dom", "react-dom/*", "react/jsx-runtime", "@deepseek-ai/*"],
  logLevel: "info"
});
const body = await readFile("lib/client.bundle.js", "utf8");
const wrapped = [
  "window.__ModuleLoader__.load({",
  '\tid: "dsh-inject",',
  "\tfactory: (require) => {",
  "\t\tvar module = { exports: {} };",
  "\t\tvar exports = module.exports;",
  'Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  body,
  "\t\treturn module.exports;",
  "\t}",
  "});"
].join("\n");
await writeFile("lib/client.js", wrapped, "utf8");
await rm("lib/client.bundle.js", { force: true });
console.log("lib/client.js written");
