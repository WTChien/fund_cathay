const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "script.js"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

