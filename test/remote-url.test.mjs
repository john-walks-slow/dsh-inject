import test from "node:test";
import assert from "node:assert/strict";
import { mirrorUrl } from "../src/remote-url.js";

test("remote-url: raw.githubusercontent.com 换算为 jsDelivr 地址", () => {
  assert.equal(
    mirrorUrl("https://raw.githubusercontent.com/Jia-Ethan/codex-keysmith/main/examples/gpt-unrestricted.md"),
    "https://cdn.jsdelivr.net/gh/Jia-Ethan/codex-keysmith@main/examples/gpt-unrestricted.md"
  );
  assert.equal(
    mirrorUrl("https://raw.githubusercontent.com/o/r/v1.2.3/dir/file.md"),
    "https://cdn.jsdelivr.net/gh/o/r@v1.2.3/dir/file.md"
  );
});

test("remote-url: 其他地址不换算", () => {
  assert.equal(mirrorUrl("https://example.com/file.md"), "");
  assert.equal(mirrorUrl("https://github.com/o/r/blob/main/file.md"), "");
  assert.equal(mirrorUrl(""), "");
});
