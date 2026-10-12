import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("..", import.meta.url));

/** src 配下の .ts / .tsx を集める */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const isTest = (path: string) => /\.test\.tsx?$/.test(path);
const isViteEntry = (path: string) => path.includes(`${join("src", "vite")}`);

/**
 * spec §18: `node:fs` を使うのはビルド時に走る側だけ。読者のバンドルに
 * 混ざると、ブラウザ向けのビルドが解決できずに壊れる
 */
describe("読者のバンドルと Node 側の分離", () => {
  it("src/vite の外で node: を import しない", () => {
    const offenders = sourceFiles(srcDir)
      .filter((path) => !isTest(path) && !isViteEntry(path))
      .filter((path) => /from "node:/.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(srcDir, ""));

    expect(offenders).toEqual([]);
  });

  // 逆向き。プラグインが React を引き込むと、ビルド時に不要な依存が増える
  it("src/vite が react を import しない", () => {
    const offenders = sourceFiles(join(srcDir, "vite"))
      .filter((path) => !isTest(path))
      .filter((path) => /from "react/.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(srcDir, ""));

    expect(offenders).toEqual([]);
  });
});
