import { describe, it, expect } from "vitest";
import { buildDescription } from "./buildDescription";

describe("buildDescription", () => {
  it("本文をそのまま返す", () => {
    expect(buildDescription("夏にやったことのまとめです。")).toBe(
      "夏にやったことのまとめです。"
    );
  });

  it("改行を空白1つに畳む", () => {
    expect(buildDescription("1行目\n\n2行目")).toBe("1行目 2行目");
  });

  it("前後の空白を落とす", () => {
    expect(buildDescription("\n\n  本文  \n\n")).toBe("本文");
  });

  it("本文が無ければ空文字", () => {
    expect(buildDescription("")).toBe("");
  });
});

describe("buildDescription — マークダウンの記号を落とす", () => {
  it("見出しの記号を落として文字は残す", () => {
    expect(buildDescription("## 見出し\n\n本文")).toBe("見出し 本文");
  });

  it("画像は alt ごと落とす", () => {
    expect(buildDescription("![海の写真](2026/10-12/0_1.png)\n\n本文")).toBe("本文");
  });

  it("リンクは文字だけ残す", () => {
    expect(buildDescription("[公式サイト](https://example.com)を見る")).toBe(
      "公式サイトを見る"
    );
  });

  // 画像のほうを先に処理しないと ![alt] の ! だけが残る
  it("画像とリンクが混ざっても残骸を出さない", () => {
    expect(buildDescription("![](a.png) [名前](https://example.com)")).toBe("名前");
  });

  it("コードブロックは中身ごと落とす", () => {
    expect(buildDescription("本文\n\n```ts\nconst a = 1;\n```\n\n続き")).toBe(
      "本文 続き"
    );
  });

  it("強調の記号を落とす", () => {
    expect(buildDescription("**太字**と*斜体*")).toBe("太字と斜体");
  });

  it("インラインコードの記号を落とす", () => {
    expect(buildDescription("`npm install` を実行")).toBe("npm install を実行");
  });

  it("箇条書きの記号を落とす", () => {
    expect(buildDescription("- 1つめ\n- 2つめ")).toBe("1つめ 2つめ");
  });

  it("番号付きの記号を落とす", () => {
    expect(buildDescription("1. 1つめ\n2. 2つめ")).toBe("1つめ 2つめ");
  });

  it("引用の記号を落とす", () => {
    expect(buildDescription("> 引用文")).toBe("引用文");
  });

  it("水平線を落とす", () => {
    expect(buildDescription("本文\n\n---\n\n続き")).toBe("本文 続き");
  });

  it("表の罫線を落とす", () => {
    expect(buildDescription("| 項目 | 値 |\n| --- | --- |\n| a | 1 |")).toBe(
      "項目 値 a 1"
    );
  });

  // ファイル名や識別子を壊さないため、アンダースコアは残す
  it("アンダースコアは落とさない", () => {
    expect(buildDescription("0_1.png を使う")).toBe("0_1.png を使う");
  });
});

describe("buildDescription — 切り詰め", () => {
  const long = "あ".repeat(200);

  it("上限までで切る", () => {
    expect(buildDescription(long, 10)).toBe(`${"あ".repeat(10)}…`);
  });

  it("上限以内なら印を付けない", () => {
    expect(buildDescription("あいう", 10)).toBe("あいう");
  });

  it("ちょうど上限なら印を付けない", () => {
    expect(buildDescription("あいう", 3)).toBe("あいう");
  });

  it("切った末尾の空白を残さない", () => {
    expect(buildDescription("あいう えおか", 4)).toBe("あいう…");
  });

  it("既定の上限がある", () => {
    expect(buildDescription(long).length).toBeLessThan(long.length);
  });
});
