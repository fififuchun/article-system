import { describe, it, expect, afterEach, vi } from "vitest";
import { githubRequest, GitHubApiError, GITHUB_API_BASE } from "./api";

const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

const call = () => githubRequest("github_pat_secret", "/repos/me/blog/git/refs/heads/main");

describe("githubRequest — 送るもの", () => {
  it("API ベースに path を繋げる", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await call();

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${GITHUB_API_BASE}/repos/me/blog/git/refs/heads/main`
    );
  });

  it("トークンを Authorization ヘッダーに載せる", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer github_pat_secret");
  });

  it("API バージョンを明示する", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-GitHub-Api-Version")).toBe("2022-11-28");
  });

  it("既定は GET で本文を送らない", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("body を渡すと JSON にして送る", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await githubRequest("github_pat_secret", "/repos/me/blog/git/blobs", {
      method: "POST",
      body: { content: "abc", encoding: "utf-8" },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ content: "abc", encoding: "utf-8" });
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("トークンをURLに載せない", async () => {
    const fetchMock = respond({});
    vi.stubGlobal("fetch", fetchMock);

    await call();

    expect(fetchMock.mock.calls[0][0]).not.toContain("github_pat_secret");
  });
});

describe("githubRequest — 返すもの", () => {
  it("JSON をそのまま返す", async () => {
    vi.stubGlobal("fetch", respond({ object: { sha: "abc123" } }));

    await expect(call()).resolves.toEqual({ object: { sha: "abc123" } });
  });

  it("本文が無い応答でも落ちない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await expect(call()).resolves.toBeNull();
  });
});

describe("githubRequest — エラーの種類", () => {
  const failWith = async (status: number, body: unknown = {}) => {
    vi.stubGlobal("fetch", respond(body, status));
    return (await call().catch((e: unknown) => e)) as GitHubApiError;
  };

  // spec §15: 401 のときはトークンを破棄して貼り直しを促す
  it("401 は unauthorized", async () => {
    const error = await failWith(401, { message: "Bad credentials" });

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.kind).toBe("unauthorized");
    expect(error.status).toBe(401);
  });

  // 他人が先に push して ref が進んだ場合（spec §15）
  it("409 は conflict", async () => {
    expect((await failWith(409)).kind).toBe("conflict");
  });

  // ref の早送りができないときは 422 で返る
  it("422 も conflict", async () => {
    expect((await failWith(422, { message: "Update is not a fast forward" })).kind).toBe(
      "conflict"
    );
  });

  it("その他の状態コードは other", async () => {
    expect((await failWith(500)).kind).toBe("other");
    expect((await failWith(404)).kind).toBe("other");
  });

  it("通信そのものの失敗は network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    const error = (await call().catch((e: unknown) => e)) as GitHubApiError;

    expect(error.kind).toBe("network");
    expect(error.status).toBe(0);
  });
});

describe("githubRequest — エラーの文言", () => {
  it("GitHub の message をそのまま使う", async () => {
    vi.stubGlobal("fetch", respond({ message: "Update is not a fast forward" }, 422));

    await expect(call()).rejects.toThrow("Update is not a fast forward");
  });

  it("message が無ければ状態コードを出す", async () => {
    vi.stubGlobal("fetch", respond({}, 500));

    await expect(call()).rejects.toThrow(/500/);
  });

  it("トークンを文言に含めない", async () => {
    vi.stubGlobal("fetch", respond({ message: "Bad credentials" }, 401));

    const error = (await call().catch((e: unknown) => e)) as Error;

    expect(error.message).not.toContain("github_pat_secret");
  });
});
