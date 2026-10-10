// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { matchesHash, normalizeHashPath, clearHash, subscribeToHash } from "./hashRoute";

const at = (hash: string) => window.history.replaceState({}, "", `/some/page${hash}`);

beforeEach(() => at(""));

describe("normalizeHashPath", () => {
  // 利用側が #/studio と /studio のどちらで書いても通したい
  it.each(["#/studio", "/studio", "studio"])("先頭の # と / を揃える（%s）", (given) => {
    expect(normalizeHashPath(given)).toBe("#/studio");
  });

  it("入れ子のパスも揃える", () => {
    expect(normalizeHashPath("studio/github")).toBe("#/studio/github");
  });
});

describe("matchesHash", () => {
  it("一致すれば true", () => {
    at("#/studio");

    expect(matchesHash("#/studio")).toBe(true);
  });

  it("違えば false", () => {
    at("#/other");

    expect(matchesHash("#/studio")).toBe(false);
  });

  it("ハッシュが無ければ false", () => {
    at("");

    expect(matchesHash("#/studio")).toBe(false);
  });

  // 読者が普通に見ているだけでは開かない
  it("前方一致では開かない", () => {
    at("#/studios");

    expect(matchesHash("#/studio")).toBe(false);
  });

  it("書き方が違っても同じ判定になる", () => {
    at("#/studio");

    expect(matchesHash("studio")).toBe(true);
  });

  // 利用側のルーターが付けうるクエリを無視する
  it("末尾のスラッシュは同じ扱いにする", () => {
    at("#/studio/");

    expect(matchesHash("#/studio")).toBe(true);
  });
});

describe("clearHash", () => {
  it("ハッシュを消す", () => {
    at("#/studio");
    clearHash();

    expect(window.location.hash).toBe("");
  });

  // パスを消すと利用側のルーティングが飛ぶ
  it("パスは変えない", () => {
    at("#/studio");
    clearHash();

    expect(window.location.pathname).toBe("/some/page");
  });

  // 戻るボタンで #/studio に戻れてしまうと閉じた意味がない
  it("履歴を増やさない", () => {
    at("#/studio");
    const before = window.history.length;
    clearHash();

    expect(window.history.length).toBe(before);
  });
});

describe("subscribeToHash", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hashchange で呼ばれる", () => {
    const seen = vi.fn();
    const stop = subscribeToHash(seen);

    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(seen).toHaveBeenCalledOnce();
    stop();
  });

  it("解除すると呼ばれない", () => {
    const seen = vi.fn();
    const stop = subscribeToHash(seen);
    stop();

    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(seen).not.toHaveBeenCalled();
  });
});
