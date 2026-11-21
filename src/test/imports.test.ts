import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe("local module dependencies", () => {
  it("resolves every source import, including optional tools and the legacy quiz handler", () => {
    const missing: string[] = [];
    for (const file of [...sources(join(root, "src")), ...sources(join(root, "supabase/functions"))]) {
      const text = readFileSync(file, "utf8");
      const imports = text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g);
      for (const match of imports) {
        const spec = match[1]?.split("?")[0];
        if (!spec || (!spec.startsWith("@/") && !spec.startsWith("."))) continue;
        const path = spec.startsWith("@/") ? resolve(root, "src", spec.slice(2)) : resolve(dirname(file), spec);
        const candidates = [path, ...[".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".svg", ".png"].map((ext) => path + ext), ...[".ts", ".tsx", ".js"].map((ext) => join(path, "index" + ext))];
        if (!candidates.some(existsSync)) missing.push(`${file}: ${spec}`);
      }
    }
    expect(missing).toEqual([]);
  });
});