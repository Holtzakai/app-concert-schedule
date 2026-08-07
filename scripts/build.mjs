import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
const assets = ["index.html", "styles.css", "og.png", "src"];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const asset of assets) {
  await fs.cp(path.join(root, asset), path.join(output, asset), { recursive: true });
}
await fs.writeFile(path.join(output, ".nojekyll"), "");
console.log("Static site built in dist/");
