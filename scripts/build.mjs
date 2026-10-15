import { mkdir, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const hostModules = ["index.js", "schema.js", "session-state.js", "transform.js", "command-input.js"];

await mkdir("lib", { recursive: true });
for (const file of hostModules) await copyFile(`src/${file}`, `lib/${file}`);

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/build-client.mjs"], { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`client build exited with ${code}`)));
});
console.log("host and client artifacts written");
