import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { articleOgTags } from "./articleOgTags";

let root: string;
let logged: string[];

const INDEX_HTML = [
  "<!DOCTYPE html>",
  '<html lang="ja">',
  "  <head>",
  '    <meta charset="UTF-8" />',
  "    <title>私のサイト</title>",
  "  </head>",
  "  <body>",
  '    <div id="root"></div>',
  '    <script type="module" src="/assets/index-abc123.js"></script>',
  "  </body>",
  "</html>",
].join("\n");

const md = (lines: string[], body = "本文テキストです。") =>
  ["---", ...lines, "---", "", body].join("\n");

const BASE = [
  "title: 夏の更新",
  "date: 2026-10-12",
  "latestUpdate: 2026-10-13",
  "staff: 田中 花子",
  "thumbnail: 2026/10-12/0_1.png",
];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "as-og-"));
  mkdirSync(join(root, "src/articles"), { recursive: true });
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/index.html"), INDEX_HTML);
  logged = [];
  vi.spyOn(console, "log").mockImplementation((message: unknown) => {
    logged.push(String(message));
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const article = (filename: string, lines = BASE, body?: string) =>
  writeFileSync(join(root, "src/articles", filename), md(lines, body));

const run = (options: Partial<Parameters<typeof articleOgTags>[0]> = {}) => {
  const plugin = articleOgTags({
    siteUrl: "https://example.com",
    path: "/article/:slug",
    ...options,
  });
  plugin.configResolved({ root, build: { outDir: "dist" } });
  plugin.closeBundle();
  return plugin;
};

const written = (path: string) => readFileSync(join(root, "dist", path), "utf8");

describe("articleOgTags — 書き出し", () => {
  it("記事ごとに index.html を作る", () => {
    article("2026-10-12-夏の更新.md");

    run();

    expect(existsSync(join(root, "dist/article/2026-10-12-夏の更新/index.html"))).toBe(
      true
    );
  });

  it("フロントマターの slug をフォルダ名にする", () => {
    article("2026-10-12-夏の更新.md", [...BASE, "slug: summer"]);

    run();

    expect(existsSync(join(root, "dist/article/summer/index.html"))).toBe(true);
  });

  it("og:title に記事のタイトルを入れる", () => {
    article("2026-10-12-夏の更新.md");

    run();

    expect(written("article/2026-10-12-夏の更新/index.html")).toContain(
      '<meta property="og:title" content="夏の更新">'
    );
  });

  it("og:image を絶対URLにする", () => {
    article("2026-10-12-夏の更新.md");

    run();

    expect(written("article/2026-10-12-夏の更新/index.html")).toContain(
      'content="https://example.com/article_imgs/2026/10-12/0_1.png"'
    );
  });

  // 人間が開いたときの挙動は変えない（spec §18）
  it("元の script をそのまま残す", () => {
    article("2026-10-12-夏の更新.md");

    run();

    expect(written("article/2026-10-12-夏の更新/index.html")).toContain(
      '<script type="module" src="/assets/index-abc123.js"></script>'
    );
  });

  it("トップの index.html は書き換えない", () => {
    article("2026-10-12-夏の更新.md");

    run();

    expect(written("index.html")).toBe(INDEX_HTML);
  });

  it("書き出した件数を知らせる", () => {
    article("a.md");
    article("b.md");

    run();

    expect(logged.join("")).toContain("2 件");
  });

  it("複数の記事をそれぞれ書き出す", () => {
    article("a.md", [...BASE, "title: 記事A"]);
    article("b.md", [...BASE, "title: 記事B"]);

    run();

    expect(written("article/a/index.html")).toContain('content="記事A"');
    expect(written("article/b/index.html")).toContain('content="記事B"');
  });

  it("path の形を変えられる", () => {
    article("a.md");

    run({ path: "/blog/:slug" });

    expect(existsSync(join(root, "dist/blog/a/index.html"))).toBe(true);
  });
});

// title が2つあると先に書かれたほうが使われ、og: が重複するとどちらが
// 拾われるか分からない。どちらも静かに間違う（spec §18）
describe("articleOgTags — 元のタグを引き継がない", () => {
  it("元の title を残さない", () => {
    article("a.md");

    run();

    const html = written("article/a/index.html");
    expect(html).not.toContain("私のサイト");
    expect(html.match(/<title>/g)?.length).toBe(1);
  });

  it("元の og: タグを残さない", () => {
    writeFileSync(
      join(root, "dist/index.html"),
      INDEX_HTML.replace(
        "    <title>私のサイト</title>",
        '    <meta property="og:image" content="/top.png">\n    <title>私のサイト</title>'
      )
    );
    article("a.md");

    run();

    const html = written("article/a/index.html");
    expect(html).not.toContain("/top.png");
    expect(html.match(/og:image/g)?.length).toBe(1);
  });

  it("元の description を残さない", () => {
    writeFileSync(
      join(root, "dist/index.html"),
      INDEX_HTML.replace(
        "    <title>私のサイト</title>",
        '    <meta name="description" content="サイトの説明">'
      )
    );
    article("a.md");

    run();

    expect(written("article/a/index.html")).not.toContain("サイトの説明");
  });

  it("charset などの meta は残す", () => {
    article("a.md");

    run();

    expect(written("article/a/index.html")).toContain('<meta charset="UTF-8" />');
  });
});

describe("articleOgTags — 読む対象", () => {
  it("_ 始まりの下書きを無視する", () => {
    article("a.md");
    article("_draft.md");

    run();

    expect(existsSync(join(root, "dist/article/_draft/index.html"))).toBe(false);
    expect(logged.join("")).toContain("1 件");
  });

  it("md 以外を無視する", () => {
    article("a.md");
    writeFileSync(join(root, "src/articles/README.txt"), "よみもの");

    run();

    expect(logged.join("")).toContain("1 件");
  });

  it("articlesDir を変えられる", () => {
    mkdirSync(join(root, "content"), { recursive: true });
    writeFileSync(join(root, "content/a.md"), md(BASE));

    run({ articlesDir: "content" });

    expect(existsSync(join(root, "dist/article/a/index.html"))).toBe(true);
  });
});

// 日本語の slug（spec §3）
describe("articleOgTags — 日本語の slug", () => {
  it("フォルダ名は生のままにする", () => {
    article("2026-10-10-日本語の記事.md");

    run();

    expect(existsSync(join(root, "dist/article/2026-10-10-日本語の記事/index.html"))).toBe(
      true
    );
  });

  it("og:url は encode する", () => {
    article("2026-10-10-日本語の記事.md");

    run();

    expect(written("article/2026-10-10-日本語の記事/index.html")).toContain(
      "content=\"https://example.com/article/2026-10-10-%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E8%A8%98%E4%BA%8B\""
    );
  });
});

describe("articleOgTags — 説明文", () => {
  it("description があればそれを使う", () => {
    article("a.md", [...BASE, "description: 手で書いた説明"]);

    run();

    expect(written("article/a/index.html")).toContain('content="手で書いた説明"');
  });

  it("無ければ本文から作る", () => {
    article("a.md", BASE, "## 見出し\n\n本文から作られます。");

    run();

    expect(written("article/a/index.html")).toContain("見出し 本文から作られます。");
  });
});

// OGタグは共有されるまで壊れているか分からない。黙って諦めさせない（spec §18）
describe("articleOgTags — 止めるとき", () => {
  it("path に :slug が無ければ作る時点で例外", () => {
    expect(() =>
      articleOgTags({ siteUrl: "https://example.com", path: "/article" })
    ).toThrow(/:slug/);
  });

  it("siteUrl が絶対URLでなければ例外", () => {
    article("a.md");

    expect(() => run({ siteUrl: "example.com" })).toThrow(/siteUrl/);
  });

  it("記事のフォルダが無ければ例外", () => {
    expect(() => run({ articlesDir: "no-such-dir" })).toThrow(/読めませんでした/);
  });

  it("記事が0件なら例外", () => {
    expect(() => run()).toThrow(/1件もありません/);
  });

  it("出力に index.html が無ければ例外", () => {
    article("a.md");
    rmSync(join(root, "dist/index.html"));

    expect(() => run()).toThrow(/index\.html/);
  });

  it("index.html に </head> が無ければ例外", () => {
    article("a.md");
    writeFileSync(join(root, "dist/index.html"), "<html><body>a</body></html>");

    expect(() => run()).toThrow(/head/);
  });
});

describe("articleOgTags — プラグインの形", () => {
  it("ビルドのときだけ走る", () => {
    expect(articleOgTags({ siteUrl: "https://a.com", path: "/:slug" }).apply).toBe(
      "build"
    );
  });

  it("名前を持つ", () => {
    expect(articleOgTags({ siteUrl: "https://a.com", path: "/:slug" }).name).toContain(
      "article-system"
    );
  });

  // outDir が絶対パスで渡ってくる Vite でも動く
  it("outDir が絶対パスでも動く", () => {
    article("a.md");
    const plugin = articleOgTags({
      siteUrl: "https://example.com",
      path: "/article/:slug",
    });
    plugin.configResolved({ root, build: { outDir: join(root, "dist") } });
    plugin.closeBundle();

    expect(existsSync(join(root, "dist/article/a/index.html"))).toBe(true);
  });
});

describe("articleOgTags — 注入の形", () => {
  it("閉じタグのインデントに合わせる", () => {
    article("a.md");

    run();

    const lines = written("article/a/index.html").split("\n");
    const titleLine = lines.find((line) => line.includes("<title>"));
    const ogLine = lines.find((line) => line.includes("og:title"));

    expect(titleLine?.match(/^ */)?.[0]).toBe("    ");
    expect(ogLine?.match(/^ */)?.[0]).toBe("    ");
  });

  it("head を閉じたままにする", () => {
    article("a.md");

    run();

    const html = written("article/a/index.html");
    expect(html.match(/<\/head>/g)?.length).toBe(1);
    expect(html.indexOf("og:title")).toBeLessThan(html.indexOf("</head>"));
  });
});
