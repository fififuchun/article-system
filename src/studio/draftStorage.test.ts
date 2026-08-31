import { describe, it, expect } from "vitest";
import { draftKey } from "./draftStorage";

describe("draftKey", () => {
  it("storageKey を接尾に付ける", () => {
    expect(draftKey("my-blog")).toBe("as-studio-draft:my-blog");
  });

  it("プロジェクトごとに別のキーになる", () => {
    expect(draftKey("my-blog")).not.toBe(draftKey("another-site"));
  });

  // spec §9: 未指定でも既定値で動く
  it("未指定なら default を使う", () => {
    expect(draftKey()).toBe("as-studio-draft:default");
  });
});
