import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { glob } from "glob";

export interface BundlingOptions {
  depth: number;
  outputFormat: string;
  aliases: Record<string, string>;
}

export interface BundlingResult {
  filesProcessed: number;
  dependencies: string[];
  output: string;
  warnings: string[];
}

export class FeatureBundler {
  private watchModeActive = false;
  private fileWatcher?: vscode.FileSystemWatcher;
  private lastBundledFiles: string[] = [];

  async bundleFiles(
    filePaths: string[],
    options: BundlingOptions
  ): Promise<BundlingResult> {
    try {
      // Expand glob patterns
      const expandedFiles = await this.expandGlobs(filePaths);

      if (expandedFiles.length === 0) {
        throw new Error("No files found matching the provided patterns");
      }

      // Find dependencies
      const dependencies = await this.findDependencies(
        expandedFiles,
        options.depth,
        options.aliases
      );

      // Generate output
      const output = await this.generateOutput(
        expandedFiles,
        dependencies,
        options.outputFormat
      );

      // Store for watch mode
      this.lastBundledFiles = [...expandedFiles, ...dependencies];

      return {
        filesProcessed: expandedFiles.length,
        dependencies,
        output,
        warnings: [],
      };
    } catch (error) {
      throw new Error(`Bundling failed: ${error}`);
    }
  }

  private async expandGlobs(patterns: string[]): Promise<string[]> {
    const expandedFiles: string[] = [];
    const seenFiles = new Set<string>();

    for (const pattern of patterns) {
      try {
        const isGlob = /[*?[\]{}]/.test(pattern);

        if (isGlob) {
          const matches = glob.sync(pattern, {
            nodir: true,
            absolute: false,
            cwd: process.cwd(),
          });

          for (const match of matches) {
            const resolvedPath = path.resolve(match);
            if (!seenFiles.has(resolvedPath)) {
              expandedFiles.push(match);
              seenFiles.add(resolvedPath);
            }
          }
        } else {
          const resolvedPath = path.resolve(pattern);
          if (!seenFiles.has(resolvedPath)) {
            expandedFiles.push(pattern);
            seenFiles.add(resolvedPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to expand pattern: ${pattern}`, error);
      }
    }

    return expandedFiles;
  }

  private async findDependencies(
    files: string[],
    maxDepth: number,
    aliases: Record<string, string>
  ): Promise<string[]> {
    const referenced = new Set<string>();
    const seen = new Set<string>();
    const originalFiles = new Set(files.map((f) => path.resolve(f)));

    const referenceRegexes = [
      /import\s+.*?from\s+['"](.+?)['"]/g,
      /require\(['"](.+?)['"]\)/g,
      /require_relative\s+['"](.+?)['"]/g,
    ];

    const helper = async (currentFiles: string[], depth: number) => {
      if (depth > maxDepth) return;

      for (const file of currentFiles) {
        try {
          const absFile = path.resolve(file);
          if (!fs.existsSync(file) || seen.has(absFile)) continue;

          seen.add(absFile);

          // Add to referenced set if it's not an original file, or if it's an original file but we're at depth > 1
          const isOriginalFile = originalFiles.has(absFile);
          if (depth > 1 || !isOriginalFile) {
            referenced.add(absFile);
          }

          const content = await fs.readFile(file, "utf8");

          for (const regex of referenceRegexes) {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(content)) !== null) {
              let ref = match[1];

              // Resolve aliases
              ref = this.resolveAlias(ref, file, aliases);

              let nextFiles: string[] = [];
              if (ref.startsWith(".")) {
                const resolved = path.resolve(path.dirname(file), ref);
                if (fs.existsSync(resolved)) {
                  nextFiles.push(resolved);
                } else {
                  // Try with extensions
                  const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                  for (const ext of exts) {
                    const withExt = resolved + ext;
                    if (fs.existsSync(withExt)) {
                      nextFiles.push(withExt);
                      break;
                    }
                  }
                }
              } else if (ref !== match[1]) {
                // Aliased path
                const resolved = path.resolve(ref);
                if (fs.existsSync(resolved)) {
                  nextFiles.push(resolved);
                } else {
                  const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                  for (const ext of exts) {
                    const withExt = resolved + ext;
                    if (fs.existsSync(withExt)) {
                      nextFiles.push(withExt);
                      break;
                    }
                  }
                }
              } else {
                // Non-relative, non-aliased path
                const resolved = path.resolve(path.dirname(file), ref);
                if (fs.existsSync(resolved)) {
                  nextFiles.push(resolved);
                } else {
                  const exts = [".js", ".ts", ".tsx", ".jsx", ".rb", ".json"];
                  for (const ext of exts) {
                    const withExt = resolved + ext;
                    if (fs.existsSync(withExt)) {
                      nextFiles.push(withExt);
                      break;
                    }
                  }
                }
              }

              // Add referenced files to the result immediately
              for (const nextFile of nextFiles) {
                const absNextFile = path.resolve(nextFile);
                const isNextFileOriginal = originalFiles.has(absNextFile);
                if (depth > 1 || !isNextFileOriginal) {
                  referenced.add(absNextFile);
                }
              }

              // Recurse
              for (const nextFile of nextFiles) {
                const absNextFile = path.resolve(nextFile);
                if (!seen.has(absNextFile)) {
                  await helper([nextFile], depth + 1);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing file: ${file}`, error);
        }
      }
    };

    await helper(files, 1);
    return Array.from(referenced);
  }

  private resolveAlias(
    ref: string,
    baseFile: string,
    aliases: Record<string, string>
  ): string {
    for (const [alias, aliasPath] of Object.entries(aliases)) {
      if (ref.startsWith(alias + "/") || ref === alias) {
        const relativePath = ref.substring(alias.length);
        const resolvedAliasPath = path.resolve(aliasPath);
        return path.join(resolvedAliasPath, relativePath);
      }
    }
    return ref;
  }

  private async generateOutput(
    files: string[],
    dependencies: string[],
    format: string
  ): Promise<string> {
    const allFiles = [...files, ...dependencies];
    const fileContents: Array<{ path: string; content: string }> = [];

    for (const file of allFiles) {
      try {
        const content = await fs.readFile(file, "utf8");
        fileContents.push({ path: file, content });
      } catch (error) {
        console.warn(`Failed to read file: ${file}`, error);
      }
    }

    switch (format) {
      case "json":
        return this.generateJsonOutput(fileContents);
      case "markdown":
        return this.generateMarkdownOutput(fileContents);
      default:
        return this.generateTextOutput(fileContents);
    }
  }

  private generateTextOutput(
    fileContents: Array<{ path: string; content: string }>
  ): string {
    let output = "";
    let lastDir = "";

    for (const { path: filePath, content } of fileContents) {
      const dir = path.dirname(filePath);
      if (dir !== lastDir) {
        output += `\n===== ${dir}/ =====\n`;
        lastDir = dir;
      }
      output += `\n==================== ${filePath} ====================\n\n${content}\n`;
    }

    return output;
  }

  private generateJsonOutput(
    fileContents: Array<{ path: string; content: string }>
  ): string {
    const output = {
      files: fileContents.map(({ path: filePath, content }) => ({
        path: filePath,
        content,
        language: this.detectLanguage(filePath),
      })),
      metadata: {
        totalFiles: fileContents.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return JSON.stringify(output, null, 2);
  }

  private generateMarkdownOutput(
    fileContents: Array<{ path: string; content: string }>
  ): string {
    let output = "# Feature Bundle\n\n";
    output += `Generated on: ${new Date().toLocaleString()}\n\n`;
    output += `Total files: ${fileContents.length}\n\n`;

    for (const { path: filePath, content } of fileContents) {
      const language = this.detectLanguage(filePath);
      output += `## ${filePath}\n\n`;
      output += `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
    }

    return output;
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      ".js": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".jsx": "javascript",
      ".rb": "ruby",
      ".json": "json",
      ".css": "css",
      ".scss": "scss",
      ".html": "html",
      ".md": "markdown",
      ".py": "python",
      ".go": "go",
      ".php": "php",
    };
    return languageMap[ext] || "plaintext";
  }

  startWatchMode() {
    if (this.watchModeActive) return;

    this.watchModeActive = true;

    // Watch for changes in the last bundled files
    if (this.lastBundledFiles.length > 0) {
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(
        `{${this.lastBundledFiles.join(",")}}`
      );

      this.fileWatcher.onDidChange(async (uri) => {
        await this.handleFileChange(uri);
      });

      this.fileWatcher.onDidCreate(async (uri) => {
        await this.handleFileChange(uri);
      });

      this.fileWatcher.onDidDelete(async (uri) => {
        await this.handleFileChange(uri);
      });
    }
  }

  stopWatchMode() {
    this.watchModeActive = false;
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }

  isWatchModeActive(): boolean {
    return this.watchModeActive;
  }

  private async handleFileChange(uri: vscode.Uri) {
    if (!this.watchModeActive) return;

    try {
      vscode.window.showInformationMessage(
        `File changed: ${path.basename(uri.fsPath)}. Re-bundling...`
      );

      // Re-bundle the last set of files
      const config = vscode.workspace.getConfiguration("feature-bundler");
      const options: BundlingOptions = {
        depth: config.get<number>("depth", 2),
        outputFormat: config.get<string>("outputFormat", "text"),
        aliases: config.get<Record<string, string>>("aliases", {}),
      };

      await this.bundleFiles(this.lastBundledFiles, options);
    } catch (error) {
      vscode.window.showErrorMessage(`Watch mode re-bundling failed: ${error}`);
    }
  }

  dispose() {
    this.stopWatchMode();
  }
}
