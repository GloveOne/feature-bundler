import * as fs from "fs-extra";
import * as path from "path";
import glob from "glob";

// Parse CLI arguments for --depth
let depthArg = 1;
const fileArgs: string[] = [];
process.argv.slice(2).forEach((arg) => {
  if (arg.startsWith("--depth=")) {
    const val = parseInt(arg.split("=")[1], 10);
    if (!isNaN(val) && val > 0) depthArg = val;
  } else {
    fileArgs.push(arg);
  }
});

if (fileArgs.length === 0) {
  console.error(
    "Usage: ts-node bundleFeature.ts [--depth=N] <file1> <file2> ..."
  );
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

// Reference regexes
const referenceRegexes = [
  /import\s+.*?from\s+['"](.+?)['"]/g, // JS/TS import
  /require\(['"](.+?)['"]\)/g, // JS/TS require
  /require_relative\s+['"](.+?)['"]/g, // Ruby require_relative
];

// Recursively find all referenced files up to a given depth
function findReferences(
  files: string[],
  maxDepth: number,
  seen: Set<string>
): Set<string> {
  const referenced = new Set<string>();
  function helper(currentFiles: string[], depth: number) {
    if (depth > maxDepth) return;
    for (const file of currentFiles) {
      if (!fs.existsSync(file) || seen.has(path.resolve(file))) continue;
      seen.add(path.resolve(file));
      const content = fs.readFileSync(file, "utf8");
      for (const regex of referenceRegexes) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          let ref = match[1];
          if (ref.startsWith(".")) {
            const resolved = path.resolve(path.dirname(file), ref);
            if (fs.existsSync(resolved)) {
              if (!seen.has(path.resolve(resolved))) {
                referenced.add(resolved);
                helper([resolved], depth + 1);
              }
            } else {
              // Try with common extensions
              const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
              for (const ext of exts) {
                if (fs.existsSync(resolved + ext)) {
                  if (!seen.has(path.resolve(resolved + ext))) {
                    referenced.add(resolved + ext);
                    helper([resolved + ext], depth + 1);
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
  }
  helper(files, 1);
  return referenced;
}

// 1. Copy selected files
fs.ensureDirSync(CONTEXT_DIR);
fileArgs.forEach((file) => {
  copyFileWithMap(file, CONTEXT_DIR);
});

// 2. Find all referenced files recursively
const seenFiles = new Set<string>(fileArgs.map((f) => path.resolve(f)));
const referencedFiles = findReferences(fileArgs, depthArg, seenFiles);

// 3. Copy referenced files/directories recursively
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

// 4. Recursively collect all files in CONTEXT_DIR
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
// Sort files by their original folder and filename
const allFilesWithOriginal = allFiles.map((file) => {
  const original = contextToOriginal[path.resolve(file)] || file;
  return { file, original };
});
allFilesWithOriginal.sort((a, b) => {
  const aDir = path.dirname(a.original);
  const bDir = path.dirname(b.original);
  if (aDir === bDir) {
    return a.original.localeCompare(b.original);
  }
  return aDir.localeCompare(bDir);
});

let lastDir = "";
const output = allFilesWithOriginal
  .map(({ file, original }) => {
    const dir = path.dirname(original);
    let section = "";
    if (dir !== lastDir) {
      section = `\n===== ${dir}/ =====\n`;
      lastDir = dir;
    }
    const content = fs.readFileSync(file, "utf8");
    return `${section}\n==================== ${original} ====================\n\n${content}`;
  })
  .join("\n");

fs.writeFileSync(OUTPUT_FILE, output);

console.log(`Done! Output written to ${OUTPUT_FILE}`);
