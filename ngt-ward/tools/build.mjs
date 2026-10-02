// Builds the game into two files:
//   dist/index.html  - page fragment (published as a claude.ai Artifact)
//   dist/play.html   - standalone page you can open in any browser, offline except fonts
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(path.join(root, "src", f), "utf8");
const js = ["data.js", "icons.js", "core.js", "world.js", "bedside.js", "ui.js"].map(src).join("\n");
const css = src("style.css");
const fragment = src("shell.html").replace("/*__CSS__*/", () => css).replace("/*__JS__*/", () => `(function(){"use strict";\n${js}\n})();`);

mkdirSync(path.join(root, "dist"), { recursive: true });
writeFileSync(path.join(root, "dist", "index.html"), fragment);
writeFileSync(
  path.join(root, "dist", "play.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n` +
    fragment.replace(/<div id="app">/, "</head>\n<body>\n<div id=\"app\">") +
    `\n</body>\n</html>\n`,
);
console.log(`built dist/index.html (${(fragment.length / 1024).toFixed(1)} KB) and dist/play.html`);
