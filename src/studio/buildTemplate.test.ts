import { describe, it, expect } from "vitest";
import { buildTemplate } from "./buildTemplate";
import { parseFrontmatter } from "../parser";
import { validateArticle } from "../validate";

const aug23 = new Date(2026, 7, 23, 12, 0);

describe("buildTemplate", () => {
  it("必須5項目のキーを並べる", () => {
    const { data } = parseFrontmatter(buildTemplate(aug23));

    expect(Object.keys(data)).toEqual([
      "title",
      "slug",
      "date",
      "latestUpdate",
      "staff",
      "thumbnail",
    ]);
  });

  it("date と latestUpdate に渡した日付を入れる", () => {
    const { data } = parseFrontmatter(buildTemplate(aug23));

    expect(data.date).toBe("2026-08-23");
    expect(data.latestUpdate).toBe("2026-08-23");
  });

  it("月日を2桁にそろえる", () => {
    const { data } = parseFrontmatter(buildTemplate(new Date(2026, 0, 5, 12, 0)));

    expect(data.date).toBe("2026-01-05");
  });

  // toISOString() は UTC に変換するため、日本時間の未明で日付が1日ずれる
  it("UTC ではなくローカルの日付を使う", () => {
    const { data } = parseFrontmatter(buildTemplate(new Date(2026, 7, 24, 0, 30)));

    expect(data.date).toBe("2026-08-24");
  });

  // spec §9: 雛形のまま公開される事故を防ぐため値を入れない
  it("title / staff / thumbnail は空にする", () => {
    const { data } = parseFrontmatter(buildTemplate(aug23));

    expect(data.title).toBe("");
    expect(data.staff).toBe("");
    expect(data.thumbnail).toBe("");
  });

  it("雛形のままでは検証を通らない", () => {
    const issues = validateArticle(buildTemplate(aug23));

    expect(issues.map((issue) => issue.field)).toEqual(["title", "staff", "thumbnail"]);
  });

  it("本文の雛形を含む", () => {
    const { content } = parseFrontmatter(buildTemplate(aug23));

    expect(content).toContain("## 見出し");
    expect(content).toContain("本文をここに書きます。");
  });

  it("引数を省略すると今日の日付になる", () => {
    const { data } = parseFrontmatter(buildTemplate());
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    expect(data.date).toBe(today);
  });
});

// spec §3: 既定を日付にすることで、何もしなくても URL に日本語が入らない
describe("buildTemplate — slug", () => {
  const slugOf = (raw: string) => parseFrontmatter(raw).data.slug;

  it("既定は日付になる", () => {
    expect(slugOf(buildTemplate(aug23))).toBe("2026-08-23");
  });

  it("日本語を含まない", () => {
    expect(slugOf(buildTemplate(aug23))).toMatch(/^[\x20-\x7e]+$/);
  });

  it("既存に無ければ連番を付けない", () => {
    expect(slugOf(buildTemplate(aug23, ["2026-01-01"]))).toBe("2026-08-23");
  });

  // 同じ日に2本目を書くとき
  it("同じ日の slug があれば -2 にする", () => {
    expect(slugOf(buildTemplate(aug23, ["2026-08-23"]))).toBe("2026-08-23-2");
  });

  it("-2 も埋まっていれば -3 にする", () => {
    expect(slugOf(buildTemplate(aug23, ["2026-08-23", "2026-08-23-2"]))).toBe(
      "2026-08-23-3"
    );
  });

  it("飛んでいても空いている最小の番号を選ぶ", () => {
    expect(slugOf(buildTemplate(aug23, ["2026-08-23", "2026-08-23-3"]))).toBe(
      "2026-08-23-2"
    );
  });

  // 雛形は検証を通る値でなければならない（spec §9）
  it("入れた slug が検証を通る", () => {
    const raw = buildTemplate(aug23, ["2026-08-23"]);
    const slugIssues = validateArticle(raw).filter((issue) => issue.field === "slug");

    expect(slugIssues).toEqual([]);
  });
});
