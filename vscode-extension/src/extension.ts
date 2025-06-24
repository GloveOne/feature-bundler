import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { glob } from "glob";
import { FeatureBundler } from "./featureBundler";
import { DependencyProvider } from "./dependencyProvider";
import { OutputProvider } from "./outputProvider";

// Centralized error handler
function handleError(error: any, context: string) {
  console.error(`Error in ${context}:`, error);
  vscode.window.showErrorMessage(`${context} failed: ${error.message}`);
}

let featureBundler: FeatureBundler;
let dependencyProvider: DependencyProvider;
let outputProvider: OutputProvider;
let watchModeStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log("Feature Bundler extension is now active!");

  // Initialize providers
  featureBundler = new FeatureBundler();
  dependencyProvider = new DependencyProvider();
  outputProvider = new OutputProvider();

  // Initialize context keys
  vscode.commands.executeCommand(
    "setContext",
    "feature-bundler.hasDependencies",
    false
  );
  vscode.commands.executeCommand(
    "setContext",
    "feature-bundler.hasOutput",
    false
  );

  // Register tree data providers
  const dependencyTreeProvider = vscode.window.registerTreeDataProvider(
    "feature-bundler.dependenciesView",
    dependencyProvider
  );

  const outputTreeProvider = vscode.window.registerTreeDataProvider(
    "feature-bundler.outputView",
    outputProvider
  );

  // Create status bar item for watch mode
  watchModeStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  watchModeStatusBarItem.text = "$(eye) Feature Bundler";
  watchModeStatusBarItem.tooltip =
    "Feature Bundler - Click to enable watch mode";
  watchModeStatusBarItem.command = "feature-bundler.watchMode";

  // Register commands
  const bundleFilesCommand = vscode.commands.registerCommand(
    "feature-bundler.bundleFiles",
    async () => {
      await bundleFiles();
    }
  );

  const bundleSelectionCommand = vscode.commands.registerCommand(
    "feature-bundler.bundleSelection",
    async (uri?: vscode.Uri) => {
      await bundleSelection(uri);
    }
  );

  const bundleWorkspaceCommand = vscode.commands.registerCommand(
    "feature-bundler.bundleWorkspace",
    async () => {
      await bundleWorkspace();
    }
  );

  const showDependenciesCommand = vscode.commands.registerCommand(
    "feature-bundler.showDependencies",
    async () => {
      await showDependencies();
    }
  );

  const exportToClipboardCommand = vscode.commands.registerCommand(
    "feature-bundler.exportToClipboard",
    async () => {
      await exportToClipboard();
    }
  );

  const watchModeCommand = vscode.commands.registerCommand(
    "feature-bundler.watchMode",
    async () => {
      await toggleWatchMode();
    }
  );

  // Add missing command handlers
  const handleOutputActionCommand = vscode.commands.registerCommand(
    "feature-bundler.handleOutputAction",
    async (action: "copy" | "open" | "save") => {
      await handleOutputAction(action);
    }
  );

  const showOutputCommand = vscode.commands.registerCommand(
    "feature-bundler.showOutput",
    async (output: string) => {
      await showOutput(output);
    }
  );

  // Register context subscriptions
  context.subscriptions.push(
    bundleFilesCommand,
    bundleSelectionCommand,
    bundleWorkspaceCommand,
    showDependenciesCommand,
    exportToClipboardCommand,
    watchModeCommand,
    handleOutputActionCommand,
    showOutputCommand,
    dependencyTreeProvider,
    outputTreeProvider,
    watchModeStatusBarItem
  );

  // Show status bar item
  watchModeStatusBarItem.show();
}

async function bundleFiles() {
  try {
    const files = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: "Select Files to Bundle",
    });

    if (files && files.length > 0) {
      const filePaths = files.map((file) => file.fsPath);
      await performBundling(filePaths);
    }
  } catch (error) {
    handleError(error, "bundleFiles");
  }
}

async function bundleSelection(uri?: vscode.Uri) {
  try {
    let filePaths: string[] = [];

    if (uri) {
      // Single file/folder selected from explorer
      filePaths = [uri.fsPath];
    } else {
      // Get selected files from editor
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        filePaths = [editor.document.uri.fsPath];
      }
    }

    // Validate file paths are within workspace
    function validateFilePath(filePath: string): boolean {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return false;

      const resolvedPath = path.resolve(filePath);
      return resolvedPath.startsWith(workspaceRoot);
    }

    const validFiles = filePaths.filter(validateFilePath);
    if (validFiles.length !== filePaths.length) {
      vscode.window.showWarningMessage(
        "Some files were excluded for security reasons"
      );
    }

    if (validFiles.length > 0) {
      await performBundling(validFiles);
    } else {
      vscode.window.showWarningMessage("No valid files selected for bundling");
    }
  } catch (error) {
    handleError(error, "bundleSelection");
  }
}

async function bundleWorkspace() {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage("No workspace folder found");
      return;
    }

    const config = vscode.workspace.getConfiguration("feature-bundler");
    const excludePatterns = config.get<string[]>("excludePatterns", []);

    // Validate and sanitize glob patterns
    function validateGlobPattern(pattern: string): boolean {
      // Check for dangerous patterns that could traverse outside workspace
      if (pattern.includes("..") || pattern.includes("**/..")) {
        return false;
      }
      // Check for absolute paths that could access system files
      if (pattern.startsWith("/") || pattern.startsWith("\\")) {
        return false;
      }
      return true;
    }

    const validExcludePatterns = excludePatterns.filter(validateGlobPattern);
    if (validExcludePatterns.length !== excludePatterns.length) {
      console.warn(
        "Some exclude patterns were filtered out for security reasons"
      );
    }

    // Get all files in workspace
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const allFiles = await glob("**/*", {
      cwd: workspaceRoot,
      ignore: validExcludePatterns,
      nodir: true,
    });

    const filePaths = allFiles.map((file) => path.join(workspaceRoot, file));
    await performBundling(filePaths);
  } catch (error) {
    handleError(error, "bundleWorkspace");
  }
}

async function performBundling(filePaths: string[]) {
  const startTime = Date.now();

  try {
    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Feature Bundler",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Analyzing dependencies...", increment: 0 });

        const config = vscode.workspace.getConfiguration("feature-bundler");
        const depth = config.get<number>("depth", 2);
        const outputFormat = config.get<string>("outputFormat", "text");
        const aliases = config.get<Record<string, string>>("aliases", {});

        // Validate configuration
        if (depth < 1 || depth > 10) {
          throw new Error("Depth must be between 1 and 10");
        }

        if (!["text", "json", "markdown"].includes(outputFormat)) {
          throw new Error(
            "Invalid output format. Must be 'text', 'json', or 'markdown'"
          );
        }

        // Bundle the files
        const result = await featureBundler.bundleFiles(filePaths, {
          depth,
          outputFormat,
          aliases,
        });

        progress.report({ message: "Generating output...", increment: 50 });

        // Debug output
        console.log("🔍 Bundling result:", {
          filesProcessed: result.filesProcessed,
          dependenciesCount: result.dependencies.length,
          dependencies: result.dependencies.map((f) => path.basename(f)),
          outputLength: result.output.length,
        });

        // Update providers
        dependencyProvider.updateDependencies(result.dependencies);
        outputProvider.updateOutput(result.output, outputFormat);

        // Update context keys to show views
        const hasDependencies = result.dependencies.length > 0;
        const hasOutput = result.output.length > 0;

        console.log("🔧 Setting context keys:", {
          hasDependencies,
          hasOutput,
          dependenciesCount: result.dependencies.length,
        });

        // Update context keys with error handling
        try {
          await vscode.commands.executeCommand(
            "setContext",
            "feature-bundler.hasDependencies",
            hasDependencies
          );
          await vscode.commands.executeCommand(
            "setContext",
            "feature-bundler.hasOutput",
            hasOutput
          );
        } catch (error) {
          console.warn("Failed to update context keys:", error);
        }

        progress.report({ message: "Complete!", increment: 100 });

        // Calculate and log performance metrics
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`📊 Bundling completed in ${processingTime}ms`);

        // Show success message with performance info
        vscode.window.showInformationMessage(
          `Successfully bundled ${result.filesProcessed} files with ${result.dependencies.length} dependencies in ${processingTime}ms`
        );

        // Open output in new editor
        const outputUri = vscode.Uri.parse(
          `untitled:bundled-feature.${outputFormat}`
        );
        const document = await vscode.workspace.openTextDocument(outputUri);
        const editor = await vscode.window.showTextDocument(document);

        // Set content
        await editor.edit((editBuilder) => {
          editBuilder.insert(new vscode.Position(0, 0), result.output);
        });

        // Set language mode based on output format
        const languageMap: Record<string, string> = {
          text: "plaintext",
          json: "json",
          markdown: "markdown",
        };

        await vscode.languages.setTextDocumentLanguage(
          document,
          languageMap[outputFormat] || "plaintext"
        );
      }
    );
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.error(`❌ Bundling failed after ${processingTime}ms:`, error);
    handleError(error, "performBundling");
  }
}

async function showDependencies() {
  try {
    // Focus on the dependencies view
    await vscode.commands.executeCommand(
      "feature-bundler.dependenciesView.focus"
    );
  } catch (error) {
    handleError(error, "showDependencies");
  }
}

async function exportToClipboard() {
  try {
    const output = outputProvider.getCurrentOutput();
    if (output) {
      await vscode.env.clipboard.writeText(output);
      vscode.window.showInformationMessage(
        "Bundled output copied to clipboard!"
      );
    } else {
      vscode.window.showWarningMessage("No bundled output available");
    }
  } catch (error) {
    handleError(error, "exportToClipboard");
  }
}

async function toggleWatchMode() {
  try {
    const isWatching = featureBundler.isWatchModeActive();

    if (isWatching) {
      featureBundler.stopWatchMode();
      watchModeStatusBarItem.text = "$(eye) Feature Bundler";
      watchModeStatusBarItem.tooltip =
        "Feature Bundler - Click to enable watch mode";
      vscode.window.showInformationMessage(
        "Feature Bundler watch mode disabled"
      );
    } else {
      featureBundler.startWatchMode();
      watchModeStatusBarItem.text = "$(eye-closed) Feature Bundler";
      watchModeStatusBarItem.tooltip =
        "Feature Bundler - Click to disable watch mode";
      vscode.window.showInformationMessage(
        "Feature Bundler watch mode enabled"
      );
    }
  } catch (error) {
    handleError(error, "toggleWatchMode");
  }
}

async function handleOutputAction(action: "copy" | "open" | "save") {
  try {
    const output = outputProvider.getCurrentOutput();
    if (!output) {
      vscode.window.showWarningMessage("No output available");
      return;
    }

    switch (action) {
      case "copy":
        await vscode.env.clipboard.writeText(output);
        vscode.window.showInformationMessage("Output copied to clipboard!");
        break;
      case "open":
        await showOutput(output);
        break;
      case "save":
        const uri = await vscode.window.showSaveDialog({
          filters: {
            "Text files": ["txt"],
            "All files": ["*"],
          },
        });
        if (uri) {
          await fs.writeFile(uri.fsPath, output, "utf8");
          vscode.window.showInformationMessage(`Output saved to ${uri.fsPath}`);
        }
        break;
      default:
        vscode.window.showWarningMessage(`Unknown action: ${action}`);
    }
  } catch (error) {
    handleError(error, "handleOutputAction");
  }
}

async function showOutput(output: string) {
  try {
    const document = await vscode.workspace.openTextDocument({
      content: output,
      language: "plaintext",
    });
    await vscode.window.showTextDocument(document);
  } catch (error) {
    handleError(error, "showOutput");
  }
}

export function deactivate() {
  if (featureBundler) {
    featureBundler.dispose();
  }
  if (watchModeStatusBarItem) {
    watchModeStatusBarItem.dispose();
  }
}
