import { describe, it, expect } from "vitest";
import { createArticles } from "./createArticles";

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

  it("ソート後の index を id として 0 始まりで採番する", () => {
    const articles = createArticles({
      "../articles/2026-08-20-b.md": md({ title: "B", date: "2026-08-20" }),
      "../articles/2026-03-15-a.md": md({ title: "A", date: "2026-03-15" }),
      "../articles/2026-08-23-c.md": md({ title: "C", date: "2026-08-23" }),
    });

    expect(articles.map((article) => article.id)).toEqual([0, 1, 2]);
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
      id: 0,
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
    expect(articles.map((article) => article.id)).toEqual([0, 1]);
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

// 現在の実装が spec を満たしていない箇所。実装したら it.todo を it に変えて有効化する
describe("未実装（spec §14 の実装順序で対応する）", () => {
  it.todo("_ 始まりのファイルを受け取ったら例外を投げる — spec §4");
  it.todo("不正な date が混ざってもソート順が壊れない（文字列比較にする） — spec §5");
  it.todo("検証で問題が見つかったら console.warn で報告する — spec §5");
});
