import path from "path";
import fs from "fs-extra";
import os from "os";
import { execSync } from "child_process";

describe("Edge Case Tests", () => {
  let tmpDir: string;
  let originalCwd: string;
  let bundleFeaturePath: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundleFeatureEdgeCases-"));
    bundleFeaturePath = path.resolve(originalCwd, "bundleFeature.ts");
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.removeSync(tmpDir);
  });

  beforeEach(() => {
    process.chdir(tmpDir);
    // Clean up any files from previous tests
    try {
      fs.removeSync("feature-context");
    } catch {}
    try {
      fs.removeSync("all_feature_files.txt");
    } catch {}
    try {
      fs.removeSync(".bundleFeature.cache.json");
    } catch {}
    try {
      fs.removeSync("bundleFeature.config.json");
    } catch {}
  });

  describe("File Extension Handling Tests", () => {
    beforeEach(() => {
      // Create test files with different extensions
      fs.ensureDirSync("src");
      fs.writeFileSync("src/module.js", "export const data = 'js';");
      fs.writeFileSync("src/module.ts", "export const data: string = 'ts';");
      fs.writeFileSync(
        "src/module.tsx",
        "export const Component = () => <div>tsx</div>;"
      );
      fs.writeFileSync(
        "src/module.jsx",
        "export const Component = () => <div>jsx</div>;"
      );
      fs.writeFileSync("src/module.rb", "class Module; end");
      fs.writeFileSync("src/module.json", '{"data": "json"}');
    });

    it("handles files with different extensions when importing without extension", () => {
      // Create a file that imports without extension
      fs.writeFileSync(
        "src/main.js",
        `
        import { data } from './module';
        console.log(data);
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("handles automatic extension resolution for .js files", () => {
      fs.writeFileSync(
        "src/main.js",
        `
        import { data } from './module.js';
        console.log(data);
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });

    it("handles automatic extension resolution for .ts files", () => {
      fs.writeFileSync(
        "src/main.ts",
        `
        import { data } from './module.ts';
        console.log(data);
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.ts`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });

    it("handles fallback extension logic when file doesn't exist", () => {
      fs.writeFileSync(
        "src/main.js",
        `
        import { data } from './missing';
        console.log(data);
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      // Should handle gracefully even if file doesn't exist
      expect(result).toContain("Found 1 files to process");
    });
  });

  describe("Directory Handling Tests", () => {
    beforeEach(() => {
      // Create a complex directory structure
      fs.ensureDirSync("src/components/Button");
      fs.ensureDirSync("src/utils/helpers");
      fs.ensureDirSync("src/styles");

      fs.writeFileSync(
        "src/components/Button/index.js",
        `
        import { helper } from '../../utils/helpers';
        export default function Button() { return helper(); }
      `
      );

      fs.writeFileSync(
        "src/components/Button/styles.css",
        `
        .button { color: red; }
      `
      );

      fs.writeFileSync(
        "src/utils/helpers/index.js",
        `
        import { format } from './formatter';
        export function helper() { return format('button'); }
      `
      );

      fs.writeFileSync(
        "src/utils/helpers/formatter.js",
        `
        export function format(text) { return \`<button>\${text}</button>\`; }
      `
      );

      fs.writeFileSync(
        "src/styles/main.css",
        `
        body { margin: 0; }
      `
      );
    });

    it("handles when references point to directories", () => {
      fs.writeFileSync(
        "src/main.js",
        `
        import Button from './components/Button';
        import './styles/main.css';
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("handles recursive directory copying", () => {
      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/components/Button/index.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");

      // Check if the feature-context directory contains the expected structure
      expect(fs.existsSync("feature-context")).toBe(true);
      const contextFiles = fs.readdirSync("feature-context");
      expect(contextFiles.length).toBeGreaterThan(0);
    });

    it("preserves directory structure in output", () => {
      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/components/Button/index.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");

      const output = fs.readFileSync("all_feature_files.txt", "utf8");
      // Should show directory structure in the output
      expect(output).toContain("src/components/Button");
    });
  });

  describe("Unicode/Special Characters Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
    });

    it("handles non-ASCII filenames", () => {
      const filename = "café.js";
      fs.writeFileSync(
        `src/${filename}`,
        `
        export const data = 'café';
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" "src/${filename}"`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("handles special characters in paths", () => {
      const dirName = "test-dir_with.special@chars";
      fs.ensureDirSync(`src/${dirName}`);
      fs.writeFileSync(
        `src/${dirName}/file.js`,
        `
        export const data = 'special';
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" "src/${dirName}/file.js"`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });

    it("handles Unicode in file content", () => {
      const content = `
        // 这是一个中文注释
        // こんにちは世界
        // Привет мир
        export const message = 'Hello 世界 🌍';
      `;

      fs.writeFileSync("src/unicode.js", content);

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/unicode.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");

      const output = fs.readFileSync("all_feature_files.txt", "utf8");
      expect(output).toContain("Hello 世界 🌍");
    });

    it("handles emoji in filenames", () => {
      const filename = "🚀-rocket.js";
      fs.writeFileSync(
        `src/${filename}`,
        `
        export const rocket = '🚀';
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" "src/${filename}"`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });
  });

  describe("Symlink Handling Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
      fs.ensureDirSync("lib");
      fs.writeFileSync(
        "lib/utility.js",
        `
        export const helper = () => 'helper';
      `
      );
    });

    it("handles symbolic links to files", () => {
      // Create a symlink
      fs.symlinkSync(
        path.resolve(tmpDir, "lib/utility.js"),
        path.join(tmpDir, "src/utility.js")
      );

      fs.writeFileSync(
        "src/main.js",
        `
        import { helper } from './utility.js';
        console.log(helper());
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });

    it("handles symbolic links to directories", () => {
      // Create a symlink to a directory
      fs.symlinkSync(path.resolve(tmpDir, "lib"), path.join(tmpDir, "src/lib"));

      fs.writeFileSync(
        "src/main.js",
        `
        import { helper } from './lib/utility.js';
        console.log(helper());
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });

    it("handles broken symlinks gracefully", () => {
      // Create a broken symlink
      fs.symlinkSync("/non/existent/path", path.join(tmpDir, "src/broken.js"));

      fs.writeFileSync(
        "src/main.js",
        `
        import { data } from './broken.js';
        console.log(data);
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      // Should handle gracefully
      expect(result).toContain("Found 1 files to process");
    });
  });

  describe("Large File Handling Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
    });

    it("handles files with many lines", () => {
      // Create a file with many lines
      const lines = Array.from({ length: 10000 }, (_, i) => `// Line ${i + 1}`);
      fs.writeFileSync("src/large.js", lines.join("\n"));

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/large.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("handles files with large content", () => {
      // Create a file with large content (but not too large for tests)
      const largeContent = "// " + "x".repeat(100000);
      fs.writeFileSync("src/large-content.js", largeContent);

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/large-content.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });
  });

  describe("Deep Dependency Chain Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
    });

    it("handles deep dependency chains", () => {
      // Create a chain of 10 files
      for (let i = 1; i <= 10; i++) {
        const content =
          i === 10
            ? "export const data = 'end';"
            : `import { data } from './file${
                i + 1
              }.js'; export const data = 'file${i}';`;

        fs.writeFileSync(`src/file${i}.js`, content);
      }

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" --depth=10 src/file1.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("respects depth limit in deep chains", () => {
      // Create a chain of 10 files
      for (let i = 1; i <= 10; i++) {
        const content =
          i === 10
            ? "export const data = 'end';"
            : `import { data } from './file${
                i + 1
              }.js'; export const data = 'file${i}';`;

        fs.writeFileSync(`src/file${i}.js`, content);
      }

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" --depth=3 src/file1.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");

      const output = fs.readFileSync("all_feature_files.txt", "utf8");
      // Should not include files beyond depth 3
      expect(output).not.toContain("file4.js");
    });
  });

  describe("Complex Alias Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
      fs.ensureDirSync("lib");
      fs.writeFileSync(
        "lib/utility.js",
        "export const helper = () => 'helper';"
      );
    });

    it("handles nested alias resolution", () => {
      const config = {
        files: ["src/main.js"],
        aliases: {
          "@": "src",
          "@lib": "lib",
          "@utils": "@lib",
        },
      };

      fs.writeFileSync(
        "bundleFeature.config.json",
        JSON.stringify(config, null, 2)
      );
      fs.writeFileSync(
        "src/main.js",
        `
        import { helper } from '@utils/utility.js';
        console.log(helper());
      `
      );

      const result = execSync(`npx ts-node "${bundleFeaturePath}"`, {
        encoding: "utf8",
        cwd: tmpDir,
      });

      expect(result).toContain("Found 1 files to process");
    });

    it("handles alias with special characters", () => {
      const config = {
        files: ["src/main.js"],
        aliases: {
          "@test-dir": "src",
          "@special@chars": "lib",
        },
      };

      fs.writeFileSync(
        "bundleFeature.config.json",
        JSON.stringify(config, null, 2)
      );
      fs.writeFileSync(
        "src/main.js",
        `
        import { helper } from '@special@chars/utility.js';
        console.log(helper());
      `
      );

      const result = execSync(`npx ts-node "${bundleFeaturePath}"`, {
        encoding: "utf8",
        cwd: tmpDir,
      });

      expect(result).toContain("Found 1 files to process");
    });
  });

  describe("Mixed Language Project Tests", () => {
    beforeEach(() => {
      fs.ensureDirSync("src");
      fs.ensureDirSync("ruby");
    });

    it("handles JavaScript and Ruby files together", () => {
      fs.writeFileSync(
        "src/main.js",
        `
        // JavaScript file
        console.log('JS');
      `
      );

      fs.writeFileSync(
        "ruby/helper.rb",
        `
        # Ruby file
        class Helper
          def self.help
            "Ruby helper"
          end
        end
      `
      );

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js ruby/helper.rb`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 2 files to process");
      expect(fs.existsSync("all_feature_files.txt")).toBe(true);
    });

    it("handles different import syntaxes", () => {
      fs.writeFileSync(
        "src/main.js",
        `
        import { data } from './module.js';
        const util = require('./util.js');
        console.log(data, util);
      `
      );

      fs.writeFileSync("src/module.js", "export const data = 'module';");
      fs.writeFileSync("src/util.js", "module.exports = { util: 'util' };");

      const result = execSync(
        `npx ts-node "${bundleFeaturePath}" src/main.js`,
        {
          encoding: "utf8",
          cwd: tmpDir,
        }
      );

      expect(result).toContain("Found 1 files to process");
    });
  });
});
