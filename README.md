# Feature Bundler 🚀

A powerful TypeScript tool for bundling related files from your codebase into a single context file. Perfect for AI code analysis, documentation generation, and feature extraction.

## ✨ Features

- **🔍 Smart Dependency Resolution**: Automatically finds and includes referenced files
- **🌐 Glob Pattern Support**: Use wildcards to select multiple files
- **⚙️ Configuration File**: Define your file sets and aliases in JSON
- **🔄 Caching**: Fast incremental builds with intelligent caching
- **🎯 Multiple Languages**: Supports JavaScript, TypeScript, Ruby, and more
- **📁 Directory Handling**: Recursively processes directories and preserves structure
- **🔗 Alias Resolution**: Custom path aliases for cleaner imports
- **📊 Progress Tracking**: Verbose mode for detailed operation logging

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/feature-bundler.git
cd feature-bundler

# Install dependencies
npm install

# Run with TypeScript
npx ts-node bundleFeature.ts
```

### Basic Usage

```bash
# Bundle a single file
npx ts-node bundleFeature.ts src/components/Button.tsx

# Bundle multiple files
npx ts-node bundleFeature.ts src/**/*.ts lib/**/*.js

# Bundle with depth control
npx ts-node bundleFeature.ts --depth=3 src/main.ts

# Dry run to see what would be bundled
npx ts-node bundleFeature.ts --dry-run src/**/*.tsx
```

## 📖 Detailed Examples

### 1. React Component Bundling

Bundle a React component and all its dependencies:

```bash
# Bundle a Button component
npx ts-node bundleFeature.ts src/components/Button/Button.tsx

# This will include:
# - Button.tsx
# - Button.module.css
# - utils/helpers.ts (if imported)
# - types/index.ts (if imported)
# - And all their dependencies up to the specified depth
```

**Output Structure:**

```
===== src/components/Button/ =====

==================== src/components/Button/Button.tsx ====================

import React from 'react';
import styles from './Button.module.css';
import { formatText } from '../../utils/helpers';
import { ButtonProps } from '../../types';

export const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return (
    <button className={styles.button} {...props}>
      {formatText(children)}
    </button>
  );
};

==================== src/components/Button/Button.module.css ====================

.button {
  padding: 8px 16px;
  border-radius: 4px;
  background: #007bff;
  color: white;
  border: none;
  cursor: pointer;
}

===== src/utils/ =====

==================== src/utils/helpers.ts ====================

export const formatText = (text: string): string => {
  return text.trim().toLowerCase();
};
```

### 2. Configuration File Usage

Create `bundleFeature.config.json`:

```json
{
  "files": [
    "src/components/UploadShots/*.tsx",
    "src/components/UploadShots/*.ts",
    "src/utils/upload-helpers.ts"
  ],
  "depth": 3,
  "aliases": {
    "@": "src",
    "@components": "src/components",
    "@utils": "src/utils",
    "~": "."
  }
}
```

Then run:

```bash
npx ts-node bundleFeature.ts
```

### 3. Ruby Project Bundling

Bundle Ruby files with their dependencies:

```bash
# Bundle a Ruby service
npx ts-node bundleFeature.ts app/services/user_service.rb

# This will include:
# - user_service.rb
# - user_model.rb (if required)
# - validators/user_validator.rb (if required)
# - And all their dependencies
```

**Example Ruby Output:**

```
===== app/services/ =====

==================== app/services/user_service.rb ====================

require_relative '../models/user'
require_relative '../validators/user_validator'

class UserService
  def initialize
    @validator = UserValidator.new
  end

  def create_user(params)
    user = User.new(params)
    @validator.validate(user)
    user.save!
    user
  end
end

===== app/models/ =====

==================== app/models/user.rb ====================

class User < ApplicationRecord
  validates :email, presence: true, uniqueness: true
  validates :name, presence: true
end
```

### 4. Mixed Language Projects

Bundle files from different languages in one command:

```bash
# Bundle both JavaScript and Ruby files
npx ts-node bundleFeature.ts \
  src/components/DataTable.tsx \
  app/models/data_table.rb \
  lib/shared/constants.js
```

### 5. Advanced Glob Patterns

```bash
# Bundle all TypeScript files in src
npx ts-node bundleFeature.ts "src/**/*.ts"

# Bundle all React components
npx ts-node bundleFeature.ts "src/**/*.{tsx,jsx}"

# Bundle specific file types
npx ts-node bundleFeature.ts "src/**/*.{ts,tsx,js,jsx}" "lib/**/*.rb"

# Exclude test files
npx ts-node bundleFeature.ts "src/**/*.ts" --exclude "**/*.test.ts"
```

## ⚙️ Configuration

### Configuration File (`bundleFeature.config.json`)

```json
{
  "files": [
    "src/components/**/*.tsx",
    "src/utils/**/*.ts",
    "app/services/**/*.rb"
  ],
  "depth": 2,
  "aliases": {
    "@": "src",
    "@components": "src/components",
    "@utils": "src/utils",
    "~": ".",
    "DEVROOT": "/Development"
  }
}
```

### Configuration Options

| Option    | Type     | Default | Description                             |
| --------- | -------- | ------- | --------------------------------------- |
| `files`   | string[] | []      | Array of file patterns to bundle        |
| `depth`   | number   | 1       | Maximum depth for dependency resolution |
| `aliases` | object   | {}      | Path aliases for import resolution      |

### Environment Variables

You can use environment variables in your configuration:

```json
{
  "files": ["${PROJECT_ROOT}/src/**/*.ts", "${COMPONENTS_DIR}/**/*.tsx"],
  "aliases": {
    "@": "${PROJECT_ROOT}/src"
  }
}
```

## 🎛️ Command Line Options

| Option          | Description                                | Example               |
| --------------- | ------------------------------------------ | --------------------- |
| `--depth=N`     | Set maximum dependency depth               | `--depth=3`           |
| `--dry-run`     | Show what would be bundled without writing | `--dry-run`           |
| `--verbose`     | Enable verbose logging                     | `--verbose`           |
| `--no-cache`    | Disable caching                            | `--no-cache`          |
| `--output=FILE` | Specify output file                        | `--output=bundle.txt` |

## 🔧 Advanced Usage

### Custom Output Formats

```bash
# Output to custom file
npx ts-node bundleFeature.ts --output=my-feature.txt src/**/*.ts

# Use with other tools
npx ts-node bundleFeature.ts src/**/*.ts | grep "import"
```

### Integration with AI Tools

```bash
# Bundle for ChatGPT analysis
npx ts-node bundleFeature.ts src/components/Checkout/ > checkout-context.txt

# Bundle for documentation generation
npx ts-node bundleFeature.ts src/**/*.ts --output=api-docs-context.txt
```

### CI/CD Integration

```bash
# In your CI pipeline
npx ts-node bundleFeature.ts \
  --output=feature-context.txt \
  src/components/Feature/ \
  && curl -X POST \
    -H "Content-Type: text/plain" \
    --data-binary @feature-context.txt \
    https://your-ai-service.com/analyze
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- __tests__/bundleFeature.edgeCases.test.ts
npm test -- __tests__/bundleFeature.integration.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

**Test Coverage:**

- ✅ **60 tests passing** across all test suites
- ✅ Unit tests for core functions
- ✅ Integration tests for workflows
- ✅ Edge case tests for robustness

## 📁 Project Structure

```
feature-bundler/
├── bundleFeature.ts          # Main script
├── bundleFeature.config.json # Configuration file
├── __tests__/               # Test files
│   ├── bundleFeature.test.ts
│   ├── bundleFeature.highPriority.test.ts
│   ├── bundleFeature.integration.test.ts
│   └── bundleFeature.edgeCases.test.ts
├── feature-context/         # Generated context directory
├── all_feature_files.txt   # Generated output file
├── .bundleFeature.cache.json # Cache file
└── README.md               # This file
```

## 🔍 How It Works

1. **File Discovery**: Expands glob patterns to find target files
2. **Dependency Analysis**: Parses imports/requires to find dependencies
3. **Recursive Resolution**: Follows dependencies up to specified depth
4. **Alias Resolution**: Resolves custom path aliases
5. **File Copying**: Copies all files to context directory
6. **Output Generation**: Creates concatenated output file

### Supported Import Patterns

- **JavaScript/TypeScript**: `import`, `require()`
- **Ruby**: `require`, `require_relative`
- **Python**: `import`, `from ... import` (planned)
- **Go**: `import` (planned)

## 🚨 Troubleshooting

### Common Issues

**"No files found matching the provided patterns"**

```bash
# Check if your glob pattern is correct
npx ts-node bundleFeature.ts "src/**/*.ts" --verbose
```

**"Failed to parse bundleFeature.config.json"**

```bash
# Validate your JSON syntax
cat bundleFeature.config.json | jq .
```

**"Permission denied" errors**

```bash
# Check file permissions
ls -la src/components/
chmod +r src/components/Button.tsx
```

### Debug Mode

Enable verbose logging for debugging:

```bash
npx ts-node bundleFeature.ts --verbose src/**/*.ts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Add tests for your changes
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'feat: add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Uses `fs-extra` for enhanced file operations
- Uses `glob` for pattern matching
- Tested with Jest

---

**Happy Bundling! 🎉**
