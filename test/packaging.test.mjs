import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 破甲稿与成人预设正文放在独立的 dsh-inject-presets 仓库，由用户显式导入；
// 插件源码里不应再出现这些正文的特征词，否则 npm 的发布扫描会再次拦截。
const BANNED = [
  /ransomware/i,
  /keygen/i,
  /credential[-_ ]stuffing/i,
  /\bAMSI\b/,
  /reverse shell/i,
  /幼年/
];

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test("packaging: 插件源码与构建产物不含破甲 / 成人预设正文", () => {
  const dirs = ["src"];
  try {
    statSync("lib");
    dirs.push("lib");
  } catch {
    // 未构建时只检查源码
  }

  const hits = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});