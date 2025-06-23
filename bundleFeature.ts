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
// Set to track already-copied files (absolute original paths)
const copiedFiles = new Set<string>();

// Async helper to copy a file and record its mapping
async function copyFileWithMap(src: string, destDir: string) {
  const absSrc = path.resolve(src);
  if (copiedFiles.has(absSrc)) return; // Deduplicate
  const dest = path.join(destDir, path.basename(src));
  await fs.copy(src, dest);
  const relSrc = path.relative(projectRoot, src);
  contextToOriginal[path.resolve(dest)] = relSrc;
  copiedFiles.add(absSrc);
}

// Async helper to copy a directory recursively and record mappings
async function copyDirWithMap(srcDir: string, destDir: string) {
  await fs.ensureDir(destDir);
  const entries = await fs.readdir(srcDir);
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(srcDir, entry);
      const destPath = path.join(destDir, entry);
      const stat = await fs.stat(srcPath);
      if (stat.isDirectory()) {
        await copyDirWithMap(srcPath, destPath);
      } else {
        await copyFileWithMap(srcPath, destDir);
        // contextToOriginal and copiedFiles handled in copyFileWithMap
      }
    })
  );
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

// Recursively collect all files in CONTEXT_DIR
async function getAllFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  const list = await fs.readdir(dir);
  await Promise.all(
    list.map(async (file) => {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat && stat.isDirectory()) {
        const subFiles = await getAllFiles(filePath);
        results = results.concat(subFiles);
      } else {
        results.push(filePath);
      }
    })
  );
  return results;
}

// Main async logic
async function main() {
  await fs.ensureDir(CONTEXT_DIR);
  await Promise.all(fileArgs.map((file) => copyFileWithMap(file, CONTEXT_DIR)));

  // Find all referenced files recursively
  const seenFiles = new Set<string>(fileArgs.map((f) => path.resolve(f)));
  const referencedFiles = findReferences(fileArgs, depthArg, seenFiles);

  // Copy referenced files/directories recursively in parallel
  await Promise.all(
    Array.from(referencedFiles).map(async (file) => {
      if (await fs.pathExists(file)) {
        const stats = await fs.stat(file);
        if (stats.isFile()) {
          await copyFileWithMap(file, CONTEXT_DIR);
        } else if (stats.isDirectory()) {
          const destDir = path.join(CONTEXT_DIR, path.basename(file));
          await copyDirWithMap(file, destDir);
        }
      }
    })
  );

  // Recursively collect all files in CONTEXT_DIR
  const allFiles = await getAllFiles(CONTEXT_DIR);
  // Deduplicate output files by their resolved path
  const outputSeen = new Set<string>();
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
  const outputArr = await Promise.all(
    allFilesWithOriginal.map(async ({ file, original }) => {
      const resolved = path.resolve(file);
      if (outputSeen.has(resolved)) return ""; // Deduplicate output
      outputSeen.add(resolved);
      const dir = path.dirname(original);
      let section = "";
      if (dir !== lastDir) {
        section = `\n===== ${dir}/ =====\n`;
        lastDir = dir;
      }
      const content = await fs.readFile(file, "utf8");
      return `${section}\n==================== ${original} ====================\n\n${content}`;
    })
  );

  const output = outputArr.filter(Boolean).join("\n");
  await fs.writeFile(OUTPUT_FILE, output);
  console.log(`Done! Output written to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
