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

describe("validateArticle — 日付の形式", () => {
  it.each(["date", "latestUpdate"] as const)(
    "%s がスラッシュ区切りなら error を返す",
    (field) => {
      const issues = validateArticle(md({ ...complete, [field]: "2026/08/23" }));

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ level: "error", field });
    }
  );

  it("月日が2桁でなければ error を返す", () => {
    const issues = validateArticle(md({ ...complete, date: "2026-8-23" }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "date" });
  });

  it("日付として読めない文字列なら error を返す", () => {
    const issues = validateArticle(md({ ...complete, date: "明日" }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "date" });
  });

  it("未来日は error にしない（spec §3 で許可している）", () => {
    expect(validateArticle(md({ ...complete, date: "2099-01-01", latestUpdate: "2099-01-01" }))).toEqual([]);
  });

  it("欠落している日付に形式エラーを重ねて出さない", () => {
    const front = { ...complete };
    delete front.date;

    const issues = validateArticle(md(front));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("入力されていません");
  });

  it("message に正しい形式の例を含める", () => {
    const [issue] = validateArticle(md({ ...complete, date: "2026/08/23" }));

    expect(issue.message).toContain("YYYY-MM-DD");
  });
});
