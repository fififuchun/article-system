// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveToken, loadToken, clearToken, tokenKey } from "./tokenStorage";

const token = {
  accessToken: "ghu_secret",
  expiresAt: Date.now() + 60_000,
  refreshToken: "ghr_secret",
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("tokenKey", () => {
  it("storageKey で保存先を分ける", () => {
    expect(tokenKey("blog")).not.toBe(tokenKey("shop"));
  });

  it("storageKey を省略しても決まったキーになる", () => {
    expect(tokenKey()).toBe(tokenKey(undefined));
  });
});

describe("saveToken / loadToken", () => {
  it("保存したトークンを読み出せる", () => {
    saveToken("blog", token);

    expect(loadToken("blog")).toEqual(token);
  });

  it("保存が無ければ null", () => {
    expect(loadToken("blog")).toBeNull();
  });

  it("別の storageKey のトークンは見えない", () => {
    saveToken("blog", token);

    expect(loadToken("shop")).toBeNull();
  });

  // spec §15: sessionStorage に置く。タブを閉じたら消えること
  it("localStorage には書かない", () => {
    saveToken("blog", token);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });

  // 期限切れを返すと、使えないトークンでコミットを試して 401 になる
  it("期限が切れていれば null を返す", () => {
    saveToken("blog", { ...token, expiresAt: Date.now() - 1 });

    expect(loadToken("blog")).toBeNull();
  });

  it("期限切れを読んだら保存も消す", () => {
    saveToken("blog", { ...token, expiresAt: Date.now() - 1 });
    loadToken("blog");

    expect(sessionStorage.length).toBe(0);
  });

  // 手で書き換えられた場合。落ちるとログイン画面すら出せなくなる
  it("壊れた値が入っていても null を返す", () => {
    sessionStorage.setItem(tokenKey("blog"), "{ not json");

    expect(loadToken("blog")).toBeNull();
  });

  it("sessionStorage が使えなくても落ちない", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveToken("blog", token)).not.toThrow();
  });
});

describe("clearToken", () => {
  it("保存を消す", () => {
    saveToken("blog", token);
    clearToken("blog");

    expect(loadToken("blog")).toBeNull();
  });

  it("保存が無くても落ちない", () => {
    expect(() => clearToken("blog")).not.toThrow();
  });
});

// spec §15: トークンは画面に出さない
describe("トークンを漏らさない", () => {
  it("保存・読み出し・破棄のどれもログに出さない", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    saveToken("blog", token);
    loadToken("blog");
    clearToken("blog");

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("キー名にトークンを含めない", () => {
    saveToken("blog", token);

    expect(sessionStorage.key(0)).not.toContain("ghu_");
  });
});
