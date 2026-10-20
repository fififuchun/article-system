// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  WARNING,
  collectLayerNames,
  needsLayerStylesheet,
  usesCascadeLayers,
} from "./stylesheetWarning";

describe("usesCascadeLayers", () => {
  // Tailwind v4 が宣言する並び
  it("base と utilities があれば層が使われている", () => {
    expect(usesCascadeLayers(["theme", "base", "components", "utilities"])).toBe(true);
  });

  it("順番は問わない", () => {
    expect(usesCascadeLayers(["utilities", "base"])).toBe(true);
  });

  // v3 は本物の層を一切出さない
  it("層が無ければ false", () => {
    expect(usesCascadeLayers([])).toBe(false);
  });

  // 誤検出するより気づけないほうを選ぶ（spec §10）
  it("utilities が無ければ false", () => {
    expect(usesCascadeLayers(["base", "components"])).toBe(false);
  });

  it("base が無ければ false", () => {
    expect(usesCascadeLayers(["utilities"])).toBe(false);
  });
});

describe("needsLayerStylesheet", () => {
  it.each([
    [true, "plain", true],
    [true, "layer", false],
    [true, "unknown", false],
    [false, "plain", false],
    [false, "layer", false],
  ] as const)("層=%s 版=%s なら %s", (layered, kind, want) => {
    expect(needsLayerStylesheet(layered, kind)).toBe(want);
  });

  // CSS 自体が未読込のときに層の話で混乱させない
  it("版が分からなければ黙る", () => {
    expect(needsLayerStylesheet(true, "unknown")).toBe(false);
  });
});

describe("collectLayerNames", () => {
  /** CSSRuleList は配列ではなく length を持つインデックス付きオブジェクト */
  const sheet = (rules: unknown[]) =>
    ({
      cssRules: Object.assign({}, rules, { length: rules.length }),
    } as unknown as CSSStyleSheet);

  it("宣言（@layer a, b;）から名前を集める", () => {
    const sheets = [sheet([{ nameList: ["theme", "base"] }])];

    expect(collectLayerNames(sheets)).toEqual(["theme", "base"]);
  });

  it("ブロック（@layer a { }）から名前を集める", () => {
    const sheets = [sheet([{ name: "utilities" }])];

    expect(collectLayerNames(sheets)).toEqual(["utilities"]);
  });

  it("両方が混ざっていても集める", () => {
    const sheets = [sheet([{ nameList: ["theme"] }, { name: "base" }])];

    expect(collectLayerNames(sheets)).toEqual(["theme", "base"]);
  });

  it("層でないルールは無視する", () => {
    const sheets = [sheet([{ selectorText: ".a" }, { name: "" }])];

    expect(collectLayerNames(sheets)).toEqual([]);
  });

  it("複数のスタイルシートをまとめる", () => {
    const sheets = [sheet([{ name: "base" }]), sheet([{ name: "utilities" }])];

    expect(collectLayerNames(sheets)).toEqual(["base", "utilities"]);
  });

  // 別オリジンの CSS は cssRules で例外になる
  it("読めないスタイルシートは飛ばす", () => {
    const blocked = {
      get cssRules(): CSSRuleList {
        throw new Error("SecurityError");
      },
    } as unknown as CSSStyleSheet;
    const sheets = [blocked, sheet([{ name: "base" }])];

    expect(collectLayerNames(sheets)).toEqual(["base"]);
  });

  it("空でも落ちない", () => {
    expect(collectLayerNames([])).toEqual([]);
  });
});

describe("WARNING", () => {
  it("読み替え先のファイル名を書く", () => {
    expect(WARNING).toContain("styles.layer.css");
  });

  it("両方読み込まないよう書く", () => {
    expect(WARNING).toContain("両方");
  });
});

// 実際に警告が出るところまで通す。checked はモジュール単位なので読み直す
describe("warnStylesheetMismatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const run = async (layers: string[], marker: string) => {
    vi.resetModules();
    Object.defineProperty(document, "styleSheets", {
      configurable: true,
      value: { length: 1, 0: { cssRules: { length: 1, 0: { nameList: layers } } } },
    });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => marker,
    } as unknown as CSSStyleDeclaration);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { warnStylesheetMismatch } = await import("./stylesheetWarning");
    warnStylesheetMismatch();

    return warn;
  };

  it("v4 で層なし版なら警告する", async () => {
    const warn = await run(["theme", "base", "components", "utilities"], "plain");

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain("styles.layer.css");
  });

  it("v4 で層あり版なら警告しない", async () => {
    const warn = await run(["theme", "base", "components", "utilities"], "layer");

    expect(warn).not.toHaveBeenCalled();
  });

  it("層が使われていなければ警告しない（v3 / Tailwind なし）", async () => {
    const warn = await run([], "plain");

    expect(warn).not.toHaveBeenCalled();
  });

  it("二度呼んでも1回しか警告しない", async () => {
    const warn = await run(["base", "utilities"], "plain");
    const { warnStylesheetMismatch } = await import("./stylesheetWarning");
    warnStylesheetMismatch();

    expect(warn).toHaveBeenCalledOnce();
  });
});
