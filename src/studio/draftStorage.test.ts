// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { beforeEach, vi } from "vitest";
import { draftKey, loadDraft, saveDraft } from "./draftStorage";

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

describe("loadDraft", () => {
  beforeEach(() => localStorage.clear());

  it("保存された下書きを返す", () => {
    saveDraft("my-blog", "書きかけの本文");

    expect(loadDraft("my-blog")).toBe("書きかけの本文");
  });

  it("保存が無ければ null を返す", () => {
    expect(loadDraft("my-blog")).toBeNull();
  });

  // spec §9: 意図的に空にしたものを勝手に戻さないため、空文字と未保存を区別する
  it("空文字で保存されていれば空文字を返す（null にしない）", () => {
    saveDraft("my-blog", "");

    expect(loadDraft("my-blog")).toBe("");
  });

  it("storageKey ごとに別の下書きを読む", () => {
    saveDraft("my-blog", "A");
    saveDraft("another-site", "B");

    expect(loadDraft("my-blog")).toBe("A");
    expect(loadDraft("another-site")).toBe("B");
  });

  it("localStorage が使えなければ null を返す", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(loadDraft("my-blog")).toBeNull();

    getItem.mockRestore();
  });
});
