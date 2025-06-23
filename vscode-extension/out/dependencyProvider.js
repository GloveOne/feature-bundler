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
exports.DependencyItem = exports.DependencyProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class DependencyProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.dependencies = [];
    }
    updateDependencies(dependencies) {
        console.log("📋 DependencyProvider.updateDependencies called with:", {
            count: dependencies.length,
            dependencies: dependencies.map((f) => path.basename(f)),
        });
        this.dependencies = dependencies;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - show dependency categories
            if (this.dependencies.length === 0) {
                return Promise.resolve([]);
            }
            const categories = this.groupDependenciesByType();
            return Promise.resolve(categories);
        }
        else if (element.type === "category") {
            // Category level - show files in that category
            const files = this.dependencies.filter((dep) => {
                const ext = path.extname(dep).toLowerCase();
                return this.getCategoryForExtension(ext) === element.label;
            });
            return Promise.resolve(files.map((file) => new DependencyItem(path.basename(file), "file", file, this.getIconForFile(file))));
        }
        return Promise.resolve([]);
    }
    groupDependenciesByType() {
        const categories = new Map();
        for (const dep of this.dependencies) {
            const ext = path.extname(dep).toLowerCase();
            const category = this.getCategoryForExtension(ext);
            categories.set(category, (categories.get(category) || 0) + 1);
        }
        return Array.from(categories.entries()).map(([category, count]) => new DependencyItem(`${category} (${count})`, "category", undefined, this.getIconForCategory(category)));
    }
    getCategoryForExtension(ext) {
        const categoryMap = {
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
    getIconForCategory(category) {
        const iconMap = {
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
    getIconForFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const iconMap = {
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
exports.DependencyProvider = DependencyProvider;
class DependencyItem extends vscode.TreeItem {
    constructor(label, type, filePath, icon) {
        super(label, type === "category"
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.type = type;
        this.filePath = filePath;
        this.icon = icon;
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
exports.DependencyItem = DependencyItem;
//# sourceMappingURL=dependencyProvider.js.map