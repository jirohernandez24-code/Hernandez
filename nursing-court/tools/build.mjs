// Build: bank.json + src/app.jsx -> dist/NursingCourt.jsx (single-file React artifact)
//        -> dist/index.html (self-contained page for publishing)
// Usage: NODE_PATH=<dir with esbuild, react, react-dom, tailwindcss> node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = process.env.NODE_PATH;
const require = createRequire(path.join(modules, "noop.js"));
const esbuild = require("esbuild");

const dist = path.join(root, "dist");
const tmp = path.join(root, "build");
mkdirSync(dist, { recursive: true });

// 1. Inline the question bank into the single-file component.
const bank = readFileSync(path.join(tmp, "bank.json"), "utf8");
const src = readFileSync(path.join(root, "src", "app.jsx"), "utf8");
if (!src.includes("/*__BANK__*/ null")) throw new Error("bank placeholder missing");
const jsx = src.replace("/*__BANK__*/ null", () => JSON.stringify(JSON.parse(bank)));
writeFileSync(path.join(dist, "NursingCourt.jsx"), jsx);

// 2. Bundle React + component for the standalone page.
writeFileSync(
  path.join(tmp, "main.jsx"),
  `import React from "react";
import { createRoot } from "react-dom/client";
import NursingCourt from "../dist/NursingCourt.jsx";
createRoot(document.getElementById("root")).render(<NursingCourt />);
`
);
const result = await esbuild.build({
  entryPoints: [path.join(tmp, "main.jsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [modules],
  write: false,
  logLevel: "warning",
});
const js = result.outputFiles[0].text;

// 3. Tailwind CSS for exactly the classes the component uses.
writeFileSync(
  path.join(tmp, "tailwind.config.cjs"),
  `module.exports = { content: [${JSON.stringify(path.join(dist, "NursingCourt.jsx"))}], corePlugins: { preflight: true } };`
);
writeFileSync(path.join(tmp, "in.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
execFileSync(
  process.execPath,
  [path.join(modules, "tailwindcss", "lib", "cli.js"), "-c", path.join(tmp, "tailwind.config.cjs"), "-i", path.join(tmp, "in.css"), "-o", path.join(tmp, "out.css"), "--minify"],
  { stdio: "inherit" }
);
const css = readFileSync(path.join(tmp, "out.css"), "utf8");

// 4. window.storage shim: per-viewer private document in the artifact db, memory fallback.
const shim = `
(function(){
  if (window.storage && typeof window.storage.get === "function") return;
  var handle = null;
  function getHandle(){
    if (!handle) handle = (async function(){
      try {
        if (!window.claude || typeof window.claude.use !== "function") return null;
        var parts = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
        var db = parts[0], user = parts[1];
        if (!db || !user) return null;
        var id = await user.id();
        return id ? { db: db, id: id } : null;
      } catch (e) { return null; }
    })();
    return handle;
  }
  function ref(h, key){ return h.db.doc("data/users/" + h.id + "/" + key); }
  window.storage = {
    get: async function(key){
      var h = await getHandle();
      if (!h) throw new Error("storage unavailable");
      var snap = await ref(h, key).get();
      var d = snap.exists ? snap.data() : null;
      return d ? { key: key, value: d.value } : null;
    },
    set: async function(key, value){
      var h = await getHandle();
      if (!h) throw new Error("storage unavailable");
      await ref(h, key).set({ value: value, savedAt: Date.now() });
      return { key: key, value: value };
    }
  };
})();`;

const html = `<title>Nursing Court</title>
<meta name="description" content="A courtroom quiz game for NCM 119-A: conflict management, controlling, standards, ethics, legal responsibilities, and professional development.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;700;800&display=swap">
<style>
:root{--court-blue:#2563EB;--ink:#111827;color-scheme:light}
html,body{background:var(--court-blue);color:var(--ink);margin:0}
${css}
</style>
<div id="root"></div>
<noscript>Nursing Court needs JavaScript to run.</noscript>
<script>${shim}</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
writeFileSync(path.join(dist, "index.html"), html);
console.log(`NursingCourt.jsx ${(jsx.length / 1024).toFixed(0)} KB · index.html ${(html.length / 1024).toFixed(0)} KB`);
