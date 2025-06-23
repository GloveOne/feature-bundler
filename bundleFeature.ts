import * as fs from "fs-extra";
import * as path from "path";
import { glob } from "glob";

// Config file support
const CONFIG_FILE = "bundleFeature.config.json";
let configFiles: string[] = [];
let configDepth: number | undefined = undefined;
let configAliases: Record<string, string> = {};

// Add this function to expand variables in strings
export function expandVars(str: string, vars: Record<string, string>): string {
  console.log(`🔧 expandVars called with:`, {
    str,
    vars: Object.keys(vars),
    varsCount: Object.keys(vars).length,
  });

  const result = str.replace(/\$\{([^}]+)\}/g, (_, name) => {
    const value = vars[name] || "";
    console.log(`🔧 Variable expansion: ${name} -> ${value}`);
    return value;
  });

  console.log(`🔧 expandVars result:`, result);
  return result;
}

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    if (Array.isArray(config.files)) configFiles = config.files;
    if (typeof config.depth === "number" && config.depth > 0)
      configDepth = config.depth;
    if (config.aliases && typeof config.aliases === "object") {
      configAliases = config.aliases;
    }
    // Expand aliases first
    for (const [key, value] of Object.entries(configAliases)) {
      configAliases[key] = expandVars(value, configAliases);
    }
    // Expand files
    configFiles = configFiles.map((f) => expandVars(f, configAliases));
  } catch (err: any) {
    console.warn(`Warning: Failed to parse ${CONFIG_FILE}: ${err.message}`);
  }
}

let verbose = false;
let useCache = true;

function logVerbose(msg: string) {
  if (verbose) console.log(msg);
}

// Parse CLI arguments for --depth and --dry-run
let depthArg = configDepth || 1;
let dryRun = false;
const fileArgs: string[] = configFiles.slice();

// Add help and version handling
const showHelp = () => {
  console.log(`
Feature Bundler - Bundle related files from your codebase

USAGE:
  ts-node bundleFeature.ts [OPTIONS] <files...>

OPTIONS:
  --help, -h              Show this help message
  --version, -v           Show version information
  --depth=N               Set maximum dependency depth (default: 1)
  --dry-run               Show what would be bundled without writing
  --verbose               Enable verbose logging
  --no-cache              Disable caching
  --output=FILE           Specify output file (default: all_feature_files.txt)

EXAMPLES:
  # Bundle a single file
  ts-node bundleFeature.ts src/components/Button.tsx

  # Bundle multiple files with glob patterns
  ts-node bundleFeature.ts src/**/*.ts lib/**/*.js

  # Bundle with depth control
  ts-node bundleFeature.ts --depth=3 src/main.ts

  # Dry run to see what would be bundled
  ts-node bundleFeature.ts --dry-run src/**/*.tsx

  # Use configuration file
  # Create bundleFeature.config.json with your file patterns
  ts-node bundleFeature.ts

CONFIGURATION:
  Create bundleFeature.config.json to define:
  - files: Array of file patterns to bundle
  - depth: Maximum dependency depth
  - aliases: Path aliases for import resolution

For more information, visit: https://github.com/your-username/feature-bundler
`);
  process.exit(0);
};

const showVersion = () => {
  console.log("Feature Bundler v1.0.0");
  process.exit(0);
};

process.argv.slice(2).forEach((arg) => {
  if (arg === "--help" || arg === "-h") {
    showHelp();
  } else if (arg === "--version" || arg === "-V") {
    showVersion();
  } else if (arg.startsWith("--depth=")) {
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
export function expandGlobs(patterns: string[]): string[] {
  console.log(`🌐 expandGlobs called with patterns:`, patterns);

  const expandedFiles: string[] = [];
  const seenFiles = new Set<string>();

  for (const pattern of patterns) {
    console.log(`🔍 Processing pattern:`, pattern);

    try {
      // Check if it's a glob pattern (contains *, ?, [, ], {, })
      const isGlob = /[*?[\]{}]/.test(pattern);
      console.log(`🔍 Pattern analysis:`, {
        pattern,
        isGlob,
        containsWildcards: isGlob,
      });

      if (isGlob) {
        console.log(`🌐 Expanding glob pattern:`, pattern);
        const matches = glob.sync(pattern, {
          nodir: true, // Don't include directories
          absolute: false, // Return relative paths
          cwd: process.cwd(), // Use current working directory
        });

        console.log(`🌐 Glob matches found:`, {
          count: matches.length,
          matches: matches.map((m) => path.basename(m)),
        });

        for (const match of matches) {
          const resolvedPath = path.resolve(match);
          console.log(`🔍 Processing glob match:`, {
            match,
            resolvedPath,
            alreadySeen: seenFiles.has(resolvedPath),
          });

          if (!seenFiles.has(resolvedPath)) {
            expandedFiles.push(match);
            seenFiles.add(resolvedPath);
            console.log(`✅ Added to expanded files:`, path.basename(match));
          } else {
            console.log(`⏭️  Skipping duplicate:`, path.basename(match));
          }
        }
      } else {
        // Regular file path
        console.log(`📁 Processing regular file path:`, pattern);
        const resolvedPath = path.resolve(pattern);
        console.log(`🔍 Regular file analysis:`, {
          pattern,
          resolvedPath,
          alreadySeen: seenFiles.has(resolvedPath),
        });

        if (!seenFiles.has(resolvedPath)) {
          expandedFiles.push(pattern);
          seenFiles.add(resolvedPath);
          console.log(`✅ Added to expanded files:`, path.basename(pattern));
        } else {
          console.log(`⏭️  Skipping duplicate:`, path.basename(pattern));
        }
      }
    } catch (err: any) {
      console.error(`❌ Failed to expand glob pattern:`, {
        pattern,
        error: err.message,
      });
      warnings.push(
        `Failed to expand glob pattern: ${pattern} (${err.message})`
      );
    }
  }

  console.log(`📊 expandGlobs result:`, {
    count: expandedFiles.length,
    files: expandedFiles.map((f) => path.basename(f)),
    fullPaths: expandedFiles,
  });

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

// Resolve path aliases
export function resolveAlias(
  ref: string,
  baseFile: string,
  aliases: Record<string, string> = configAliases
): string {
  console.log(`🔧 resolveAlias called with:`, {
    ref,
    baseFile: path.basename(baseFile),
    aliases: Object.keys(aliases),
    aliasesCount: Object.keys(aliases).length,
  });

  // Check if the reference starts with any alias
  for (const [alias, aliasPath] of Object.entries(aliases)) {
    console.log(`🔍 Checking alias:`, {
      alias,
      aliasPath,
      ref,
      startsWithAlias: ref.startsWith(alias + "/"),
      exactMatch: ref === alias,
    });

    if (ref.startsWith(alias + "/") || ref === alias) {
      const relativePath = ref.substring(alias.length);
      const resolvedAliasPath = path.resolve(aliasPath);
      const result = path.join(resolvedAliasPath, relativePath);

      console.log(`✅ Alias resolved:`, {
        alias,
        relativePath,
        resolvedAliasPath,
        result,
      });

      return result;
    }
  }

  // If no alias matches, return the original reference
  console.log(`❌ No alias matched, returning original:`, ref);
  return ref;
}

// Recursively find all referenced files up to a given depth
export function findReferences(
  files: string[],
  maxDepth: number,
  seen: Set<string>
): Set<string> {
  console.log(`🔍 findReferences called with:`, {
    files: files.map((f) => path.basename(f)),
    maxDepth,
    seenSize: seen.size,
    seenFiles: Array.from(seen).map((f) => path.basename(f)),
  });

  const referenced = new Set<string>();
  const originalFiles = new Set(files.map((f) => path.resolve(f)));

  console.log(
    `📋 Original files:`,
    Array.from(originalFiles).map((f) => path.basename(f))
  );

  function helper(currentFiles: string[], depth: number) {
    console.log(`🔄 helper called with:`, {
      files: currentFiles.map((f) => path.basename(f)),
      depth,
      maxDepth,
      currentDepth: depth,
      willSkip: depth > maxDepth,
    });

    if (depth > maxDepth) {
      console.log(
        `⏭️  Skipping due to depth > maxDepth (${depth} > ${maxDepth})`
      );
      return;
    }

    for (const file of currentFiles) {
      try {
        const absFile = path.resolve(file);
        const exists = fs.existsSync(file);
        const alreadySeen = seen.has(absFile);

        console.log(`📁 About to process:`, {
          file: path.basename(file),
          absFile: path.basename(absFile),
          exists,
          alreadySeen,
          depth,
        });

        if (!exists || alreadySeen) {
          console.log(
            `⏭️  Skipping ${path.basename(
              file
            )}: exists=${exists}, seen=${alreadySeen}`
          );
          continue;
        }

        seen.add(absFile);
        console.log(`✅ Added ${path.basename(file)} to seen set`);

        const isOriginalFile = originalFiles.has(absFile);
        const shouldAdd = depth > 1 || !isOriginalFile;

        console.log(`🔍 Processing ${path.basename(file)}:`, {
          depth,
          isOriginalFile,
          depthGreaterThan1: depth > 1,
          shouldAdd,
          absFile: path.basename(absFile),
        });

        // Add to referenced set if it's not an original file, or if it's an original file but we're at depth > 1
        if (shouldAdd) {
          referenced.add(absFile);
          console.log(`✅ Added ${path.basename(absFile)} to referenced set`);
        } else {
          console.log(
            `❌ Not adding ${path.basename(absFile)} to referenced set`
          );
        }

        const content = fs.readFileSync(file, "utf8");
        console.log(
          `📄 File content (${path.basename(file)}):`,
          content.substring(0, 100) + (content.length > 100 ? "..." : "")
        );

        let totalReferencesFound = 0;
        for (const regex of referenceRegexes) {
          // Reset regex state for each file
          regex.lastIndex = 0;
          let match;
          let regexMatches = 0;
          while ((match = regex.exec(content)) !== null) {
            regexMatches++;
            totalReferencesFound++;
            let ref = match[1];
            console.log(
              `🔗 Found reference #${totalReferencesFound} (regex ${regexMatches}):`,
              {
                reference: ref,
                fullMatch: match[0],
                regexPattern: regex.source,
              }
            );

            // Resolve aliases first
            const resolvedRef = resolveAlias(ref, file);
            console.log(`🔧 Resolved reference:`, {
              original: ref,
              resolved: resolvedRef,
              changed: ref !== resolvedRef,
            });

            let nextFiles: string[] = [];
            if (resolvedRef.startsWith(".")) {
              // Handle relative paths
              let resolved = path.resolve(path.dirname(file), resolvedRef);
              console.log(`📍 Resolved relative path:`, {
                original: resolvedRef,
                resolved: resolved,
                dirname: path.dirname(file),
              });

              if (fs.existsSync(resolved)) {
                nextFiles.push(resolved);
                console.log(
                  `✅ Added to nextFiles (exists): ${path.basename(resolved)}`
                );
              } else {
                console.log(
                  `❌ File doesn't exist: ${path.basename(resolved)}`
                );
                // Try with common extensions
                const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                for (const ext of exts) {
                  const withExt = resolved + ext;
                  if (fs.existsSync(withExt)) {
                    nextFiles.push(withExt);
                    console.log(
                      `✅ Added to nextFiles (with extension ${ext}): ${path.basename(
                        withExt
                      )}`
                    );
                    break;
                  } else {
                    console.log(
                      `❌ File with extension ${ext} doesn't exist: ${path.basename(
                        withExt
                      )}`
                    );
                  }
                }
              }
            } else if (resolvedRef !== ref) {
              // Handle aliased paths (non-relative)
              let resolved = path.resolve(resolvedRef);
              console.log(`📍 Resolved aliased path:`, {
                original: resolvedRef,
                resolved: resolved,
              });

              if (fs.existsSync(resolved)) {
                nextFiles.push(resolved);
                console.log(
                  `✅ Added to nextFiles (aliased, exists): ${path.basename(
                    resolved
                  )}`
                );
              } else {
                console.log(
                  `❌ Aliased file doesn't exist: ${path.basename(resolved)}`
                );
                // Try with common extensions
                const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                for (const ext of exts) {
                  const withExt = resolved + ext;
                  if (fs.existsSync(withExt)) {
                    nextFiles.push(withExt);
                    console.log(
                      `✅ Added to nextFiles (aliased, with extension ${ext}): ${path.basename(
                        withExt
                      )}`
                    );
                    break;
                  } else {
                    console.log(
                      `❌ Aliased file with extension ${ext} doesn't exist: ${path.basename(
                        withExt
                      )}`
                    );
                  }
                }
              }
            } else {
              // Handle non-relative, non-aliased paths (like Ruby require_relative)
              console.log(`⚠️  No path resolution needed for: ${resolvedRef}`);
              // Try to resolve as relative path from the current file's directory
              let resolved = path.resolve(path.dirname(file), resolvedRef);
              console.log(`📍 Attempting relative resolution:`, {
                original: resolvedRef,
                resolved: resolved,
                dirname: path.dirname(file),
              });

              if (fs.existsSync(resolved)) {
                nextFiles.push(resolved);
                console.log(
                  `✅ Added to nextFiles (relative resolution, exists): ${path.basename(
                    resolved
                  )}`
                );
              } else {
                console.log(
                  `❌ File doesn't exist with relative resolution: ${path.basename(
                    resolved
                  )}`
                );
                // Try with common extensions
                const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                for (const ext of exts) {
                  const withExt = resolved + ext;
                  if (fs.existsSync(withExt)) {
                    nextFiles.push(withExt);
                    console.log(
                      `✅ Added to nextFiles (relative resolution, with extension ${ext}): ${path.basename(
                        withExt
                      )}`
                    );
                    break;
                  } else {
                    console.log(
                      `❌ File with extension ${ext} doesn't exist with relative resolution: ${path.basename(
                        withExt
                      )}`
                    );
                  }
                }
              }
            }

            console.log(
              `📋 nextFiles for this reference:`,
              nextFiles.map((f) => path.basename(f))
            );

            // Add referenced files to the result immediately if they are not original files
            for (const nextFile of nextFiles) {
              const absNextFile = path.resolve(nextFile);
              const isNextFileOriginal = originalFiles.has(absNextFile);
              console.log(`🔍 Checking if should add immediately:`, {
                file: path.basename(nextFile),
                absFile: path.basename(absNextFile),
                isOriginal: isNextFileOriginal,
                willAdd: true, // Always add files discovered through references
              });

              // Always add files discovered through references
              referenced.add(absNextFile);
              console.log(
                `✅ Added referenced file ${path.basename(
                  absNextFile
                )} to result immediately`
              );
            }

            // Recurse for all found nextFiles
            for (const nextFile of nextFiles) {
              const absNextFile = path.resolve(nextFile);
              const alreadySeen = seen.has(absNextFile);
              console.log(`🔄 Checking recursion for:`, {
                file: path.basename(nextFile),
                absFile: path.basename(absNextFile),
                alreadySeen,
                willRecurse: !alreadySeen,
              });

              if (!alreadySeen) {
                console.log(
                  `🔄 Recursing to: ${path.basename(nextFile)} at depth ${
                    depth + 1
                  }`
                );
                helper([nextFile], depth + 1);
              } else {
                console.log(
                  `⏭️  Skipping recursion to ${path.basename(
                    nextFile
                  )} (already seen)`
                );
              }
            }
          }
          if (regexMatches > 0) {
            console.log(
              `📊 Regex ${regex.source} found ${regexMatches} matches`
            );
          }
        }
        console.log(
          `📊 Total references found in ${path.basename(
            file
          )}: ${totalReferencesFound}`
        );
      } catch (err: any) {
        console.error(
          `❌ Error processing ${path.basename(file)}:`,
          err.message
        );
        warnings.push(`Failed to process reference: ${file} (${err.message})`);
      }
    }
  }

  console.log(
    `🚀 Starting helper with initial files:`,
    files.map((f) => path.basename(f))
  );
  helper(files, 1);

  const resultArray = Array.from(referenced);
  console.log(`📊 Final result:`, {
    count: resultArray.length,
    files: resultArray.map((f) => path.basename(f)),
    fullPaths: resultArray,
  });

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

if (require.main === module) {
  main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
