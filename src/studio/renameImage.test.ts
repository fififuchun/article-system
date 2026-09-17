import { describe, it, expect } from "vitest";
import { renameImageInMarkdown } from "./renameImage";

describe("renameImageInMarkdown — フロントマター", () => {
  const md = (thumbnail: string, body = "本文") =>
    ["---", "title: 記事", `thumbnail: ${thumbnail}`, "---", "", body].join("\n");

  // 順序次第で thumbnail だけ取り残され、本番ダウンロードが止まる
  it("thumbnail の値も置き換える", () => {
    expect(renameImageInMarkdown(md("a.jpg"), "a.jpg", "b.jpg")).toBe(md("b.jpg"));
  });

  it("本文と thumbnail を同時に置き換える", () => {
    const before = md("a.jpg", "![](a.jpg)");
    const after = md("b.jpg", "![](b.jpg)");

    expect(renameImageInMarkdown(before, "a.jpg", "b.jpg")).toBe(after);
  });

  it("別のキーの値は置き換えない", () => {
    const before = ["---", "title: a.jpg", "thumbnail: b.jpg", "---", "", "本文"].join("\n");

    expect(renameImageInMarkdown(before, "a.jpg", "x.jpg")).toBe(before);
  });

  it("thumbnail の前後の空白があっても置き換える", () => {
    const before = ["---", "thumbnail:  a.jpg ", "---", "", "本文"].join("\n");
    const after = ["---", "thumbnail: b.jpg", "---", "", "本文"].join("\n");

    expect(renameImageInMarkdown(before, "a.jpg", "b.jpg")).toBe(after);
  });

  it("該当しない thumbnail はそのまま", () => {
    expect(renameImageInMarkdown(md("a.jpg"), "x.jpg", "y.jpg")).toBe(md("a.jpg"));
  });
});

describe("renameImageInMarkdown", () => {
  it("画像記法のファイル名を置き換える", () => {
    expect(renameImageInMarkdown("![](IMG_1234.jpg)", "IMG_1234.jpg", "夏の風景.jpg")).toBe(
      "![](夏の風景.jpg)"
    );
  });

  it("alt が付いていても置き換える", () => {
    expect(renameImageInMarkdown("![説明](IMG_1234.jpg)", "IMG_1234.jpg", "a.jpg")).toBe(
      "![説明](a.jpg)"
    );
  });

  it("同じ画像が複数あればすべて置き換える", () => {
    const markdown = "![](a.jpg)\n\n本文\n\n![](a.jpg)";

    expect(renameImageInMarkdown(markdown, "a.jpg", "b.jpg")).toBe(
      "![](b.jpg)\n\n本文\n\n![](b.jpg)"
    );
  });

  // 素朴な全文置換だと本文が壊れる
  it("本文に同じ文字列があっても画像記法だけ置き換える", () => {
    const markdown = "a.jpg について書きます\n\n![](a.jpg)";

    expect(renameImageInMarkdown(markdown, "a.jpg", "b.jpg")).toBe(
      "a.jpg について書きます\n\n![](b.jpg)"
    );
  });

  it("リンク記法は置き換えない", () => {
    const markdown = "[a.jpg](a.jpg)";

    expect(renameImageInMarkdown(markdown, "a.jpg", "b.jpg")).toBe("[a.jpg](b.jpg)");
  });

  it("該当が無ければそのまま返す", () => {
    expect(renameImageInMarkdown("![](a.jpg)", "x.jpg", "y.jpg")).toBe("![](a.jpg)");
  });

  it("名前が空でも落ちない", () => {
    expect(renameImageInMarkdown("![](a.jpg)", "a.jpg", "")).toBe("![]()");
  });
});
