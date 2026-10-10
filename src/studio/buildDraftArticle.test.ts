import { describe, it, expect } from "vitest";
import { buildDraftArticle } from "./buildDraftArticle";
import type { Article } from "../types";

function md(front: Record<string, string>, body = "本文"): string {
  const lines = Object.entries(front).map(([key, value]) => `${key}: ${value}`);
  return ["---", ...lines, "---", "", body].join("\n");
}

const complete = {
  title: "夏の更新",
  date: "2026-08-23",
  latestUpdate: "2026-08-24",
  staff: "田中 花子",
  thumbnail: "art_0.webp",
};

function existing(date: string, title = "既存"): Article {
  return {
    slug: `${date}-${title}`,
    filename: `${date}-${title}.md`,
    title,
    date,
    latestUpdate: date,
    staff: "担当",
    thumbnail: "art.webp",
    content: "本文",
  };
}

describe("buildDraftArticle", () => {
  it("フロントマターの各項目を写す", () => {
    const article = buildDraftArticle(md(complete));

    expect(article).toMatchObject({
      title: "夏の更新",
      date: "2026-08-23",
      latestUpdate: "2026-08-24",
      staff: "田中 花子",
      thumbnail: "art_0.webp",
    });
  });

  it("フロントマターを除いた本文を content に入れる", () => {
    const article = buildDraftArticle(md(complete, "## 見出し\n\n本文..."));

    expect(article.content).toBe("\n## 見出し\n\n本文...");
  });

  it("filename に生成予定のファイル名を入れる", () => {
    const article = buildDraftArticle(md(complete));

    expect(article.filename).toBe("2026-08-23-夏の更新.md");
  });

  it("フロントマターが無くても落ちない", () => {
    const article = buildDraftArticle("## 見出しだけ");

    expect(article.title).toBe("");
    expect(article.date).toBe("");
    expect(article.content).toBe("## 見出しだけ");
  });
});

// spec §3: slug は URL に使う識別子
describe("buildDraftArticle — slug", () => {
  it("フロントマターの slug を使う", () => {
    const article = buildDraftArticle(md({ ...complete, slug: "summer-update" }));

    expect(article.slug).toBe("summer-update");
  });

  it("slug が無ければファイル名から拡張子を除く", () => {
    const article = buildDraftArticle(md(complete));

    expect(article.slug).toBe("2026-08-23-夏の更新");
  });

  // プレビューで「この URL になります」を出すために使う（spec §9）
  it("ファイル名と対応している", () => {
    const article = buildDraftArticle(md(complete));

    expect(`${article.slug}.md`).toBe(article.filename);
  });

  it("前後の空白を落とす", () => {
    const article = buildDraftArticle(md({ ...complete, slug: "  summer-update  " }));

    expect(article.slug).toBe("summer-update");
  });
});
