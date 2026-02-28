import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["app", "components", "lib", "prisma"];
const fileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".json"]);
const badPatterns = ["пїЅ", "���", "����", "РЎ", "Р°Р", "РёР"];

function shouldScan(filePath) {
  return Array.from(fileExtensions).some((ext) => filePath.endsWith(ext));
}

function walk(dir, found) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, found);
      continue;
    }
    if (shouldScan(fullPath)) {
      found.push(fullPath);
    }
  }
}

const files = [];
for (const root of roots) {
  walk(root, files);
}

const matches = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const pattern of badPatterns) {
    if (content.includes(pattern)) {
      matches.push({ file: relative(process.cwd(), file), pattern });
      break;
    }
  }
}

if (matches.length > 0) {
  console.error("Found possible mojibake patterns:");
  for (const match of matches) {
    console.error(`- ${match.file} (${match.pattern})`);
  }
  process.exit(1);
}

console.log("No mojibake patterns found.");
