import * as vscode from "vscode";

export class OutputProvider implements vscode.TreeDataProvider<OutputItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    OutputItem | undefined | null | void
  > = new vscode.EventEmitter<OutputItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    OutputItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private currentOutput: string = "";
  private currentFormat: string = "text";

  updateOutput(output: string, format: string) {
    this.currentOutput = output;
    this.currentFormat = format;
    this._onDidChangeTreeData.fire();
  }

  getCurrentOutput(): string {
    return this.currentOutput;
  }

  getTreeItem(element: OutputItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: OutputItem): Thenable<OutputItem[]> {
    if (!element) {
      // Root level - show output options
      if (!this.currentOutput) {
        return Promise.resolve([
          new OutputItem("No output available", "info", undefined, "$(info)"),
        ]);
      }

      return Promise.resolve([
        new OutputItem(
          `Output (${this.currentFormat.toUpperCase()})`,
          "output",
          this.currentOutput,
          this.getIconForFormat(this.currentFormat)
        ),
        new OutputItem("Copy to Clipboard", "action", "copy", "$(copy)"),
        new OutputItem("Open in Editor", "action", "open", "$(file)"),
        new OutputItem("Save to File", "action", "save", "$(save)"),
      ]);
    }

    return Promise.resolve([]);
  }

  private getIconForFormat(format: string): string {
    const iconMap: Record<string, string> = {
      text: "$(file-text)",
      json: "$(symbol-constant)",
      markdown: "$(book)",
    };
    return iconMap[format] || "$(file)";
  }
}

export class OutputItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: "info" | "output" | "action",
    public readonly data?: string,
    public readonly icon?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.iconPath = icon
      ? new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""))
      : undefined;

    if (type === "action") {
      this.command = {
        command: "feature-bundler.handleOutputAction",
        title: "Execute Action",
        arguments: [data],
      };
    } else if (type === "output") {
      this.tooltip = "Click to view output";
      this.command = {
        command: "feature-bundler.showOutput",
        title: "Show Output",
        arguments: [data],
      };
    }
  }
}
