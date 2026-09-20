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

function stubGitHub(
  existingPaths: string[] = [],
  failAt?: (method: string, path: string) => boolean
) {
  calls = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://api.github.com", "");
    const method = init.method ?? "GET";
    calls.push([method, path]);

    if (failAt?.(method, path)) {
      return new Response(JSON.stringify({ message: "失敗させた" }), { status: 500 });
    }

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

describe("commitArticle — 画像", () => {
  // spec §15: 画像も同じコミットに含める。別コミットにすると、
  // 途中で失敗したとき画像だけが残る
  const images = [
    { name: "art_0.webp", file: new Blob([new Uint8Array([104, 101, 108, 108, 111])]) },
  ];

  it("画像を base64 の blob にして送る", async () => {
    const fetchMock = stubGitHub();

    await commitArticle({ ...params, images });

    const blobBodies = fetchMock.mock.calls
      .filter(([url]) => (url as string).endsWith("/git/blobs"))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string));

    expect(blobBodies).toContainEqual({ content: "aGVsbG8=", encoding: "base64" });
  });

  it("imageDir の下に置く", async () => {
    const fetchMock = stubGitHub();

    await commitArticle({ ...params, images });

    const paths = bodyFor(fetchMock, "/git/trees").tree.map(
      (entry: { path: string }) => entry.path
    );
    expect(paths).toContain("public/article_imgs/art_0.webp");
  });

  it("md と画像を同じツリーに入れる", async () => {
    const fetchMock = stubGitHub();

    await commitArticle({ ...params, images });

    expect(bodyFor(fetchMock, "/git/trees").tree).toHaveLength(2);
  });

  it("ツリーは1回しか作らない（＝コミットは1つ）", async () => {
    const fetchMock = stubGitHub();

    await commitArticle({ ...params, images });

    const treePosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        (url as string).endsWith("/git/trees") && (init as RequestInit).method === "POST"
    );
    expect(treePosts).toHaveLength(1);
  });

  it("画像が無ければ md だけを置く", async () => {
    const fetchMock = stubGitHub();

    await commitArticle({ ...params, images: [] });

    expect(bodyFor(fetchMock, "/git/trees").tree).toHaveLength(1);
  });

  it("画像があっても ref の更新は最後のまま", async () => {
    stubGitHub();

    await commitArticle({ ...params, images });

    expect(calls.findIndex(([method]) => method === "PATCH")).toBe(calls.length - 1);
  });

  it("md の衝突を先に見て、画像を1つも送らない", async () => {
    const fetchMock = stubGitHub(["src/articles/2026-08-23-夏の更新.md"]);

    await commitArticle({ ...params, images }).catch(() => {});

    expect(
      fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/git/blobs"))
    ).toBe(false);
  });
});

// ★Git Data API を選んだ理由そのもの（spec §15）。
// ref 更新より前にリポジトリへ現れるものがあってはならない
describe("commitArticle — どの手順で失敗しても ref を進めない", () => {
  const steps: [string, string, string][] = [
    ["先端の取得", "GET", "/git/ref/heads/"],
    ["親コミットの取得", "GET", "/git/commits/"],
    ["ツリーの取得", "GET", "/git/trees/"],
    ["blob の作成", "POST", "/git/blobs"],
    ["ツリーの作成", "POST", "/git/trees"],
    ["コミットの作成", "POST", "/git/commits"],
  ];

  it.each(steps)("%s が失敗しても ref は進まない", async (_label, method, marker) => {
    const images = [{ name: "art_0.webp", file: new Blob([new Uint8Array([104])]) }];
    stubGitHub(
      [],
      (calledMethod, path) =>
        calledMethod === method &&
        (method === "GET" ? path.includes(marker) : path.endsWith(marker))
    );

    await expect(commitArticle({ ...params, images })).rejects.toThrow();
    expect(calls.some(([calledMethod]) => calledMethod === "PATCH")).toBe(false);
  });

  it("成功したときだけ ref が1回だけ進む", async () => {
    stubGitHub();

    await commitArticle(params);

    expect(calls.filter(([method]) => method === "PATCH")).toHaveLength(1);
  });
});
