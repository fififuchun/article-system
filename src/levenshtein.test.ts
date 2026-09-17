import { describe, it, expect } from "vitest";
import { levenshtein } from "./levenshtein";

describe("levenshtein", () => {
  it("同じ文字列なら 0 を返す", () => {
    expect(levenshtein("title", "title")).toBe(0);
  });

  it("空文字列同士なら 0 を返す", () => {
    expect(levenshtein("", "")).toBe(0);
  });

  it("片方が空なら相手の長さを返す", () => {
    expect(levenshtein("", "title")).toBe(5);
    expect(levenshtein("title", "")).toBe(5);
  });

  it("1文字の置換を 1 と数える", () => {
    expect(levenshtein("title", "titlo")).toBe(1);
  });

  it("1文字の挿入を 1 と数える", () => {
    expect(levenshtein("title", "titles")).toBe(1);
  });

  it("1文字の削除を 1 と数える", () => {
    expect(levenshtein("thumbnail", "thumbnai")).toBe(1);
  });

  it("引数の順序を入れ替えても同じ距離になる", () => {
    expect(levenshtein("lastUpdate", "latestUpdate")).toBe(
      levenshtein("latestUpdate", "lastUpdate")
    );
  });

  it("lastUpdate と latestUpdate の距離は 2", () => {
    expect(levenshtein("lastUpdate", "latestUpdate")).toBe(2);
  });

  it("隣接文字の入れ替えは 2 と数える（Damerau ではない）", () => {
    expect(levenshtein("titel", "title")).toBe(2);
  });

  it("大文字小文字の違いを 1 と数える", () => {
    expect(levenshtein("Title", "title")).toBe(1);
  });

  it("まったく異なる文字列は長いほうの長さ以下になる", () => {
    expect(levenshtein("staff", "thumbnail")).toBeLessThanOrEqual(9);
  });
});
