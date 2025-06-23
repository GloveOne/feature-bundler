import path from "path";
import fs from "fs-extra";

// Import the resolveAlias function from the main script
// We'll need to export it from bundleFeature.ts for this to work
import { resolveAlias } from "../bundleFeature";

describe("resolveAlias", () => {
  const configAliases = {
    "@": "../netvacinas-frontend/src",
    "~": "../netvacinas",
    components: "../netvacinas-frontend/src/components",
    services: "../netvacinas/app/services",
    graphql: "../netvacinas/app/graphql",
  };

  it("resolves @ alias", () => {
    const ref = "@/components/Button";
    const baseFile = "/project/file.ts";
    const result = resolveAlias(ref, baseFile, configAliases);
    expect(result).toBe(
      path.join(
        path.resolve("../netvacinas-frontend/src"),
        "/components/Button"
      )
    );
  });

  it("resolves ~ alias", () => {
    const ref = "~/utils/helper";
    const baseFile = "/project/file.ts";
    const result = resolveAlias(ref, baseFile, configAliases);
    expect(result).toBe(
      path.join(path.resolve("../netvacinas"), "/utils/helper")
    );
  });

  it("returns original ref if no alias matches", () => {
    const ref = "./local/file";
    const baseFile = "/project/file.ts";
    const result = resolveAlias(ref, baseFile, configAliases);
    expect(result).toBe("./local/file");
  });
});
