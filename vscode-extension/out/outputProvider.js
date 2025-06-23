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
exports.OutputItem = exports.OutputProvider = void 0;
const vscode = __importStar(require("vscode"));
class OutputProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.currentOutput = "";
        this.currentFormat = "text";
    }
    updateOutput(output, format) {
        this.currentOutput = output;
        this.currentFormat = format;
        this._onDidChangeTreeData.fire();
    }
    getCurrentOutput() {
        return this.currentOutput;
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - show output options
            if (!this.currentOutput) {
                return Promise.resolve([
                    new OutputItem("No output available", "info", undefined, "$(info)"),
                ]);
            }
            return Promise.resolve([
                new OutputItem(`Output (${this.currentFormat.toUpperCase()})`, "output", this.currentOutput, this.getIconForFormat(this.currentFormat)),
                new OutputItem("Copy to Clipboard", "action", "copy", "$(copy)"),
                new OutputItem("Open in Editor", "action", "open", "$(file)"),
                new OutputItem("Save to File", "action", "save", "$(save)"),
            ]);
        }
        return Promise.resolve([]);
    }
    getIconForFormat(format) {
        const iconMap = {
            text: "$(file-text)",
            json: "$(symbol-constant)",
            markdown: "$(book)",
        };
        return iconMap[format] || "$(file)";
    }
}
exports.OutputProvider = OutputProvider;
class OutputItem extends vscode.TreeItem {
    constructor(label, type, data, icon) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.type = type;
        this.data = data;
        this.icon = icon;
        this.iconPath = icon
            ? new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""))
            : undefined;
        if (type === "action") {
            this.command = {
                command: "feature-bundler.handleOutputAction",
                title: "Execute Action",
                arguments: [data],
            };
        }
        else if (type === "output") {
            this.tooltip = "Click to view output";
            this.command = {
                command: "feature-bundler.showOutput",
                title: "Show Output",
                arguments: [data],
            };
        }
    }
}
exports.OutputItem = OutputItem;
//# sourceMappingURL=outputProvider.js.map