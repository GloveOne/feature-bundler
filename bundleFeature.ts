import * as fs from "fs-extra";
import * as path from "path";
import glob from "glob";

// 1. Get file list from command line
const inputFiles = process.argv.slice(2);
if (inputFiles.length === 0) {
  console.error("Usage: ts-node bundleFeature.ts <file1> <file2> ...");
  process.exit(1);
}

const CONTEXT_DIR = "feature-context";
const OUTPUT_FILE = "all_feature_files.txt";
const projectRoot = process.cwd();

// Map from context file absolute path to original relative path
const contextToOriginal: Record<string, string> = {};

// Helper to copy a file and record its mapping
function copyFileWithMap(src: string, destDir: string) {
  const dest = path.join(destDir, path.basename(src));
  fs.copyFileSync(src, dest);
  const relSrc = path.relative(projectRoot, src);
  contextToOriginal[path.resolve(dest)] = relSrc;
}

// Helper to copy a directory recursively and record mappings
function copyDirWithMap(srcDir: string, destDir: string) {
  fs.ensureDirSync(destDir);
  const entries = fs.readdirSync(srcDir);
  entries.forEach((entry) => {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirWithMap(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      const relSrc = path.relative(projectRoot, srcPath);
      contextToOriginal[path.resolve(destPath)] = relSrc;
    }
  });
}

// 2. Copy selected files
fs.ensureDirSync(CONTEXT_DIR);
inputFiles.forEach((file) => {
  copyFileWithMap(file, CONTEXT_DIR);
});

// 3. Parse for references (simple regex for JS/TS/Ruby)
const referenceRegexes = [
  /import\s+.*?from\s+['"](.+?)['"]/g, // JS/TS import
  /require\(['"](.+?)['"]\)/g, // JS/TS require
  /require_relative\s+['"](.+?)['"]/g, // Ruby require_relative
];

const referencedFiles = new Set<string>();

inputFiles.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  referenceRegexes.forEach((regex) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      let ref = match[1];
      // Try to resolve relative paths only (not node_modules or gems)
      if (ref.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), ref);
        if (fs.existsSync(resolved)) {
          referencedFiles.add(resolved);
        } else {
          // Try with common extensions
          const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
          for (const ext of exts) {
            if (fs.existsSync(resolved + ext)) {
              referencedFiles.add(resolved + ext);
              break;
            }
          }
        }
      }
    }
  });
});

// 4. Copy referenced files/directories recursively
referencedFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    if (stats.isFile()) {
      copyFileWithMap(file, CONTEXT_DIR);
    } else if (stats.isDirectory()) {
      const destDir = path.join(CONTEXT_DIR, path.basename(file));
      copyDirWithMap(file, destDir);
    }
  }
});

// 5. Recursively collect all files in CONTEXT_DIR
function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const allFiles = getAllFiles(CONTEXT_DIR);
const output = allFiles
  .map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const original = contextToOriginal[path.resolve(file)] || file;
    return `\n==================== ${original} ====================\n\n${content}`;
  })
  .join("\n");

fs.writeFileSync(OUTPUT_FILE, output);

console.log(`Done! Output written to ${OUTPUT_FILE}`);
