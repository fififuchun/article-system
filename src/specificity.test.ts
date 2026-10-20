import { describe, it, expect } from "vitest";
import { specificity, splitSelectorList, compare, format } from "./specificity";

const of = (selector: string) => format(specificity(selector));

describe("specificity — 基本", () => {
  it.each([
    ["*", "0.0.0"],
    ["h2", "0.0.1"],
    ["html body", "0.0.2"],
    [".my-title", "0.1.0"],
    ["#header", "1.0.0"],
    ["[type='button']", "0.1.0"],
    [":disabled", "0.1.0"],
    ["::before", "0.0.1"],
    ["a.link", "0.1.1"],
    ["html body .as-studio-login button", "0.1.3"],
  ])("%s は %s", (selector, want) => {
    expect(of(selector)).toBe(want);
  });
});

// spec §10: :where() は中身を数えない。だから詳細度を0に保てる
describe("specificity — :where()", () => {
  it.each([
    [":where(.as-heading)", "0.0.0"],
    ["html body :where(.as-heading)", "0.0.2"],
    [":where(.as-article ul, .as-article ol)", "0.0.0"],
    [':where(.as-studio-tabs button[aria-selected="true"])', "0.0.0"],
    [":where(.as-studio-dialog)::backdrop", "0.0.1"],
    ["html body :where(.as-studio-dialog)::backdrop", "0.0.3"],
    // Tailwind v3 が自分で使っている書き方
    ["input:where([type='button'])", "0.0.1"],
    ["abbr:where([title])", "0.0.1"],
  ])("%s は %s", (selector, want) => {
    expect(of(selector)).toBe(want);
  });
});

describe("specificity — :is() / :not() は引数の最大を取る", () => {
  it.each([
    [":not(.a)", "0.1.0"],
    [":not(h2)", "0.0.1"],
    [":is(.a, h2)", "0.1.0"],
    ["button:not(:disabled)", "0.1.1"],
    ['[hidden]:where(:not([hidden="until-found"]))', "0.1.0"],
  ])("%s は %s", (selector, want) => {
    expect(of(selector)).toBe(want);
  });
});

// spec §10 ★重要: クラス1つは型セレクタ何個にも勝つ
describe("compare — 桁の優先順位", () => {
  it("クラス1つは型セレクタ2つに勝つ", () => {
    expect(compare(specificity(".a"), specificity("html body"))).toBeGreaterThan(0);
  });

  it("クラス1つは型セレクタ99個にも勝つ", () => {
    const many = Array(99).fill("div").join(" ");
    expect(compare(specificity(".a"), specificity(many))).toBeGreaterThan(0);
  });

  it("型セレクタ2つは1つに勝つ", () => {
    expect(compare(specificity("html body"), specificity("h2"))).toBeGreaterThan(0);
  });

  it("id はクラスいくつにも勝つ", () => {
    expect(compare(specificity("#a"), specificity(".a.b.c"))).toBeGreaterThan(0);
  });

  it("同じなら0", () => {
    expect(compare(specificity("h2"), specificity("a"))).toBe(0);
  });
});

describe("splitSelectorList", () => {
  it("トップレベルのカンマで割る", () => {
    expect(splitSelectorList(".a, .b")).toEqual([".a", ".b"]);
  });

  it("括弧の中のカンマでは割らない", () => {
    expect(splitSelectorList(":where(.a, .b), .c")).toEqual([":where(.a, .b)", ".c"]);
  });

  it("空は落とす", () => {
    expect(splitSelectorList(".a, , .b")).toEqual([".a", ".b"]);
  });
});
