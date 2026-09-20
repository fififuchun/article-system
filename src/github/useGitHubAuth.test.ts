// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGitHubAuth } from "./useGitHubAuth";
import { redirectTo } from "./navigate";
import { saveToken, loadToken, savePendingAuth, loadPendingAuth } from "./tokenStorage";

vi.mock("./navigate", () => ({ redirectTo: vi.fn() }));

const config = {
  clientId: "Iv1.abc",
  repo: "me/blog",
  branch: "main",
  mdDir: "src/articles",
  imageDir: "public/article_imgs",
  redirectUri: "https://example.com/studio",
};

const at = (search: string) =>
  window.history.replaceState({}, "", `/studio${search}`);

const tokenBody = {
  access_token: "ghu_secret",
  expires_in: 28800,
  refresh_token: "ghr_secret",
};

const respondWith = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => {
  sessionStorage.clear();
  at("");
  vi.mocked(redirectTo).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const mount = () => renderHook(() => useGitHubAuth(config, "blog"));

describe("useGitHubAuth — 初期状態", () => {
  it("トークンが無ければ anonymous", () => {
    const { result } = mount();

    expect(result.current.status).toBe("anonymous");
    expect(result.current.token).toBeNull();
  });

  it("保存済みトークンがあれば authenticated", () => {
    saveToken("blog", { accessToken: "ghu_secret", expiresAt: Date.now() + 60_000 });

    const { result } = mount();

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).toBe("ghu_secret");
  });

  it("期限切れのトークンは使わない", () => {
    saveToken("blog", { accessToken: "ghu_secret", expiresAt: Date.now() - 1 });

    const { result } = mount();

    expect(result.current.status).toBe("anonymous");
  });

  it("?code= が無ければ通信しない", () => {
    const fetchMock = respondWith(tokenBody);
    vi.stubGlobal("fetch", fetchMock);

    mount();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useGitHubAuth — login", () => {
  it("認可画面へ遷移する", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.login();
    });

    expect(vi.mocked(redirectTo)).toHaveBeenCalledOnce();
    expect(vi.mocked(redirectTo).mock.calls[0][0]).toContain(
      "https://github.com/login/oauth/authorize"
    );
  });

  it("遷移する前に state と code_verifier を預ける", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.login();
    });

    const pending = loadPendingAuth("blog");
    expect(pending?.state).toBeTruthy();
    expect(pending?.codeVerifier).toBeTruthy();
  });

  it("預けた state と同じものを認可URLに載せる", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.login();
    });

    const url = new URL(vi.mocked(redirectTo).mock.calls[0][0]);
    expect(url.searchParams.get("state")).toBe(loadPendingAuth("blog")?.state);
  });

  // code_verifier そのものを送ると PKCE の意味が無くなる
  it("認可URLに code_verifier を載せない", async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.login();
    });

    const verifier = loadPendingAuth("blog")!.codeVerifier;
    expect(vi.mocked(redirectTo).mock.calls[0][0]).not.toContain(verifier);
  });
});

describe("useGitHubAuth — 戻ってきたとき", () => {
  beforeEach(() => {
    savePendingAuth("blog", { state: "st4te", codeVerifier: "the-verifier" });
    at("?code=the-code&state=st4te");
  });

  it("code を交換してトークンを保存する", async () => {
    vi.stubGlobal("fetch", respondWith(tokenBody));

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.token).toBe("ghu_secret");
    expect(loadToken("blog")?.accessToken).toBe("ghu_secret");
  });

  // 残したままだと、リロードで交換済みの code を再送して失敗する
  it("交換したら ?code= を履歴から消す", async () => {
    vi.stubGlobal("fetch", respondWith(tokenBody));

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(window.location.search).toBe("");
  });

  it("預けた値は使い捨てにする", async () => {
    vi.stubGlobal("fetch", respondWith(tokenBody));

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(loadPendingAuth("blog")).toBeNull();
  });

  it("交換が終わるまでは loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    const { result } = mount();

    expect(result.current.status).toBe("loading");
  });
});

describe("useGitHubAuth — 戻ってきたが通せないとき", () => {
  it("state が合わなければ error にし、トークンを保存しない", async () => {
    savePendingAuth("blog", { state: "st4te", codeVerifier: "the-verifier" });
    at("?code=the-code&state=forged");
    const fetchMock = respondWith(tokenBody);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadToken("blog")).toBeNull();
  });

  // ログイン操作をしていないのに ?code= だけ付けてURLを開かれた場合
  it("預けた値が無ければ error にする", async () => {
    at("?code=the-code&state=st4te");
    const fetchMock = respondWith(tokenBody);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GitHub が error を返したら理由を持つ", async () => {
    savePendingAuth("blog", { state: "st4te", codeVerifier: "the-verifier" });
    at("?code=the-code&state=st4te");
    vi.stubGlobal(
      "fetch",
      respondWith({ error: "bad_verification_code", error_description: "コードが無効です" })
    );

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("コードが無効です");
  });

  it("失敗しても ?code= は履歴から消す", async () => {
    at("?code=the-code&state=st4te");
    vi.stubGlobal("fetch", respondWith(tokenBody));

    const { result } = mount();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(window.location.search).toBe("");
  });
});

describe("useGitHubAuth — logout", () => {
  it("トークンを消して anonymous に戻す", () => {
    saveToken("blog", { accessToken: "ghu_secret", expiresAt: Date.now() + 60_000 });

    const { result } = mount();
    act(() => result.current.logout());

    expect(result.current.status).toBe("anonymous");
    expect(result.current.token).toBeNull();
    expect(loadToken("blog")).toBeNull();
  });
});
