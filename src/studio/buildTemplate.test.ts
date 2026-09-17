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
