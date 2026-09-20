import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exchangeCodeForToken, GITHUB_TOKEN_URL } from "./exchangeCode";

const params = {
  clientId: "Iv1.abc",
  code: "the-code",
  redirectUri: "https://example.com/studio",
  codeVerifier: "the-verifier",
  state: "st4te",
  expectedState: "st4te",
};

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-09-21T00:00:00Z")));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const success = {
  access_token: "ghu_secret",
  expires_in: 28800,
  refresh_token: "ghr_secret",
  refresh_token_expires_in: 15811200,
  token_type: "bearer",
};

describe("exchangeCodeForToken — 送るもの", () => {
  it("GitHub のトークンエンドポイントに POST する", async () => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCodeForToken(params);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GITHUB_TOKEN_URL);
    expect(init.method).toBe("POST");
  });

  // 既定では HTML が返る
  it("JSON で返すよう頼む", async () => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCodeForToken(params);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
  });

  it.each([
    ["client_id", "Iv1.abc"],
    ["code", "the-code"],
    ["redirect_uri", "https://example.com/studio"],
    ["code_verifier", "the-verifier"],
  ])("本文に %s を入れる", async (key, expected) => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCodeForToken(params);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)[key]).toBe(expected);
  });

  // spec §15: client secret はアプリに持たせない
  it("client_secret を送らない", async () => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCodeForToken(params);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).not.toContain("client_secret");
  });
});

describe("exchangeCodeForToken — 受け取るもの", () => {
  it("トークンを返す", async () => {
    vi.stubGlobal("fetch", ok(success));

    const token = await exchangeCodeForToken(params);

    expect(token.accessToken).toBe("ghu_secret");
    expect(token.refreshToken).toBe("ghr_secret");
  });

  it("expires_in を失効時刻に直す", async () => {
    vi.stubGlobal("fetch", ok(success));

    const token = await exchangeCodeForToken(params);

    expect(token.expiresAt).toBe(Date.parse("2026-09-21T00:00:00Z") + 28800 * 1000);
  });

  it("refresh_token が無くても返せる", async () => {
    vi.stubGlobal("fetch", ok({ access_token: "ghu_secret", expires_in: 28800 }));

    const token = await exchangeCodeForToken(params);

    expect(token.refreshToken).toBeUndefined();
  });
});

describe("exchangeCodeForToken — 断る場合", () => {
  // CSRF。他サイトが仕込んだ code を掴まされる
  it("state が一致しなければ交換しない", async () => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeCodeForToken({ ...params, state: "forged" })
    ).rejects.toThrow(/state/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("state が空でも通さない", async () => {
    const fetchMock = ok(success);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeCodeForToken({ ...params, state: "", expectedState: "" })
    ).rejects.toThrow(/state/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // GitHub はエラーでも 200 を返す
  it("本文に error があれば例外にする", async () => {
    vi.stubGlobal(
      "fetch",
      ok({ error: "bad_verification_code", error_description: "コードが無効です" })
    );

    await expect(exchangeCodeForToken(params)).rejects.toThrow("コードが無効です");
  });

  it("HTTP エラーなら例外にする", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));

    await expect(exchangeCodeForToken(params)).rejects.toThrow(/500/);
  });

  it("access_token が無ければ例外にする", async () => {
    vi.stubGlobal("fetch", ok({ expires_in: 28800 }));

    await expect(exchangeCodeForToken(params)).rejects.toThrow();
  });

  // 期限無効化の App は SPA から使えない（spec §15）
  it("expires_in が無ければ例外にする", async () => {
    vi.stubGlobal("fetch", ok({ access_token: "ghu_secret" }));

    await expect(exchangeCodeForToken(params)).rejects.toThrow(/期限/);
  });

  it("例外の文言にトークンを含めない", async () => {
    vi.stubGlobal("fetch", ok({ access_token: "ghu_secret" }));

    const error = await exchangeCodeForToken(params).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("ghu_secret");
  });
});
