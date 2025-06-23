import path from "path";
import fs from "fs-extra";
import os from "os";
import { resolveAlias } from "../bundleFeature";

// --- expandVars ---
describe("expandVars", () => {
  const expandVars = require("../bundleFeature").expandVars;

  it("expands a single variable in a string", () => {
    expect(expandVars("Hello, ${name}!", { name: "World" })).toBe(
      "Hello, World!"
    );
  });

  it("expands multiple variables in a string", () => {
    expect(
      expandVars("${greet}, ${name}!", { greet: "Hi", name: "Alice" })
    ).toBe("Hi, Alice!");
  });

  it("leaves unknown variables empty", () => {
    expect(expandVars("Hello, ${missing}!", {})).toBe("Hello, !");
  });

  it("handles variables at start, middle, and end", () => {
    expect(expandVars("${a}b${c}d${e}", { a: "A", c: "C", e: "E" })).toBe(
      "AbCdE"
    );
  });
});

// --- expandGlobs ---
describe("expandGlobs", () => {
  const expandGlobs = require("../bundleFeature").expandGlobs;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "expandGlobsTest-"));
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "A");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "B");
    fs.writeFileSync(path.join(tmpDir, "c.js"), "C");
    fs.mkdirSync(path.join(tmpDir, "sub"));
    fs.writeFileSync(path.join(tmpDir, "sub", "d.txt"), "D");
  });

  afterAll(() => {
    fs.removeSync(tmpDir);
  });

  it("expands a single glob pattern to matching files", () => {
    const result = expandGlobs([path.join(tmpDir, "*.txt")]);
    expect(result.map((f: string) => path.basename(f)).sort()).toEqual(
      ["a.txt", "b.txt"].sort()
    );
  });

  it("expands multiple glob patterns", () => {
    const result = expandGlobs([
      path.join(tmpDir, "*.txt"),
      path.join(tmpDir, "*.js"),
    ]);
    expect(result.map((f: string) => path.basename(f)).sort()).toEqual(
      ["a.txt", "b.txt", "c.js"].sort()
    );
  });

  it("handles non-glob (literal) file paths", () => {
    const file = path.join(tmpDir, "a.txt");
    const result = expandGlobs([file]);
    expect(result).toContain(file);
  });

  it("deduplicates files if matched by multiple patterns", () => {
    const result = expandGlobs([
      path.join(tmpDir, "*.txt"),
      path.join(tmpDir, "a.*"),
    ]);
    // "a.txt" should only appear once
    expect(
      result.filter((f: string) => path.basename(f) === "a.txt").length
    ).toBe(1);
  });

  it("handles patterns with no matches", () => {
    expect(expandGlobs([path.join(tmpDir, "no-such-file-*.txt")])).toEqual([]);
  });
});

// --- resolveAlias ---
describe("resolveAlias", () => {
  const aliases = {
    "@": "/project/src",
    "@components": "/project/src/components",
    "~": "/project/root",
  };

  it("resolves a reference with a matching alias", () => {
    expect(resolveAlias("@/foo", "/base/file.ts", aliases)).toBe(
      path.join(path.resolve("/project/src"), "/foo")
    );
  });

  it("resolves a reference that exactly matches an alias", () => {
    expect(resolveAlias("@", "/base/file.ts", aliases)).toBe(
      path.join(path.resolve("/project/src"), "")
    );
  });

  it("handles overlapping aliases", () => {
    expect(resolveAlias("@components/Button", "/base/file.ts", aliases)).toBe(
      path.join(path.resolve("/project/src/components"), "/Button")
    );
  });

  it("returns the original reference if no alias matches", () => {
    expect(resolveAlias("./local/file", "/base/file.ts", aliases)).toBe(
      "./local/file"
    );
  });
});

// --- findReferences ---
describe("findReferences", () => {
  const findReferences = require("../bundleFeature").findReferences;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "findReferencesTest-"));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it("finds direct references in a file", () => {
    const a = path.join(tmpDir, "a.js");
    const b = path.join(tmpDir, "b.js");
    fs.writeFileSync(a, `import something from "./b.js";`);
    fs.writeFileSync(b, `// b.js`);
    const result = findReferences([a], 1, new Set());
    expect(
      (Array.from(result) as string[]).map((f: string) => path.basename(f))
    ).toContain("b.js");
  });

  it("recursively finds references up to the specified depth", () => {
    const a = path.join(tmpDir, "a.js");
    const b = path.join(tmpDir, "b.js");
    const c = path.join(tmpDir, "c.js");
    fs.writeFileSync(a, `import something from "./b.js";`);
    fs.writeFileSync(b, `import something from "./c.js";`);
    fs.writeFileSync(c, `// c.js`);
    const result = findReferences([a], 2, new Set());
    expect(
      (Array.from(result) as string[]).map((f: string) => path.basename(f))
    ).toContain("c.js");
  });

  it("handles circular references without infinite loop", () => {
    const a = path.join(tmpDir, "a.js");
    const b = path.join(tmpDir, "b.js");
    fs.writeFileSync(a, `import something from "./b.js";`);
    fs.writeFileSync(b, `import something from "./a.js";`);
    const result = findReferences([a], 5, new Set());
    // Should not throw or loop forever, and should contain both files
    expect(
      (Array.from(result) as string[])
        .map((f: string) => path.basename(f))
        .sort()
    ).toEqual(["a.js", "b.js"].sort());
  });

  it("handles references to non-existent files", () => {
    const a = path.join(tmpDir, "a.js");
    fs.writeFileSync(a, `import something from "./missing.js";`);
    const result = findReferences([a], 1, new Set());
    // Should not throw, and should not include missing.js
    expect(
      (Array.from(result) as string[]).map((f: string) => path.basename(f))
    ).not.toContain("missing.js");
  });

  it("handles different import syntaxes (JS/TS/Ruby)", () => {
    const a = path.join(tmpDir, "a.js");
    const b = path.join(tmpDir, "b.js");
    const c = path.join(tmpDir, "c.rb");
    fs.writeFileSync(a, `const x = require("./b.js");`);
    fs.writeFileSync(b, `require_relative 'c.rb'`);
    fs.writeFileSync(c, `# Ruby file`);
    const result = findReferences([a], 2, new Set());
    expect(
      (Array.from(result) as string[]).map((f: string) => path.basename(f))
    ).toContain("c.rb");
  });
});
