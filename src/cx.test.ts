import { describe, it, expect } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("複数のクラスを空白で連結する", () => {
    expect(cx("as-heading", "my-heading")).toBe("as-heading my-heading");
  });

  it("クラスが1つならそのまま返す", () => {
    expect(cx("as-heading")).toBe("as-heading");
  });

  it("undefined を取り除く", () => {
    expect(cx("as-heading", undefined)).toBe("as-heading");
  });

  it("空文字を取り除く", () => {
    expect(cx("as-heading", "")).toBe("as-heading");
  });

  it("false と null を取り除く", () => {
    expect(cx("as-heading", false, null)).toBe("as-heading");
  });

  it("先頭が falsy でも余分な空白を残さない", () => {
    expect(cx(undefined, "my-heading")).toBe("my-heading");
  });

  it("間に falsy が挟まっても空白は1つだけになる", () => {
    expect(cx("a", undefined, "b")).toBe("a b");
  });

  it("引数が無ければ空文字を返す", () => {
    expect(cx()).toBe("");
  });

  it("すべて falsy なら空文字を返す", () => {
    expect(cx(undefined, false, null, "")).toBe("");
  });
});
