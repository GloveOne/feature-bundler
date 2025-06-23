import * as vscode from "vscode";
import * as path from "path";

export class DependencyProvider
  implements vscode.TreeDataProvider<DependencyItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    DependencyItem | undefined | null | void
  > = new vscode.EventEmitter<DependencyItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    DependencyItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private dependencies: string[] = [];

  updateDependencies(dependencies: string[]) {
    this.dependencies = dependencies;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DependencyItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DependencyItem): Thenable<DependencyItem[]> {
    if (!element) {
      // Root level - show dependency categories
      if (this.dependencies.length === 0) {
        return Promise.resolve([]);
      }

      const categories = this.groupDependenciesByType();
      return Promise.resolve(categories);
    } else if (element.type === "category") {
      // Category level - show files in that category
      const files = this.dependencies.filter((dep) => {
        const ext = path.extname(dep).toLowerCase();
        return this.getCategoryForExtension(ext) === element.label;
      });

      return Promise.resolve(
        files.map(
          (file) =>
            new DependencyItem(
              path.basename(file),
              "file",
              file,
              this.getIconForFile(file)
            )
        )
      );
    }

    return Promise.resolve([]);
  }

  private groupDependenciesByType(): DependencyItem[] {
    const categories = new Map<string, number>();

    for (const dep of this.dependencies) {
      const ext = path.extname(dep).toLowerCase();
      const category = this.getCategoryForExtension(ext);
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    return Array.from(categories.entries()).map(
      ([category, count]) =>
        new DependencyItem(
          `${category} (${count})`,
          "category",
          undefined,
          this.getIconForCategory(category)
        )
    );
  }

  private getCategoryForExtension(ext: string): string {
    const categoryMap: Record<string, string> = {
      ".js": "JavaScript",
      ".ts": "TypeScript",
      ".tsx": "React TypeScript",
      ".jsx": "React JavaScript",
      ".rb": "Ruby",
      ".json": "Configuration",
      ".css": "Styles",
      ".scss": "Styles",
      ".html": "HTML",
      ".md": "Documentation",
      ".py": "Python",
      ".go": "Go",
      ".php": "PHP",
    };
    return categoryMap[ext] || "Other";
  }

  private getIconForCategory(category: string): string {
    const iconMap: Record<string, string> = {
      JavaScript: "$(symbol-class)",
      TypeScript: "$(symbol-class)",
      "React TypeScript": "$(symbol-class)",
      "React JavaScript": "$(symbol-class)",
      Ruby: "$(symbol-class)",
      Configuration: "$(gear)",
      Styles: "$(symbol-color)",
      HTML: "$(symbol-html)",
      Documentation: "$(book)",
      Python: "$(symbol-class)",
      Go: "$(symbol-class)",
      PHP: "$(symbol-class)",
      Other: "$(file)",
    };
    return iconMap[category] || "$(file)";
  }

  private getIconForFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const iconMap: Record<string, string> = {
      ".js": "$(symbol-method)",
      ".ts": "$(symbol-method)",
      ".tsx": "$(symbol-method)",
      ".jsx": "$(symbol-method)",
      ".rb": "$(symbol-method)",
      ".json": "$(symbol-constant)",
      ".css": "$(symbol-color)",
      ".scss": "$(symbol-color)",
      ".html": "$(symbol-html)",
      ".md": "$(book)",
      ".py": "$(symbol-method)",
      ".go": "$(symbol-method)",
      ".php": "$(symbol-method)",
    };
    return iconMap[ext] || "$(file)";
  }
}

export class DependencyItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: "category" | "file",
    public readonly filePath?: string,
    public readonly icon?: string
  ) {
    super(
      label,
      type === "category"
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.iconPath = icon
      ? new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""))
      : undefined;

    if (type === "file" && filePath) {
      this.tooltip = filePath;
      this.description = path.dirname(filePath);
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(filePath)],
      };
    }
  }
}
