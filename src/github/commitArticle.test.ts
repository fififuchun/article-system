import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { commitArticle, ArticleExistsError } from "./commitArticle";
import { GitHubApiError } from "./api";

const config = {
  repo: "me/blog",
  branch: "main",
  mdDir: "src/articles",
  imageDir: "public/article_imgs",
};

const params = {
  token: "github_pat_secret",
  config,
  filename: "2026-08-23-夏の更新.md",
  markdown: "---\ntitle: 夏の更新\n---\n\n本文",
  message: "記事を追加: 夏の更新",
};

/** 呼ばれた順に [メソッド, パス] を記録しつつ、GitHub の応答を真似る */
let calls: [string, string][];

function stubGitHub(existingPaths: string[] = []) {
  calls = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://api.github.com", "");
    calls.push([init.method ?? "GET", path]);

    if (path.includes("/git/ref/heads/")) {
      return new Response(JSON.stringify({ object: { sha: "commit-old" } }), { status: 200 });
    }
    if (path.includes("/git/commits/")) {
      return new Response(JSON.stringify({ tree: { sha: "tree-old" } }), { status: 200 });
    }
    if (path.includes("/git/trees/")) {
      return new Response(
        JSON.stringify({ tree: existingPaths.map((p) => ({ path: p, type: "blob" })) }),
        { status: 200 }
      );
    }
    if (path.endsWith("/git/blobs")) {
      return new Response(JSON.stringify({ sha: "blob-new" }), { status: 201 });
    }
    if (path.endsWith("/git/trees")) {
      return new Response(JSON.stringify({ sha: "tree-new" }), { status: 201 });
    }
    if (path.endsWith("/git/commits")) {
      return new Response(JSON.stringify({ sha: "commit-new" }), { status: 201 });
    }
    return new Response(JSON.stringify({ object: { sha: "commit-new" } }), { status: 200 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** 指定したパスに送った本文を取り出す */
function bodyFor(fetchMock: ReturnType<typeof stubGitHub>, suffix: string) {
  const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith(suffix));
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

// 波括弧で包む。値を返すと vitest が戻り値を後処理関数として呼んでしまう
beforeEach(() => {
  stubGitHub();
});
afterEach(() => vi.unstubAllGlobals());

describe("commitArticle — 手順", () => {
  it("spec §15 の順に叩く", async () => {
    stubGitHub();

    await commitArticle(params);

    expect(calls).toEqual([
      ["GET", "/repos/me/blog/git/ref/heads/main"],
      ["GET", "/repos/me/blog/git/commits/commit-old"],
      ["GET", "/repos/me/blog/git/trees/tree-old?recursive=1"],
      ["POST", "/repos/me/blog/git/blobs"],
      ["POST", "/repos/me/blog/git/trees"],
      ["POST", "/repos/me/blog/git/commits"],
      ["PATCH", "/repos/me/blog/git/refs/heads/main"],
    ]);
  });

  // ★ここが Git Data API を選んだ理由（spec §15）。
  // ref 更新より前に何かが公開されると、途中失敗で中途半端な状態が残る
  it("ref の更新がいちばん最後になる", async () => {
    stubGitHub();

    await commitArticle(params);

    const refUpdate = calls.findIndex(([method]) => method === "PATCH");
    expect(refUpdate).toBe(calls.length - 1);
  });

  it("新しいコミットの SHA を返す", async () => {
    stubGitHub();

    await expect(commitArticle(params)).resolves.toBe("commit-new");
  });
});

describe("commitArticle — 送る中身", () => {
  it("md を blob にして送る", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    expect(bodyFor(fetchMock, "/git/blobs")).toEqual({
      content: params.markdown,
      encoding: "utf-8",
    });
  });

  it("mdDir の下に置く", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    const tree = bodyFor(fetchMock, "/git/trees");
    expect(tree.tree).toEqual([
      {
        path: "src/articles/2026-08-23-夏の更新.md",
        mode: "100644",
        type: "blob",
        sha: "blob-new",
      },
    ]);
  });

  // base_tree を渡さないと、既存のファイルが全部消えたツリーになる
  it("既存のツリーを土台にする", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    expect(bodyFor(fetchMock, "/git/trees").base_tree).toBe("tree-old");
  });

  it("直前のコミットを親にする", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    expect(bodyFor(fetchMock, "/git/commits")).toEqual({
      message: "記事を追加: 夏の更新",
      tree: "tree-new",
      parents: ["commit-old"],
    });
  });

  it("作ったコミットに ref を進める", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    expect(bodyFor(fetchMock, "/git/refs/heads/main").sha).toBe("commit-new");
  });

  // 既定では早送りできないときだけ失敗する。force を付けると他人の
  // コミットを消してしまう
  it("force で上書きしない", async () => {
    const fetchMock = stubGitHub();

    await commitArticle(params);

    expect(bodyFor(fetchMock, "/git/refs/heads/main").force).toBeFalsy();
  });
});

describe("commitArticle — 衝突", () => {
  // spec §15: articles はビルド時のスナップショットなので、
  // 同じセッションで先にコミットした記事を黙って上書きしてしまう
  it("同名のファイルが最新ツリーにあれば何も書かない", async () => {
    const fetchMock = stubGitHub(["src/articles/2026-08-23-夏の更新.md"]);

    await expect(commitArticle(params)).rejects.toBeInstanceOf(ArticleExistsError);
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit).method === "PATCH")).toBe(
      false
    );
  });

  it("衝突の文言にファイル名を入れる", async () => {
    stubGitHub(["src/articles/2026-08-23-夏の更新.md"]);

    await expect(commitArticle(params)).rejects.toThrow("2026-08-23-夏の更新.md");
  });

  it("別のファイルがあるだけなら通す", async () => {
    stubGitHub(["src/articles/2026-01-01-冬の更新.md", "README.md"]);

    await expect(commitArticle(params)).resolves.toBe("commit-new");
  });
});

describe("commitArticle — 失敗", () => {
  it("途中で失敗したら ref を進めない", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (typeof url !== "string") { console.log("BADCALL", typeof url, url); throw new Error("bad"); }
    const path = url.replace("https://api.github.com", "");
      if (path.endsWith("/git/trees") && init.method === "POST") {
        return new Response(JSON.stringify({ message: "壊れたツリー" }), { status: 422 });
      }
      if (path.includes("/git/ref/heads/")) {
        return new Response(JSON.stringify({ object: { sha: "commit-old" } }), { status: 200 });
      }
      if (path.includes("/git/commits/")) {
        return new Response(JSON.stringify({ tree: { sha: "tree-old" } }), { status: 200 });
      }
      if (path.includes("/git/trees/")) {
        return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ sha: "blob-new" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(commitArticle(params)).rejects.toBeInstanceOf(GitHubApiError);
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit).method === "PATCH")
    ).toBe(false);
  });
});
