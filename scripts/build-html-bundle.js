import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("dist/index.html not found. Run vite build first.");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

const assetsDir = path.join(distDir, "assets");
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find((f) => f.endsWith(".css"));
  const jsFile = files.find((f) => f.endsWith(".js"));

  if (cssFile) {
    const cssBuffer = fs.readFileSync(path.join(assetsDir, cssFile));
    const cssBase64 = cssBuffer.toString("base64");
    html = html.replace(
      /<link rel="stylesheet"[^>]*>/,
      `<link rel="stylesheet" href="data:text/css;base64,${cssBase64}">`
    );
  }

  if (jsFile) {
    const jsBuffer = fs.readFileSync(path.join(assetsDir, jsFile));
    const jsBase64 = jsBuffer.toString("base64");
    html = html.replace(
      /<script type="module"[^>]*><\/script>/,
      `<script type="module" src="data:text/javascript;base64,${jsBase64}"></script>`
    );
  }
}

// Inject Bootstrap Icons CDN if missing
if (!html.includes("bootstrap-icons")) {
  html = html.replace(
    "</head>",
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"></head>`
  );
}

const targetPath = path.join(__dirname, "../src/bundledHtml.ts");
const tsContent = `// Auto-generated standalone HTML bundle for Android WebView
export const BUNDLED_HTML = ${JSON.stringify(html)};
`;

fs.writeFileSync(targetPath, tsContent, "utf8");
console.log("Successfully generated src/bundledHtml.ts using Data URIs (" + (html.length / 1024).toFixed(1) + " KB)");
