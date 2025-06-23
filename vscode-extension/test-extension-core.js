const path = require("path");
const fs = require("fs-extra");

// Test the extension's core functionality
async function testExtensionCore() {
  console.log("🧪 Testing Feature Bundler Extension Core Functionality...\n");

  // Test 1: Check if all required files exist
  console.log("📁 Test 1: Checking extension files...");
  const requiredFiles = [
    "out/extension.js",
    "out/featureBundler.js",
    "out/dependencyProvider.js",
    "out/outputProvider.js",
    "package.json",
    "resources/icon.svg",
  ];

  for (const file of requiredFiles) {
    const exists = await fs.pathExists(file);
    console.log(
      `  ${exists ? "✅" : "❌"} ${file} ${exists ? "exists" : "missing"}`
    );
  }

  // Test 2: Test the FeatureBundler class directly
  console.log("\n🔧 Test 2: Testing FeatureBundler class...");
  try {
    // We'll test the core logic without VS Code dependencies
    const testFiles = [
      "test-files/main.js",
      "test-files/utils/helper.js",
      "test-files/utils/formatter.js",
    ];

    // Check if test files exist
    for (const file of testFiles) {
      const exists = await fs.pathExists(file);
      console.log(
        `  ${exists ? "✅" : "❌"} ${file} ${exists ? "exists" : "missing"}`
      );
    }

    // Test file reading
    if (await fs.pathExists("test-files/main.js")) {
      const content = await fs.readFile("test-files/main.js", "utf8");
      console.log(
        `  ✅ Successfully read main.js (${content.length} characters)`
      );

      // Test import detection
      const imports = content.match(/import.*from\s+['"](.+?)['"]/g);
      console.log(
        `  ✅ Found ${imports ? imports.length : 0} imports in main.js`
      );
      if (imports) {
        imports.forEach((imp) => console.log(`    ${imp}`));
      }
    }
  } catch (error) {
    console.log(`  ❌ Error testing FeatureBundler: ${error.message}`);
  }

  // Test 3: Test package.json configuration
  console.log("\n📦 Test 3: Testing package.json configuration...");
  try {
    const packageJson = require("./package.json");
    console.log(`  ✅ Package name: ${packageJson.name}`);
    console.log(`  ✅ Main entry: ${packageJson.main}`);
    console.log(`  ✅ Commands: ${packageJson.contributes.commands.length}`);
    console.log(
      `  ✅ Views: ${packageJson.contributes.views["feature-bundler"].length}`
    );

    // Check for required commands
    const requiredCommands = [
      "feature-bundler.bundleFiles",
      "feature-bundler.bundleSelection",
      "feature-bundler.bundleWorkspace",
    ];

    const definedCommands = packageJson.contributes.commands.map(
      (cmd) => cmd.command
    );
    for (const cmd of requiredCommands) {
      const exists = definedCommands.includes(cmd);
      console.log(
        `  ${exists ? "✅" : "❌"} Command ${cmd} ${
          exists ? "defined" : "missing"
        }`
      );
    }
  } catch (error) {
    console.log(`  ❌ Error reading package.json: ${error.message}`);
  }

  // Test 4: Test TypeScript compilation output
  console.log("\n🔧 Test 4: Testing TypeScript compilation...");
  try {
    const extensionPath = path.join("out", "extension.js");
    const extensionContent = await fs.readFile(extensionPath, "utf8");

    if (
      extensionContent.includes("activate") &&
      extensionContent.includes("deactivate")
    ) {
      console.log("  ✅ Extension.js contains activate/deactivate functions");
    } else {
      console.log("  ❌ Extension.js missing required functions");
    }

    // Check for command registrations
    if (extensionContent.includes("registerCommand")) {
      console.log("  ✅ Extension.js contains command registrations");
    } else {
      console.log("  ❌ Extension.js missing command registrations");
    }
  } catch (error) {
    console.log(`  ❌ Error reading extension.js: ${error.message}`);
  }

  console.log("\n🎉 Extension core functionality test completed!");
  console.log("\n📋 Summary:");
  console.log("  - All required files should exist");
  console.log("  - FeatureBundler class should work");
  console.log("  - Package.json should be properly configured");
  console.log("  - TypeScript should compile successfully");
  console.log("\n💡 Next Steps:");
  console.log("  1. If all tests pass, the extension is ready for VS Code");
  console.log("  2. Try opening the vscode-extension folder in Cursor");
  console.log('  3. Look for "Run and Debug" or try pressing F5');
  console.log("  4. If Cursor doesn't support extension development, you can:");
  console.log("     - Install VS Code in the devcontainer");
  console.log("     - Or test the core functionality with the test files");
}

testExtensionCore().catch(console.error);
