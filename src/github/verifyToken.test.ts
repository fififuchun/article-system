import { describe, it, expect, afterEach, vi } from "vitest";
import { verifyToken } from "./verifyToken";
import { GITHUB_API_BASE } from "./api";

const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const writable = { permissions: { push: true, pull: true } };

afterEach(() => vi.unstubAllGlobals());

describe("verifyToken — 送るもの", () => {
  it("まず対象リポジトリを読む", async () => {
    const fetchMock = respond(writable);
    vi.stubGlobal("fetch", fetchMock);

    await verifyToken("github_pat_secret", "me/blog");

    expect(fetchMock.mock.calls[0][0]).toBe(`${GITHUB_API_BASE}/repos/me/blog`);
  });

  it("トークンを Authorization ヘッダーに載せる", async () => {
    const fetchMock = respond(writable);
    vi.stubGlobal("fetch", fetchMock);

    await verifyToken("github_pat_secret", "me/blog");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer github_pat_secret");
  });

  // 指定しないと将来の仕様変更で壊れる
  it("API バージョンを明示する", async () => {
    const fetchMock = respond(writable);
    vi.stubGlobal("fetch", fetchMock);

    await verifyToken("github_pat_secret", "me/blog");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-GitHub-Api-Version")).toBe("2022-11-28");
  });

  // トークンをURLに置くと履歴やログに残る
  it("トークンをURLに載せない", async () => {
    const fetchMock = respond(writable);
    vi.stubGlobal("fetch", fetchMock);

    await verifyToken("github_pat_secret", "me/blog");

    expect(fetchMock.mock.calls[0][0]).not.toContain("github_pat_secret");
  });
});

describe("verifyToken — 通す場合", () => {
  it("push 権限があれば解決する", async () => {
    vi.stubGlobal("fetch", respond(writable));

    await expect(verifyToken("github_pat_secret", "me/blog")).resolves.toBeUndefined();
  });
});

describe("verifyToken — 断る場合", () => {
  // 書き終えてから「権限がありません」では遅い（spec §15）
  it("アカウントに書き込み権限が無ければ断る", async () => {
    vi.stubGlobal("fetch", respond({ permissions: { push: false, pull: true } }));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(
      /書き込み権限がありません/
    );
  });

  it("permissions が返らなくても断る", async () => {
    vi.stubGlobal("fetch", respond({}));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(
      /書き込み権限がありません/
    );
  });

  it("401 ならトークンが無効だと伝える", async () => {
    vi.stubGlobal("fetch", respond({ message: "Bad credentials" }, 401));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(/無効/);
  });

  // GitHub は権限が無いリポジトリにも 404 を返す（存在を漏らさないため）
  it("404 ならリポジトリ名とトークンの対象範囲を疑わせる", async () => {
    vi.stubGlobal("fetch", respond({ message: "Not Found" }, 404));

    const error = await verifyToken("github_pat_secret", "me/blog").catch((e: Error) => e);

    expect((error as Error).message).toContain("me/blog");
    expect((error as Error).message).toMatch(/見つかりません/);
  });

  it("403 なら理由を添えて断る", async () => {
    vi.stubGlobal("fetch", respond({ message: "API rate limit exceeded" }, 403));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(
      /API rate limit exceeded/
    );
  });

  it("その他の HTTP エラーは状態コードを出す", async () => {
    vi.stubGlobal("fetch", respond({}, 500));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(/500/);
  });

  it("通信そのものが失敗したら伝える", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(/GitHub/);
  });

  it("例外の文言にトークンを含めない", async () => {
    vi.stubGlobal("fetch", respond({ message: "Bad credentials" }, 401));

    const error = await verifyToken("github_pat_secret", "me/blog").catch((e: Error) => e);

    expect((error as Error).message).not.toContain("github_pat_secret");
  });
});

// ★実地確認で分かった穴。GET /repos が返す permissions は
// 「トークンの権限」ではなく「所有者のリポジトリ権限」を映す。
// Contents を付け忘れたトークンでも push: true で通ってしまっていた
describe("verifyToken — Contents 権限まで確かめる", () => {
  /** 1回目は /repos、2回目は /commits を返す */
  function stubTwo(second: { body: unknown; status: number }) {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/commits?per_page=1")) {
        return new Response(JSON.stringify(second.body), { status: second.status });
      }
      return new Response(JSON.stringify(writable), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("Contents が読めるかを実際に確かめる", async () => {
    const fetchMock = stubTwo({ body: [{ sha: "abc" }], status: 200 });

    await verifyToken("github_pat_secret", "me/blog");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${GITHUB_API_BASE}/repos/me/blog`,
      `${GITHUB_API_BASE}/repos/me/blog/commits?per_page=1`,
    ]);
  });

  it("Contents が無ければ貼り付けの時点で断る", async () => {
    stubTwo({
      body: { message: "Resource not accessible by personal access token" },
      status: 403,
    });

    const error = await verifyToken("github_pat_secret", "me/blog").catch((e: Error) => e);

    expect((error as Error).message).toContain("Contents");
    expect((error as Error).message).toContain("組織");
  });

  // 空のリポジトリは 409 を返す。トークン自体は通っている
  it("空のリポジトリでもトークンは受け入れる", async () => {
    stubTwo({ body: { message: "Git Repository is empty." }, status: 409 });

    await expect(verifyToken("github_pat_secret", "me/blog")).resolves.toBeUndefined();
  });

  it("2回目が 401 ならトークンが無効だと伝える", async () => {
    stubTwo({ body: { message: "Bad credentials" }, status: 401 });

    await expect(verifyToken("github_pat_secret", "me/blog")).rejects.toThrow(/無効/);
  });
});
