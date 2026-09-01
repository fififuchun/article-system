import { describe, it, expect } from "vitest";
import { collectImageNames } from "./collectImageNames";

describe("collectImageNames", () => {
  it("本文の画像記法からファイル名を集める", () => {
    expect(collectImageNames("![](art_0.webp)", "")).toEqual(["art_0.webp"]);
  });

  it("alt が付いていても集める", () => {
    expect(collectImageNames("![説明](art_0.webp)", "")).toEqual(["art_0.webp"]);
  });

  it("複数の画像を集める", () => {
    expect(collectImageNames("![](a.webp)\n\n![](b.webp)", "")).toEqual([
      "a.webp",
      "b.webp",
    ]);
  });

  it("サムネイルも対象にする", () => {
    expect(collectImageNames("本文", "thumb.webp")).toEqual(["thumb.webp"]);
  });

  it("同じ名前は1つにまとめる", () => {
    expect(collectImageNames("![](a.webp)\n\n![](a.webp)", "a.webp")).toEqual(["a.webp"]);
  });

  // spec §6: ドロップした画像はサーバーに無いのが当然なので検証対象外
  it.each(["blob:http://localhost/abc", "data:image/png;base64,xxx"])(
    "ブラウザ内の一時URL %s は集めない",
    (src) => {
      expect(collectImageNames(`![](${src})`, "")).toEqual([]);
    }
  );

  it("外部URLは集めない", () => {
    expect(collectImageNames("![](https://example.com/a.webp)", "")).toEqual([]);
  });

  it("リンク記法は集めない", () => {
    expect(collectImageNames("[a.webp](a.webp)", "")).toEqual([]);
  });

  it("空の名前は集めない", () => {
    expect(collectImageNames("![]()", "")).toEqual([]);
  });

  it("画像が無ければ空配列", () => {
    expect(collectImageNames("本文だけ", "")).toEqual([]);
  });
});
