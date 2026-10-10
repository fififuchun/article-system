import { describe, it, expect } from "vitest";
import { validateArticle } from "./validate";
import type { Article } from "./types";

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

describe("validateArticle — 引用符", () => {
  it.each(REQUIRED)("%s が二重引用符で囲まれていれば error を返す", (field) => {
    const issues = validateArticle(md({ ...complete, [field]: '"値"' }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field });
  });

  it("一重引用符で囲まれていても error を返す", () => {
    const issues = validateArticle(md({ ...complete, title: "'記事'" }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "title" });
  });

  it("値の途中に引用符があるだけなら error にしない", () => {
    expect(validateArticle(md({ ...complete, title: '彼は"こう"言った' }))).toEqual([]);
  });

  it("片側にしか引用符が無ければ囲まれているとは見なさない", () => {
    expect(validateArticle(md({ ...complete, title: '"記事' }))).toEqual([]);
  });

  it("引用符付きの日付に形式エラーを重ねて出さない", () => {
    const issues = validateArticle(md({ ...complete, date: '"2026/08/23"' }));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("引用符");
  });

  it("未知のキーの値が引用符で囲まれていても error を返す", () => {
    const issues = validateArticle(md({ ...complete, tags: '"旅行"' }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "tags" });
  });
});

describe("validateArticle — フロントマターの閉じ忘れ", () => {
  const unclosed = ["---", "title: 記事", "date: 2026-08-23", "", "本文"].join("\n");

  it("閉じの --- が無ければ error を返す", () => {
    const issues = validateArticle(unclosed);

    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe("error");
  });

  it("閉じ忘れに必須項目の欠落を重ねて出さない", () => {
    expect(validateArticle(unclosed)).toHaveLength(1);
  });

  it("message で --- が閉じられていないことを伝える", () => {
    const [issue] = validateArticle(unclosed);

    expect(issue.message).toContain("---");
  });

  it("CRLF 改行の閉じ忘れも検出する", () => {
    const raw = ["---", "title: 記事", "", "本文"].join("\r\n");

    expect(validateArticle(raw)).toHaveLength(1);
  });

  it("--- で始まらなければ閉じ忘れとは見なさず必須5項目の欠落を返す", () => {
    const issues = validateArticle("## 見出し\n\n本文...");

    expect(issues.map((issue) => issue.field)).toEqual([...REQUIRED]);
  });

  it("空のフロントマターでも閉じてあれば必須5項目の欠落を返す", () => {
    const issues = validateArticle(["---", "", "---", "", "本文"].join("\n"));

    expect(issues.map((issue) => issue.field)).toEqual([...REQUIRED]);
  });

  it("正しく閉じていれば error にしない", () => {
    expect(validateArticle(md(complete))).toEqual([]);
  });

  it("本文中に --- があっても誤検出しない", () => {
    expect(validateArticle(md(complete, "本文\n\n---\n\n続き"))).toEqual([]);
  });
});

describe("validateArticle — 更新日と投稿日の前後関係", () => {
  it("latestUpdate が date より前なら error を返す", () => {
    const issues = validateArticle(
      md({ ...complete, date: "2026-08-23", latestUpdate: "2026-08-22" })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", field: "latestUpdate" });
  });

  it("latestUpdate と date が同じ日なら error にしない", () => {
    expect(
      validateArticle(md({ ...complete, date: "2026-08-23", latestUpdate: "2026-08-23" }))
    ).toEqual([]);
  });

  it("latestUpdate が date より後なら error にしない", () => {
    expect(
      validateArticle(md({ ...complete, date: "2026-08-23", latestUpdate: "2026-09-01" }))
    ).toEqual([]);
  });

  it("年をまたぐ前後関係も正しく判定する", () => {
    const issues = validateArticle(
      md({ ...complete, date: "2026-01-01", latestUpdate: "2025-12-31" })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: "latestUpdate" });
  });

  it("message に両方の日付を含める", () => {
    const [issue] = validateArticle(
      md({ ...complete, date: "2026-08-23", latestUpdate: "2026-08-22" })
    );

    expect(issue.message).toContain("2026-08-22");
    expect(issue.message).toContain("2026-08-23");
  });

  it("date が形式違反なら前後関係を判定しない", () => {
    const issues = validateArticle(
      md({ ...complete, date: "2026/08/23", latestUpdate: "2020-01-01" })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("YYYY-MM-DD");
  });

  it("latestUpdate が欠けていれば前後関係を判定しない", () => {
    const front = { ...complete };
    delete front.latestUpdate;

    const issues = validateArticle(md(front));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("入力されていません");
  });
});

describe("validateArticle — キー名の typo", () => {
  it("lastUpdate と書いたら latestUpdate の誤りだと提案する", () => {
    const front = { ...complete, lastUpdate: "2026-08-24" };
    delete front.latestUpdate;

    const issues = validateArticle(md(front));
    const suggestion = issues.find((issue) => issue.field === "lastUpdate");

    expect(suggestion).toBeDefined();
    expect(suggestion?.message).toContain("latestUpdate");
  });

  it("typo の提案と欠落の報告を両方返す", () => {
    const front = { ...complete, lastUpdate: "2026-08-24" };
    delete front.latestUpdate;

    const issues = validateArticle(md(front));

    expect(issues.map((issue) => issue.field)).toEqual(["latestUpdate", "lastUpdate"]);
  });

  it.each([
    ["titel", "title"],
    ["stuff", "staff"],
    ["thumbnai", "thumbnail"],
  ])("%s は %s の誤りだと提案する", (typo, expected) => {
    const issues = validateArticle(md({ ...complete, [typo]: "値" }));
    const suggestion = issues.find((issue) => issue.field === typo);

    expect(suggestion?.message).toContain(expected);
  });

  it("既知のキーだけなら提案しない", () => {
    expect(validateArticle(md(complete))).toEqual([]);
  });

  it("どの既知フィールドにも似ていない未知キーには提案しない", () => {
    expect(validateArticle(md({ ...complete, author: "田中 花子" }))).toEqual([]);
  });

  it("編集距離が3以上離れた未知キーには提案しない", () => {
    expect(validateArticle(md({ ...complete, tags: "旅行" }))).toEqual([]);
  });
});

describe("validateArticle — ファイル名の衝突", () => {
  const existing = (filename: string): Article => ({
    id: 0,
    filename,
    title: "既存記事",
    date: "2026-08-01",
    latestUpdate: "2026-08-01",
    staff: "田中 花子",
    thumbnail: "art_0.webp",
    content: "本文",
  });

  it("既存記事と同じファイル名なら error を返す", () => {
    const issues = validateArticle(md(complete), {
      articles: [existing("2026-08-23-夏の更新.md")],
      filename: "2026-08-23-夏の更新.md",
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe("error");
  });

  it("message に衝突したファイル名を含める", () => {
    const [issue] = validateArticle(md(complete), {
      articles: [existing("2026-08-23-夏の更新.md")],
      filename: "2026-08-23-夏の更新.md",
    });

    expect(issue.message).toContain("2026-08-23-夏の更新.md");
  });

  it("既存記事と別のファイル名なら error にしない", () => {
    expect(
      validateArticle(md(complete), {
        articles: [existing("2026-08-01-春の更新.md")],
        filename: "2026-08-23-夏の更新.md",
      })
    ).toEqual([]);
  });

  it("context を渡さなければ衝突を検査しない", () => {
    expect(validateArticle(md(complete))).toEqual([]);
  });

  it("articles が空なら error にしない", () => {
    expect(
      validateArticle(md(complete), { articles: [], filename: "2026-08-23-夏の更新.md" })
    ).toEqual([]);
  });

  it("filename が無ければ衝突を検査しない", () => {
    expect(
      validateArticle(md(complete), { articles: [existing("2026-08-23-夏の更新.md")] })
    ).toEqual([]);
  });

  it("複数の既存記事から衝突を見つける", () => {
    const issues = validateArticle(md(complete), {
      articles: [existing("a.md"), existing("b.md"), existing("c.md")],
      filename: "b.md",
    });

    expect(issues).toHaveLength(1);
  });

  it("フロントマターの問題と衝突を両方返す", () => {
    const front = { ...complete };
    delete front.staff;

    const issues = validateArticle(md(front), {
      articles: [existing("b.md")],
      filename: "b.md",
    });

    expect(issues).toHaveLength(2);
    expect(issues[0].field).toBe("staff");
  });
});

// spec §3: slug は URL のパスになる。成立しない文字は止める
describe("validateArticle — slug", () => {
  const withSlug = (slug: string) =>
    [
      "---",
      "title: 夏の更新",
      `slug: ${slug}`,
      "date: 2026-08-23",
      "latestUpdate: 2026-08-23",
      "staff: 田中 花子",
      "thumbnail: art_0.webp",
      "---",
      "",
      "本文",
    ].join("\n");

  const slugIssues = (slug: string) =>
    validateArticle(withSlug(slug)).filter((issue) => issue.field === "slug");

  // ★ここが通らないと slug を書いた全記事が検証で止まる
  it("slug 自体を未知の項目として警告しない", () => {
    expect(validateArticle(withSlug("2026-08-23"))).toEqual([]);
  });

  it.each(["2026-08-23", "2026-08-23-2", "summer-update", "夏の更新", "a_b.c"])(
    "使える slug を通す（%s）",
    (slug) => {
      expect(slugIssues(slug)).toEqual([]);
    }
  );

  // パスが割れて別の URL になる
  it("スラッシュを断る", () => {
    expect(slugIssues("blog/summer")[0]?.message).toContain("/");
  });

  // クエリとフラグメントの区切り。そこから先が URL として切られる
  it.each(["summer?x=1", "summer#top"])("クエリ・フラグメントの記号を断る（%s）", (slug) => {
    expect(slugIssues(slug)).toHaveLength(1);
  });

  it("空白を断る", () => {
    expect(slugIssues("summer update")).toHaveLength(1);
  });

  // 相対パスとして解釈され、別の場所を指す
  it.each([".", ".."])("ドットだけの slug を断る（%s）", (slug) => {
    expect(slugIssues(slug)).toHaveLength(1);
  });

  it.each([".hidden", "trailing."])("前後のドットを断る（%s）", (slug) => {
    expect(slugIssues(slug)).toHaveLength(1);
  });

  // slug は任意。書いていなければファイル名から作る（spec §3）
  it("書いていなければ何も言わない", () => {
    const raw = [
      "---",
      "title: 夏の更新",
      "date: 2026-08-23",
      "latestUpdate: 2026-08-23",
      "staff: 田中 花子",
      "thumbnail: art_0.webp",
      "---",
      "",
      "本文",
    ].join("\n");

    expect(validateArticle(raw)).toEqual([]);
  });

  it("空文字も書いていない扱いにする", () => {
    expect(slugIssues("")).toEqual([]);
  });

  it("理由が分かる文言にする", () => {
    expect(slugIssues("blog/summer")[0]?.message).toContain("URL");
  });
});
