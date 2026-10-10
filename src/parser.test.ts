import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./parser";

describe("parseFrontmatter", () => {
  it("フロントマターと本文を分離する", () => {
    const raw = [
      "---",
      "title: 記事タイトル",
      "date: 2026-08-23",
      "latestUpdate: 2026-08-23",
      "staff: 田中 花子",
      "thumbnail: art_0.webp",
      "---",
      "",
      "## 見出し",
      "",
      "本文...",
    ].join("\n");

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({
      title: "記事タイトル",
      date: "2026-08-23",
      latestUpdate: "2026-08-23",
      staff: "田中 花子",
      thumbnail: "art_0.webp",
    });
    expect(content).toBe("\n## 見出し\n\n本文...");
  });

  it("値の中のコロンは保たれる（最初のコロンだけで分割する）", () => {
    const raw = ["---", "title: 記事: その1", "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data.title).toBe("記事: その1");
  });

  it("CRLF 改行でも正しくパースする", () => {
    const raw = ["---", "title: 記事", "date: 2026-08-23", "---", "", "本文"].join("\r\n");

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({ title: "記事", date: "2026-08-23" });
    expect(content).toBe("\r\n本文");
  });

  it("フロントマターが無ければ例外を投げず全文を本文として返す", () => {
    const raw = "## 見出し\n\n本文...";

    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });

  it("フロントマターが閉じられていなければ全文を本文として返す", () => {
    const raw = ["---", "title: 記事", "", "本文"].join("\n");

    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });

  it("コロンを含まない行は読み飛ばす", () => {
    const raw = ["---", "# コメント", "title: 記事", "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data).toEqual({ title: "記事" });
  });

  it("キーと値の前後の空白を取り除く", () => {
    const raw = ["---", "  title  :   記事   ", "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data).toEqual({ title: "記事" });
  });

  it("値が空のキーは空文字になる", () => {
    const raw = ["---", "staff:", "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data.staff).toBe("");
  });

  // 引用符を外す処理は持たない。これを弾くのは validateArticle の役割（spec §3 / §6）
  it("引用符は値に含まれたまま残る", () => {
    const raw = ["---", 'title: "記事"', "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data.title).toBe('"記事"');
  });

  // YAML ではないため配列記法は解釈しない（spec §3）
  it("配列記法は文字列のまま返す", () => {
    const raw = ["---", "tags: [a, b]", "---", "", "本文"].join("\n");

    const { data } = parseFrontmatter(raw);

    expect(data.tags).toBe("[a, b]");
  });

  it("本文中の --- では区切らない（最初の閉じ --- までがフロントマター）", () => {
    const raw = ["---", "title: 記事", "---", "", "本文", "", "---", "", "続き"].join("\n");

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({ title: "記事" });
    expect(content).toBe("\n本文\n\n---\n\n続き");
  });
});

// spec §3: slug は URL に使う識別子。フロントマターに書けば優先される
describe("parseFrontmatter — slug", () => {
  it("slug を読む", () => {
    const { data } = parseFrontmatter(
      ["---", "title: 夏の更新", "slug: summer-update", "---", "", "本文"].join("\n")
    );

    expect(data.slug).toBe("summer-update");
  });

  it("日付だけの slug も読む", () => {
    const { data } = parseFrontmatter(
      ["---", "slug: 2026-10-09", "---", "", "本文"].join("\n")
    );

    expect(data.slug).toBe("2026-10-09");
  });

  it("連番付きの slug も読む", () => {
    const { data } = parseFrontmatter(
      ["---", "slug: 2026-10-09-2", "---", "", "本文"].join("\n")
    );

    expect(data.slug).toBe("2026-10-09-2");
  });

  it("書いていなければ undefined", () => {
    const { data } = parseFrontmatter(
      ["---", "title: 夏の更新", "---", "", "本文"].join("\n")
    );

    expect(data.slug).toBeUndefined();
  });

  it("前後の空白を落とす", () => {
    const { data } = parseFrontmatter(
      ["---", "slug:   summer-update  ", "---", "", "本文"].join("\n")
    );

    expect(data.slug).toBe("summer-update");
  });
});
