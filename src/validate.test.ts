import { describe, it, expect } from "vitest";
import { validateArticle } from "./validate";

const REQUIRED = ["title", "date", "latestUpdate", "staff", "thumbnail"] as const;

const complete: Record<string, string> = {
  title: "記事タイトル",
  date: "2026-08-23",
  latestUpdate: "2026-08-24",
  staff: "田中 花子",
  thumbnail: "art_0.webp",
};

/** フロントマター付きの md 文字列を組み立てる */
function md(front: Record<string, string>, body = "本文"): string {
  const lines = Object.entries(front).map(([key, value]) => `${key}: ${value}`);
  return ["---", ...lines, "---", "", body].join("\n");
}

describe("validateArticle — 必須項目", () => {
  it("必須5項目がすべて揃っていれば問題を返さない", () => {
    expect(validateArticle(md(complete))).toEqual([]);
  });

  it.each(REQUIRED)("%s が欠けていれば error を1件返す", (missing) => {
    const front = { ...complete };
    delete front[missing];

    const issues = validateArticle(md(front));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: missing });
  });

  it.each(REQUIRED)("%s が空文字なら欠落として扱う", (empty) => {
    const issues = validateArticle(md({ ...complete, [empty]: "" }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: empty });
  });

  it("値が空白だけでも欠落として扱う", () => {
    const issues = validateArticle(md({ ...complete, staff: "   " }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "staff" });
  });

  it("複数欠けていれば欠けた数だけ返す", () => {
    const front = { ...complete };
    delete front.latestUpdate;
    delete front.thumbnail;

    const issues = validateArticle(md(front));

    expect(issues.map((issue) => issue.field)).toEqual(["latestUpdate", "thumbnail"]);
  });

  it("フロントマターが無ければ必須5項目すべてを欠落として返す", () => {
    const issues = validateArticle("## 見出し\n\n本文...");

    expect(issues.map((issue) => issue.field)).toEqual([...REQUIRED]);
  });

  it("message に欠けている項目名を含める", () => {
    const front = { ...complete };
    delete front.latestUpdate;

    const [issue] = validateArticle(md(front));

    expect(issue.message).toContain("latestUpdate");
  });

  it("未知のキーがあっても必須項目が揃っていれば問題を返さない", () => {
    expect(validateArticle(md({ ...complete, tags: "旅行" }))).toEqual([]);
  });
});
