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
    id: 0,
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

  it("既存記事が無ければ id は 0", () => {
    expect(buildDraftArticle(md(complete)).id).toBe(0);
  });

  // spec §3: Studio は date の初期値を今日にするので新規記事は末尾に付く
  it("既存記事より新しければ末尾の id になる", () => {
    const articles = [existing("2026-01-01"), existing("2026-05-01")];

    expect(buildDraftArticle(md(complete), articles).id).toBe(2);
  });

  it("既存記事より古ければ挿入される位置の id になる", () => {
    const articles = [existing("2026-01-01"), existing("2026-12-01")];

    expect(buildDraftArticle(md(complete), articles).id).toBe(1);
  });

  it("すべての既存記事より古ければ id は 0", () => {
    const articles = [existing("2026-12-01"), existing("2027-01-01")];

    expect(buildDraftArticle(md(complete), articles).id).toBe(0);
  });

  it("同じ日付の既存記事があればその後ろに入る", () => {
    const articles = [existing("2026-08-23")];

    expect(buildDraftArticle(md(complete), articles).id).toBe(1);
  });

  it("フロントマターが無くても落ちない", () => {
    const article = buildDraftArticle("## 見出しだけ");

    expect(article.title).toBe("");
    expect(article.date).toBe("");
    expect(article.content).toBe("## 見出しだけ");
  });
});
