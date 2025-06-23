# Feature Bundler VS Code Extension

A powerful VS Code extension for bundling related files from your codebase into a single context file. Perfect for AI code analysis, documentation generation, and feature extraction.

## ✨ Features

- **🔍 Smart Dependency Resolution**: Automatically finds and includes referenced files
- **🌐 Glob Pattern Support**: Use wildcards to select multiple files
- **⚙️ Configuration Management**: Easy settings management within VS Code
- **🔄 Watch Mode**: Automatic rebundling when files change
- **🎯 Multiple Output Formats**: Text, JSON, and Markdown output
- **📁 Visual Dependency Tree**: See all dependencies organized by type
- **📋 Clipboard Export**: Quick copy to clipboard for sharing
- **🎨 Status Bar Integration**: Quick access to watch mode toggle

## 🚀 Quick Start

### Installation

1. Clone this repository
2. Open the `vscode-extension` folder in VS Code
3. Press `F5` to run the extension in a new Extension Development Host window

### Usage

#### Right-Click Context Menu

- Right-click on any file or folder in the explorer
- Select "Feature Bundler: Bundle Selected Files"
- The extension will analyze dependencies and generate output

#### Command Palette

- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Feature Bundler" to see all available commands
- Select the desired bundling option

#### Status Bar

- Click the Feature Bundler icon in the status bar to toggle watch mode
- Watch mode automatically rebundles when files change

## 📖 Commands

### Core Commands

- **Feature Bundler: Bundle Files** - Open file picker to select files for bundling
- **Feature Bundler: Bundle Selected Files** - Bundle the currently selected file(s)
- **Feature Bundler: Bundle Workspace** - Bundle all files in the current workspace
- **Feature Bundler: Show Dependencies** - Focus on the dependencies view
- **Feature Bundler: Export to Clipboard** - Copy bundled output to clipboard
- **Feature Bundler: Toggle Watch Mode** - Enable/disable automatic rebundling

## ⚙️ Configuration

### Extension Settings

Open VS Code settings (`Ctrl+,`) and search for "Feature Bundler" to configure:

- **Depth**: Maximum dependency resolution depth (1-10)
- **Output Format**: Choose between text, JSON, or Markdown
- **Include Node Modules**: Whether to include node_modules dependencies
- **Aliases**: Path aliases for import resolution
- **Exclude Patterns**: Patterns to exclude from bundling

### Example Settings

```json
{
  "feature-bundler.depth": 3,
  "feature-bundler.outputFormat": "markdown",
  "feature-bundler.includeNodeModules": false,
  "feature-bundler.aliases": {
    "@": "src",
    "@components": "src/components",
    "~": "."
  },
  "feature-bundler.excludePatterns": [
    "**/*.test.*",
    "**/*.spec.*",
    "**/node_modules/**"
  ]
}
```

## 🎯 Use Cases

### AI Code Analysis

Bundle related files to provide context for AI tools like ChatGPT, Copilot, or Claude:

1. Select the main files of your feature
2. Use "Bundle Selected Files" command
3. Copy the output to clipboard
4. Paste into your AI tool for analysis

### Documentation Generation

Generate comprehensive documentation for features:

1. Bundle all files related to a feature
2. Choose Markdown output format
3. Save the output as documentation

### Code Review

Share bundled context for code reviews:

1. Bundle the files being reviewed
2. Export to clipboard
3. Share with reviewers for context

### Dependency Analysis

Understand file relationships:

1. Bundle files and check the Dependencies view
2. See all related files organized by type
3. Click on files to open them directly

## 🔧 Advanced Features

### Watch Mode

Enable watch mode to automatically rebundle when files change:

1. Click the Feature Bundler icon in the status bar
2. Make changes to your files
3. The extension will automatically rebundle and update output

### Multiple Output Formats

#### Text Format

Traditional concatenated output with file separators:

```
===== src/components/ =====

==================== src/components/Button.tsx ====================

import React from 'react';
// ... file content
```

#### JSON Format

Structured output with metadata:

```json
{
  "files": [
    {
      "path": "src/components/Button.tsx",
      "content": "import React from 'react';...",
      "language": "typescript"
    }
  ],
  "metadata": {
    "totalFiles": 5,
    "generatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Markdown Format

Documentation-ready output:

````markdown
# Feature Bundle

Generated on: 1/15/2024, 10:30:00 AM
Total files: 5

## src/components/Button.tsx

```typescript
import React from "react";
// ... file content
```
````

```

## 🎨 UI Components

### Dependencies View
Shows all dependencies organized by file type:
- JavaScript/TypeScript files
- React components
- Ruby files
- Configuration files
- Styles
- Documentation
- Other file types

### Output View
Provides quick actions for bundled output:
- View output in different formats
- Copy to clipboard
- Open in editor
- Save to file

### Status Bar
Quick access to watch mode toggle with visual indicators:
- 👁️ Watch mode disabled
- 👁️‍🗨️ Watch mode enabled

## 🚨 Troubleshooting

### Common Issues

**"No files found" error**
- Check that the file paths are correct
- Ensure files exist in the workspace
- Verify glob patterns are valid

**"Permission denied" error**
- Check file permissions
- Ensure VS Code has access to the files

**Watch mode not working**
- Make sure watch mode is enabled (status bar icon shows closed eye)
- Check that files are being modified in the workspace

### Debug Mode
Enable VS Code's developer tools to see extension logs:
1. Open Command Palette
2. Run "Developer: Toggle Developer Tools"
3. Check the Console tab for extension logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This extension is licensed under the ISC License.

## 🙏 Acknowledgments

- Built with TypeScript and VS Code Extension API
- Integrates with the Feature Bundler core library
- Uses VS Code's tree view and status bar APIs

---

**Happy Bundling! 🎉**
```
