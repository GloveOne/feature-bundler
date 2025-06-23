"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureBundler = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const glob_1 = require("glob");
class FeatureBundler {
    constructor() {
        this.watchModeActive = false;
        this.lastBundledFiles = [];
    }
    async bundleFiles(filePaths, options) {
        try {
            // Expand glob patterns
            const expandedFiles = await this.expandGlobs(filePaths);
            if (expandedFiles.length === 0) {
                throw new Error("No files found matching the provided patterns");
            }
            // Find dependencies
            const dependencies = await this.findDependencies(expandedFiles, options.depth, options.aliases);
            // Generate output
            const output = await this.generateOutput(expandedFiles, dependencies, options.outputFormat);
            // Store for watch mode
            this.lastBundledFiles = [...expandedFiles, ...dependencies];
            return {
                filesProcessed: expandedFiles.length,
                dependencies,
                output,
                warnings: [],
            };
        }
        catch (error) {
            throw new Error(`Bundling failed: ${error}`);
        }
    }
    async expandGlobs(patterns) {
        const expandedFiles = [];
        const seenFiles = new Set();
        for (const pattern of patterns) {
            try {
                const isGlob = /[*?[\]{}]/.test(pattern);
                if (isGlob) {
                    const matches = glob_1.glob.sync(pattern, {
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
                }
                else {
                    const resolvedPath = path.resolve(pattern);
                    if (!seenFiles.has(resolvedPath)) {
                        expandedFiles.push(pattern);
                        seenFiles.add(resolvedPath);
                    }
                }
            }
            catch (error) {
                console.warn(`Failed to expand pattern: ${pattern}`, error);
            }
        }
        return expandedFiles;
    }
    async findDependencies(files, maxDepth, aliases) {
        const referenced = new Set();
        const seen = new Set();
        const referenceRegexes = [
            /import\s+.*?from\s+['"](.+?)['"]/g,
            /require\(['"](.+?)['"]\)/g,
            /require_relative\s+['"](.+?)['"]/g,
        ];
        const helper = async (currentFiles, depth) => {
            if (depth > maxDepth)
                return;
            for (const file of currentFiles) {
                try {
                    const absFile = path.resolve(file);
                    if (!fs.existsSync(file) || seen.has(absFile))
                        continue;
                    seen.add(absFile);
                    if (depth > 1) {
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
                            let nextFiles = [];
                            if (ref.startsWith(".")) {
                                const resolved = path.resolve(path.dirname(file), ref);
                                if (fs.existsSync(resolved)) {
                                    nextFiles.push(resolved);
                                }
                                else {
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
                            }
                            else if (ref !== match[1]) {
                                // Aliased path
                                const resolved = path.resolve(ref);
                                if (fs.existsSync(resolved)) {
                                    nextFiles.push(resolved);
                                }
                                else {
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
                            else {
                                // Non-relative, non-aliased path
                                const resolved = path.resolve(path.dirname(file), ref);
                                if (fs.existsSync(resolved)) {
                                    nextFiles.push(resolved);
                                }
                                else {
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
                            // Add to referenced set
                            for (const nextFile of nextFiles) {
                                referenced.add(path.resolve(nextFile));
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
                }
                catch (error) {
                    console.warn(`Error processing file: ${file}`, error);
                }
            }
        };
        await helper(files, 1);
        return Array.from(referenced);
    }
    resolveAlias(ref, baseFile, aliases) {
        for (const [alias, aliasPath] of Object.entries(aliases)) {
            if (ref.startsWith(alias + "/") || ref === alias) {
                const relativePath = ref.substring(alias.length);
                const resolvedAliasPath = path.resolve(aliasPath);
                return path.join(resolvedAliasPath, relativePath);
            }
        }
        return ref;
    }
    async generateOutput(files, dependencies, format) {
        const allFiles = [...files, ...dependencies];
        const fileContents = [];
        for (const file of allFiles) {
            try {
                const content = await fs.readFile(file, "utf8");
                fileContents.push({ path: file, content });
            }
            catch (error) {
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
    generateTextOutput(fileContents) {
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
    generateJsonOutput(fileContents) {
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
    generateMarkdownOutput(fileContents) {
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
    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
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
        if (this.watchModeActive)
            return;
        this.watchModeActive = true;
        // Watch for changes in the last bundled files
        if (this.lastBundledFiles.length > 0) {
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(`{${this.lastBundledFiles.join(",")}}`);
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
    isWatchModeActive() {
        return this.watchModeActive;
    }
    async handleFileChange(uri) {
        if (!this.watchModeActive)
            return;
        try {
            vscode.window.showInformationMessage(`File changed: ${path.basename(uri.fsPath)}. Re-bundling...`);
            // Re-bundle the last set of files
            const config = vscode.workspace.getConfiguration("feature-bundler");
            const options = {
                depth: config.get("depth", 2),
                outputFormat: config.get("outputFormat", "text"),
                aliases: config.get("aliases", {}),
            };
            await this.bundleFiles(this.lastBundledFiles, options);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Watch mode re-bundling failed: ${error}`);
        }
    }
    dispose() {
        this.stopWatchMode();
    }
}
exports.FeatureBundler = FeatureBundler;
//# sourceMappingURL=featureBundler.js.map