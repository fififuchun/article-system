import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createArticles } from "./createArticles";

// createArticles は問題のある記事を console.warn で報告する（spec §5）。
// 既存のテストは必須項目を省いた md を使うため、出力を抑えつつ呼び出しを検査できるようにする
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

beforeEach(() => {
  warn.mockClear();
});

/** import.meta.glob が返すのと同じ形の生データを組み立てる */
function md(front: Record<string, string>, body = "本文"): string {
  const lines = Object.entries(front).map(([key, value]) => `${key}: ${value}`);
  return ["---", ...lines, "---", "", body].join("\n");
}

describe("createArticles", () => {
  it("date 昇順に並べ替える", () => {
    const articles = createArticles({
      "../articles/2026-08-20-b.md": md({ title: "B", date: "2026-08-20" }),
      "../articles/2026-03-15-a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/2026-08-23-c.md": md({ title: "C", date: "2026-08-23" }),
    });

    expect(articles.map((article) => article.title)).toEqual(["A", "B", "C"]);
  });

  it("date 昇順で返す", () => {
    const articles = createArticles({
      "../articles/2026-08-20-b.md": md({ title: "B", date: "2026-08-20" }),
      "../articles/2026-03-15-a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/2026-08-23-c.md": md({ title: "C", date: "2026-08-23" }),
    });

    expect(articles.map((article) => article.title)).toEqual(["A", "B", "C"]);
  });

  it("フロントマターの全項目を Article に写す", () => {
    const [article] = createArticles({
      "../articles/2026-08-23-a.md": md({
        title: "記事タイトル",
        date: "2026-08-23",
        latestUpdate: "2026-08-24",
        staff: "田中 花子",
        thumbnail: "art_0.webp",
      }),
    });

    expect(article).toEqual({
      slug: "2026-08-23-a",
      filename: "2026-08-23-a.md",
      title: "記事タイトル",
      date: "2026-08-23",
      latestUpdate: "2026-08-24",
      staff: "田中 花子",
      thumbnail: "art_0.webp",
      content: "\n本文",
    });
  });

  it("欠けているフィールドは空文字で埋める", () => {
    const [article] = createArticles({
      "../articles/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(article.latestUpdate).toBe("");
    expect(article.staff).toBe("");
    expect(article.thumbnail).toBe("");
  });

  it("フロントマターを除いた本文を content に入れる", () => {
    const [article] = createArticles({
      "../articles/2026-08-23-a.md": md(
        { title: "記事", date: "2026-08-23" },
        "## 見出し\n\n本文..."
      ),
    });

    expect(article.content).toBe("\n## 見出し\n\n本文...");
  });

  it("フロントマターが無いファイルは全文を content にして各項目を空文字にする", () => {
    const [article] = createArticles({
      "../articles/2026-08-23-a.md": "## 見出し\n\n本文...",
    });

    expect(article.title).toBe("");
    expect(article.date).toBe("");
    expect(article.content).toBe("## 見出し\n\n本文...");
  });

  it("空の入力には空配列を返す", () => {
    expect(createArticles({})).toEqual([]);
  });

  it("同じ date の記事があっても全件返す", () => {
    const articles = createArticles({
      "../articles/2026-08-23-a.md": md({ title: "A", date: "2026-08-23" }),
      "../articles/2026-08-23-b.md": md({ title: "B", date: "2026-08-23" }),
    });

    expect(articles).toHaveLength(2);
    expect(articles.map((article) => article.title).sort()).toEqual(["A", "B"]);
  });
});

describe("createArticles — filename", () => {
  it("拡張子付きのファイル名を filename に入れる — spec §3", () => {
    const [article] = createArticles({
      "../articles/2026-08-23-夏の更新.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(article.filename).toBe("2026-08-23-夏の更新.md");
  });

  it("ディレクトリ部分を落としてファイル名だけを取る", () => {
    const [article] = createArticles({
      "/src/content/blog/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(article.filename).toBe("2026-08-23-a.md");
  });

  it("記事ごとに対応するファイル名が入る（ソート後も対応が崩れない）", () => {
    const articles = createArticles({
      "../articles/2026-08-20-b.md": md({ title: "B", date: "2026-08-20" }),
      "../articles/2026-03-15-a.md": md({ title: "A", date: "2026-03-15" }),
    });

    expect(articles.map((article) => [article.title, article.filename])).toEqual([
      ["A", "2026-03-15-a.md"],
      ["B", "2026-08-20-b.md"],
    ]);
  });
});

describe("createArticles — 下書きの混入", () => {
  it("_ 始まりのファイルを受け取ったら例外を投げる — spec §4", () => {
    expect(() =>
      createArticles({
        "../articles/_2026-08-23-書きかけ.md": md({ title: "書きかけ", date: "2026-08-23" }),
      })
    ).toThrow();
  });

  it("公開ファイルに1件でも混ざっていれば例外を投げる", () => {
    expect(() =>
      createArticles({
        "../articles/2026-08-20-b.md": md({ title: "B", date: "2026-08-20" }),
        "../articles/_2026-08-23-書きかけ.md": md({ title: "書きかけ", date: "2026-08-23" }),
      })
    ).toThrow();
  });

  it("例外のメッセージに混入したファイル名を含める", () => {
    expect(() =>
      createArticles({
        "../articles/_2026-08-23-書きかけ.md": md({ title: "書きかけ", date: "2026-08-23" }),
      })
    ).toThrow("_2026-08-23-書きかけ.md");
  });

  it("例外のメッセージに直し方（[!_]*.md）を含める", () => {
    expect(() =>
      createArticles({
        "../articles/_下書き.md": md({ title: "書きかけ", date: "2026-08-23" }),
      })
    ).toThrow("[!_]*.md");
  });

  it("公開ファイルだけなら例外を投げない", () => {
    expect(() =>
      createArticles({
        "../articles/2026-08-23-a.md": md({ title: "A", date: "2026-08-23" }),
      })
    ).not.toThrow();
  });

  it("ディレクトリ名の _ では例外を投げない（見るのはファイル名だけ）", () => {
    expect(() =>
      createArticles({
        "/src/_drafts/2026-08-23-a.md": md({ title: "A", date: "2026-08-23" }),
      })
    ).not.toThrow();
  });
});

describe("createArticles — 不正な date が混ざったときのソート", () => {
  it("不正な date が混ざってもソート順が壊れない（文字列比較にする） — spec §5", () => {
    const articles = createArticles({
      "../articles/x.md": md({ title: "X", date: "x" }),
      "../articles/2026.md": md({ title: "2026", date: "2026-01-01" }),
      "../articles/2025.md": md({ title: "2025", date: "2025-01-01" }),
    });

    // 正しい日付同士の相対順が保たれることが本質。
    // 文字列比較では "x" > "2..." のため不正な値は末尾に寄る
    expect(articles.map((article) => article.title)).toEqual(["2025", "2026", "X"]);
  });

  it("不正な date があっても正しい日付同士の前後関係は保たれる", () => {
    const articles = createArticles({
      "../articles/x.md": md({ title: "X", date: "2026/03/01" }),
      "../articles/c.md": md({ title: "C", date: "2026-08-23" }),
      "../articles/a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/b.md": md({ title: "B", date: "2026-08-20" }),
    });

    const titles = articles.map((article) => article.title);

    expect(titles.indexOf("A")).toBeLessThan(titles.indexOf("B"));
    expect(titles.indexOf("B")).toBeLessThan(titles.indexOf("C"));
  });

  it("date が空の記事は先頭に来る", () => {
    const articles = createArticles({
      "../articles/a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/empty.md": md({ title: "空", date: "" }),
    });

    expect(articles.map((article) => article.title)).toEqual(["空", "A"]);
  });

  it("不正な date が混ざっても全件返す", () => {
    const articles = createArticles({
      "../articles/x.md": md({ title: "X", date: "x" }),
      "../articles/a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/b.md": md({ title: "B", date: "2026-08-20" }),
    });

    expect(articles).toHaveLength(3);
  });
});

describe("createArticles — 検証結果の報告", () => {
  const complete = {
    title: "記事タイトル",
    date: "2026-08-23",
    latestUpdate: "2026-08-24",
    staff: "田中 花子",
    thumbnail: "art_0.webp",
  };

  it("検証で問題が見つかったら console.warn で報告する — spec §5", () => {
    createArticles({
      "../articles/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("問題が無ければ console.warn を呼ばない", () => {
    createArticles({ "../articles/2026-08-23-a.md": md(complete) });

    expect(warn).not.toHaveBeenCalled();
  });

  it("報告にファイル名を含める", () => {
    createArticles({
      "../articles/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(warn.mock.calls[0][0]).toContain("2026-08-23-a.md");
  });

  it("報告に問題の内容を含める", () => {
    createArticles({
      "../articles/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(warn.mock.calls[0][0]).toContain("staff");
  });

  it("問題のある記事ごとに報告する", () => {
    createArticles({
      "../articles/a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/b.md": md({ title: "B", date: "2026-08-20" }),
      "../articles/c.md": md({ ...complete, date: "2026-08-23" }),
    });

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("問題があっても例外は投げず記事を返す", () => {
    const articles = createArticles({
      "../articles/2026-08-23-a.md": md({ title: "記事", date: "2026-08-23" }),
    });

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("記事");
  });
});

// spec §3: slug は URL に使う識別子。id の index と違い、記事を足しても動かない
describe("createArticles — slug", () => {
  const body = [
    "title: 夏の更新",
    "date: 2026-08-23",
    "latestUpdate: 2026-08-23",
    "staff: 田中 花子",
    "thumbnail: art_0.webp",
  ];

  const md = (extra: string[] = []) =>
    ["---", ...body, ...extra, "---", "", "本文"].join("\n");

  it("フロントマターの slug を使う", () => {
    const [article] = createArticles({
      "/src/articles/2026-08-23-夏の更新.md": md(["slug: summer-update"]),
    });

    expect(article.slug).toBe("summer-update");
  });

  // 既存記事のための後方互換（spec §3）
  it("slug が無ければファイル名から拡張子を除く", () => {
    const [article] = createArticles({
      "/src/articles/2026-08-23-夏の更新.md": md(),
    });

    expect(article.slug).toBe("2026-08-23-夏の更新");
  });

  it("パスではなくファイル名だけを使う", () => {
    const [article] = createArticles({
      "/deep/nested/src/articles/2026-08-23-夏の更新.md": md(),
    });

    expect(article.slug).toBe("2026-08-23-夏の更新");
  });

  // ★これが id との決定的な違い。古い日付の記事を足しても動かない
  it("古い日付の記事を足しても既存の slug が変わらない", () => {
    const before = createArticles({
      "/a/2026-08-23-夏.md": md(),
      "/a/2026-09-01-秋.md": md(["slug: autumn"]),
    });

    const after = createArticles({
      "/a/2026-01-01-冬.md": md(["slug: winter"]),
      "/a/2026-08-23-夏.md": md(),
      "/a/2026-09-01-秋.md": md(["slug: autumn"]),
    });

    const slugOf = (list: typeof before, name: string) =>
      list.find((article) => article.filename === name)?.slug;

    expect(slugOf(before, "2026-08-23-夏.md")).toBe(slugOf(after, "2026-08-23-夏.md"));
    expect(slugOf(before, "2026-09-01-秋.md")).toBe(slugOf(after, "2026-09-01-秋.md"));
  });

  it("日付の昇順は保つ", () => {
    // md() の date は固定なので、ここだけ日付を差し替える
    const dated = (date: string, slug: string) =>
      md([`slug: ${slug}`]).replace("date: 2026-08-23", `date: ${date}`);

    const articles = createArticles({
      "/a/秋.md": dated("2026-09-01", "autumn"),
      "/a/冬.md": dated("2026-01-01", "winter"),
    });

    expect(articles.map((article) => article.slug)).toEqual(["winter", "autumn"]);
  });
});

// spec §3: 同じ slug が2つあると片方が開けない。例外は投げない（記事は読める）
describe("createArticles — slug の重複", () => {
  const body = [
    "title: 記事",
    "date: 2026-08-23",
    "latestUpdate: 2026-08-23",
    "staff: 田中 花子",
    "thumbnail: art_0.webp",
  ];
  const md = (extra: string[] = []) =>
    ["---", ...body, ...extra, "---", "", "本文"].join("\n");

  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const warnings = () =>
    warn.mock.calls.map((call: unknown[]) => String(call[0])).join("\n");

  it("重複していれば警告する", () => {
    createArticles({
      "/a/夏.md": md(["slug: summer"]),
      "/a/夏2.md": md(["slug: summer"]),
    });

    expect(warnings()).toContain("summer");
  });

  it("どのファイルが重複しているかを挙げる", () => {
    createArticles({
      "/a/夏.md": md(["slug: summer"]),
      "/a/夏2.md": md(["slug: summer"]),
    });

    expect(warnings()).toContain("夏.md");
    expect(warnings()).toContain("夏2.md");
  });

  it("片方が開けなくなることを伝える", () => {
    createArticles({
      "/a/夏.md": md(["slug: summer"]),
      "/a/夏2.md": md(["slug: summer"]),
    });

    expect(warnings()).toMatch(/開け|表示/);
  });

  it("重複が無ければ slug については警告しない", () => {
    createArticles({
      "/a/夏.md": md(["slug: summer"]),
      "/a/秋.md": md(["slug: autumn"]),
    });

    expect(warnings()).not.toContain("slug");
  });

  // 例外を投げない。記事そのものは読める（spec §5）
  it("重複していても記事は返す", () => {
    const articles = createArticles({
      "/a/夏.md": md(["slug: summer"]),
      "/a/夏2.md": md(["slug: summer"]),
    });

    expect(articles).toHaveLength(2);
  });

  it("3つ以上の重複もまとめて挙げる", () => {
    createArticles({
      "/a/1.md": md(["slug: summer"]),
      "/a/2.md": md(["slug: summer"]),
      "/a/3.md": md(["slug: summer"]),
    });

    expect(warnings()).toContain("3.md");
  });

  // ファイル名由来の slug は拡張子を除いただけなので、ファイル名が違えば重複しない
  it("ファイル名由来なら重複しない", () => {
    createArticles({
      "/a/夏.md": md(),
      "/a/秋.md": md(),
    });

    expect(warnings()).not.toContain("slug");
  });
});
