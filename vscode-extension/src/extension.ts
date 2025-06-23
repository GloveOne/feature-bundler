import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { glob } from "glob";
import { FeatureBundler } from "./featureBundler";
import { DependencyProvider } from "./dependencyProvider";
import { OutputProvider } from "./outputProvider";

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
    "Feature Bundler - Click to toggle watch mode";
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

  // Register context subscriptions
  context.subscriptions.push(
    bundleFilesCommand,
    bundleSelectionCommand,
    bundleWorkspaceCommand,
    showDependenciesCommand,
    exportToClipboardCommand,
    watchModeCommand,
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
    vscode.window.showErrorMessage(`Failed to bundle files: ${error}`);
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

    if (filePaths.length > 0) {
      await performBundling(filePaths);
    } else {
      vscode.window.showWarningMessage("No files selected for bundling");
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to bundle selection: ${error}`);
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

    // Get all files in workspace
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const allFiles = await glob("**/*", {
      cwd: workspaceRoot,
      ignore: excludePatterns,
      nodir: true,
    });

    const filePaths = allFiles.map((file) => path.join(workspaceRoot, file));
    await performBundling(filePaths);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to bundle workspace: ${error}`);
  }
}

async function performBundling(filePaths: string[]) {
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

        // Bundle the files
        const result = await featureBundler.bundleFiles(filePaths, {
          depth,
          outputFormat,
          aliases,
        });

        progress.report({ message: "Generating output...", increment: 50 });

        // Update providers
        dependencyProvider.updateDependencies(result.dependencies);
        outputProvider.updateOutput(result.output, outputFormat);

        progress.report({ message: "Complete!", increment: 100 });

        // Show success message
        vscode.window.showInformationMessage(
          `Successfully bundled ${result.filesProcessed} files with ${result.dependencies.length} dependencies`
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
    vscode.window.showErrorMessage(`Bundling failed: ${error}`);
  }
}

async function showDependencies() {
  try {
    // Focus on the dependencies view
    await vscode.commands.executeCommand(
      "feature-bundler.dependenciesView.focus"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show dependencies: ${error}`);
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
    vscode.window.showErrorMessage(`Failed to export to clipboard: ${error}`);
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
    vscode.window.showErrorMessage(`Failed to toggle watch mode: ${error}`);
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
