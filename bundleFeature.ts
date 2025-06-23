import * as fs from "fs-extra";
import * as path from "path";
import { glob } from "glob";

// Config file support
const CONFIG_FILE = "bundleFeature.config.json";
let configFiles: string[] = [];
let configDepth: number | undefined = undefined;
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (Array.isArray(config.files)) configFiles = config.files;
    if (typeof config.depth === "number" && config.depth > 0)
      configDepth = config.depth;
  } catch (err: any) {
    console.warn(`Warning: Failed to parse ${CONFIG_FILE}: ${err.message}`);
  }
}

let verbose = false;

function logVerbose(msg: string) {
  if (verbose) console.log(msg);
}

// Parse CLI arguments for --depth and --dry-run
let depthArg = configDepth || 1;
let dryRun = false;
const fileArgs: string[] = configFiles.slice();
process.argv.slice(2).forEach((arg) => {
  if (arg.startsWith("--depth=")) {
    const val = parseInt(arg.split("=")[1], 10);
    if (!isNaN(val) && val > 0) depthArg = val;
  } else if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg === "-v" || arg === "--verbose") {
    verbose = true;
  } else if (arg === "--no-cache") {
    useCache = false;
  } else {
    fileArgs.push(arg);
  }
});

if (fileArgs.length === 0) {
  console.error(
    "Usage: ts-node bundleFeature.ts [--depth=N] [--dry-run] <file1> <file2> ... <glob1> <glob2> ...\n" +
      "       or: provide files in bundleFeature.config.json\n" +
      "Examples:\n" +
      "  ts-node bundleFeature.ts src/**/*.ts\n" +
      "  ts-node bundleFeature.ts *.rb app/**/*.rb\n" +
      "  ts-node bundleFeature.ts --depth=3 src/components/*.tsx"
  );
  process.exit(1);
}

// Expand glob patterns to actual file paths
function expandGlobs(patterns: string[]): string[] {
  const expandedFiles: string[] = [];
  const seenFiles = new Set<string>();

  for (const pattern of patterns) {
    try {
      // Check if it's a glob pattern (contains *, ?, [, ], {, })
      const isGlob = /[*?[\]{}]/.test(pattern);

      if (isGlob) {
        const matches = glob.sync(pattern, {
          nodir: true, // Don't include directories
          absolute: false, // Return relative paths
          cwd: process.cwd(), // Use current working directory
        });

        for (const match of matches) {
          const resolvedPath = path.resolve(match);
          if (!seenFiles.has(resolvedPath)) {
            expandedFiles.push(match);
            seenFiles.add(resolvedPath);
          }
        }
      } else {
        // Regular file path
        const resolvedPath = path.resolve(pattern);
        if (!seenFiles.has(resolvedPath)) {
          expandedFiles.push(pattern);
          seenFiles.add(resolvedPath);
        }
      }
    } catch (err: any) {
      warnings.push(
        `Failed to expand glob pattern: ${pattern} (${err.message})`
      );
    }
  }

  return expandedFiles;
}

const CONTEXT_DIR = "feature-context";
const OUTPUT_FILE = "all_feature_files.txt";
const projectRoot = process.cwd();

// Statistics tracking
let stats = {
  startTime: Date.now(),
  filesCopied: 0,
  directoriesCopied: 0,
  totalLines: 0,
  totalSize: 0,
  warnings: 0,
};

// Map from context file absolute path to original relative path
const contextToOriginal: Record<string, string> = {};
// Set to track already-copied files (absolute original paths)
const copiedFiles = new Set<string>();
// Array to collect warnings/errors
const warnings: string[] = [];

const CACHE_FILE = ".bundleFeature.cache.json";

let useCache = true;

interface CacheEntry {
  mtimeMs: number;
  size: number;
}
interface CacheData {
  files: Record<string, CacheEntry>;
  inputHash: string;
}

function hashInput(files: string[], depth: number): string {
  return require("crypto")
    .createHash("sha1")
    .update(JSON.stringify({ files, depth }))
    .digest("hex");
}

function loadCache(): CacheData | null {
  if (!useCache || !fs.existsSync(CACHE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCache(data: CacheData) {
  if (!useCache) return;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

// Async helper to copy a file and record its mapping
async function copyFileWithMap(src: string, destDir: string) {
  const absSrc = path.resolve(src);
  if (copiedFiles.has(absSrc)) {
    logVerbose(`[SKIP] Duplicate file not copied: ${src}`);
    return; // Deduplicate
  }
  const dest = path.join(destDir, path.basename(src));
  try {
    logVerbose(`[COPY] File: ${src} -> ${dest}`);
    await fs.copy(src, dest);
    const relSrc = path.relative(projectRoot, src);
    contextToOriginal[path.resolve(dest)] = relSrc;
    copiedFiles.add(absSrc);
    stats.filesCopied++;
  } catch (err: any) {
    warnings.push(`Failed to copy file: ${src} -> ${dest} (${err.message})`);
    stats.warnings++;
  }
}

// Async helper to copy a directory recursively and record mappings
async function copyDirWithMap(srcDir: string, destDir: string) {
  try {
    logVerbose(`[COPY] Directory: ${srcDir} -> ${destDir}`);
    await fs.ensureDir(destDir);
    stats.directoriesCopied++;
    const entries = await fs.readdir(srcDir);
    await Promise.all(
      entries.map(async (entry) => {
        const srcPath = path.join(srcDir, entry);
        const destPath = path.join(destDir, entry);
        try {
          const stat = await fs.stat(srcPath);
          if (stat.isDirectory()) {
            await copyDirWithMap(srcPath, destPath);
          } else {
            await copyFileWithMap(srcPath, destDir);
          }
        } catch (err: any) {
          warnings.push(`Failed to stat/copy: ${srcPath} (${err.message})`);
          stats.warnings++;
        }
      })
    );
  } catch (err: any) {
    warnings.push(
      `Failed to copy directory: ${srcDir} -> ${destDir} (${err.message})`
    );
    stats.warnings++;
  }
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
      try {
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
                  logVerbose(`[REF] Found reference: ${file} -> ${resolved}`);
                  referenced.add(resolved);
                  helper([resolved], depth + 1);
                }
              } else {
                // Try with common extensions
                const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                for (const ext of exts) {
                  if (fs.existsSync(resolved + ext)) {
                    if (!seen.has(path.resolve(resolved + ext))) {
                      logVerbose(
                        `[REF] Found reference: ${file} -> ${resolved + ext}`
                      );
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
      } catch (err: any) {
        warnings.push(`Failed to process reference: ${file} (${err.message})`);
      }
    }
  }
  helper(files, 1);
  return referenced;
}

// Recursively collect all files in CONTEXT_DIR
async function getAllFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await fs.readdir(dir);
    await Promise.all(
      list.map(async (file) => {
        const filePath = path.join(dir, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat && stat.isDirectory()) {
            const subFiles = await getAllFiles(filePath);
            results = results.concat(subFiles);
          } else {
            results.push(filePath);
          }
        } catch (err: any) {
          warnings.push(`Failed to stat file: ${filePath} (${err.message})`);
        }
      })
    );
  } catch (err: any) {
    warnings.push(`Failed to read directory: ${dir} (${err.message})`);
  }
  return results;
}

// Main async logic
async function main() {
  try {
    // Expand glob patterns to actual file paths
    const expandedFiles = expandGlobs(fileArgs);

    if (expandedFiles.length === 0) {
      console.error("No files found matching the provided patterns.");
      process.exit(1);
    }

    // Load cache and compute input hash
    const inputHash = hashInput(expandedFiles, depthArg);
    const cache = loadCache();
    const cacheFiles =
      cache && cache.inputHash === inputHash ? cache.files : {};
    if (verbose && useCache) {
      if (cache && cache.inputHash === inputHash) {
        console.log(`[CACHE] Loaded cache for this input set.`);
      } else {
        console.log(`[CACHE] No valid cache for this input set.`);
      }
    }

    // Filter files to process based on cache
    const filesToProcess: string[] = [];
    for (const file of expandedFiles) {
      try {
        const stat = await fs.stat(file);
        const cacheEntry = cacheFiles?.[file];
        if (
          cacheEntry &&
          cacheEntry.mtimeMs === stat.mtimeMs &&
          cacheEntry.size === stat.size
        ) {
          logVerbose(`[CACHE] Skipping unchanged file: ${file}`);
          continue;
        }
        filesToProcess.push(file);
      } catch {
        filesToProcess.push(file);
      }
    }

    console.log(
      `Found ${expandedFiles.length} files to process (${filesToProcess.length} new/changed):`
    );
    expandedFiles.forEach((file) => {
      if (filesToProcess.includes(file)) {
        console.log(`  - ${file}`);
      } else if (verbose) {
        console.log(`  - ${file} (cached)`);
      }
    });

    if (dryRun) {
      // Find all referenced files recursively
      const seenFiles = new Set<string>(
        expandedFiles.map((f) => path.resolve(f))
      );
      const referencedFiles = findReferences(
        expandedFiles,
        depthArg,
        seenFiles
      );
      const referencedList = Array.from(referencedFiles);
      if (referencedList.length > 0) {
        console.log("\nReferenced files to copy:");
        referencedList.forEach((file) => console.log(`  - ${file}`));
      }

      // Calculate dry run statistics
      const endTime = Date.now();
      const processingTime = endTime - stats.startTime;
      const totalFiles = expandedFiles.length + referencedList.length;

      console.log(`\n📊 DRY RUN SUMMARY:`);
      console.log(`   Initial files: ${expandedFiles.length}`);
      console.log(`   Referenced files: ${referencedList.length}`);
      console.log(`   Total files to process: ${totalFiles}`);
      console.log(`   Processing time: ${processingTime}ms`);
      console.log(`\nWould write concatenated output to: ${OUTPUT_FILE}`);
      console.log("(No files or directories were actually copied or written.)");
      return;
    }

    await fs.ensureDir(CONTEXT_DIR);
    await Promise.all(
      filesToProcess.map((file) => copyFileWithMap(file, CONTEXT_DIR))
    );

    // Find all referenced files recursively
    const seenFiles = new Set<string>(
      expandedFiles.map((f) => path.resolve(f))
    );
    const referencedFiles = findReferences(expandedFiles, depthArg, seenFiles);

    // Copy referenced files/directories recursively in parallel
    await Promise.all(
      Array.from(referencedFiles).map(async (file) => {
        try {
          if (await fs.pathExists(file)) {
            const stats = await fs.stat(file);
            if (stats.isFile()) {
              await copyFileWithMap(file, CONTEXT_DIR);
            } else if (stats.isDirectory()) {
              const destDir = path.join(CONTEXT_DIR, path.basename(file));
              await copyDirWithMap(file, destDir);
            }
          } else {
            warnings.push(`Referenced file does not exist: ${file}`);
          }
        } catch (err: any) {
          warnings.push(
            `Failed to process referenced file: ${file} (${err.message})`
          );
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
        let content = "";
        try {
          content = await fs.readFile(file, "utf8");
          stats.totalLines += content.split("\n").length;
        } catch (err: any) {
          warnings.push(
            `Failed to read file for output: ${file} (${err.message})`
          );
          stats.warnings++;
        }
        return `${section}\n==================== ${original} ====================\n\n${content}`;
      })
    );

    // Add warnings summary at the top of the output file
    let warningsSection = "";
    if (warnings.length > 0) {
      warningsSection = `/*\nWARNINGS (${warnings.length}):\n${warnings
        .map((w) => "- " + w)
        .join("\n")}\n*/\n\n`;
    }

    const output = warningsSection + outputArr.filter(Boolean).join("\n");
    await fs.writeFile(OUTPUT_FILE, output);

    // Calculate final statistics
    const endTime = Date.now();
    const processingTime = endTime - stats.startTime;
    const outputStats = await fs.stat(OUTPUT_FILE);
    stats.totalSize = outputStats.size;

    // Display summary
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Files copied: ${stats.filesCopied}`);
    console.log(`   Directories copied: ${stats.directoriesCopied}`);
    console.log(`   Total lines written: ${stats.totalLines.toLocaleString()}`);
    console.log(
      `   Output file size: ${(stats.totalSize / 1024).toFixed(2)} KB`
    );
    console.log(`   Processing time: ${processingTime}ms`);
    console.log(`   Warnings: ${stats.warnings}`);
    console.log(`\n✅ Done! Output written to ${OUTPUT_FILE}`);

    if (warnings.length > 0) {
      console.warn("\nWARNINGS:");
      warnings.forEach((w) => console.warn("- " + w));
    }

    // Update cache
    if (useCache) {
      const newCache: CacheData = { files: {}, inputHash };
      for (const file of expandedFiles) {
        try {
          const stat = await fs.stat(file);
          newCache.files[file] = { mtimeMs: stat.mtimeMs, size: stat.size };
        } catch {}
      }
      saveCache(newCache);
      if (verbose) console.log(`[CACHE] Cache updated.`);
    }
  } catch (err: any) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
