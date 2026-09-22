/** REST API の入口。ここは CORS 対応なのでブラウザから叩ける（spec §15） */
export const GITHUB_API_BASE = "https://api.github.com";

/** 明示しないと、既定版が上がったときに黙って壊れる */
export const GITHUB_API_VERSION = "2022-11-28";

/** 認証付きリクエストの共通ヘッダー。トークンはURLに載せない */
export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

/**
 * 呼び出し側が出し分けたい区別だけを持つ（spec §15）。
 *
 * - `unauthorized` — トークンを破棄して貼り直しを促す
 * - `conflict` — 他人が先に push した。やり直せば通る見込みがある
 * - `network` / `other` — 理由を見せて「代わりにダウンロード」に回す
 */
export type GitHubErrorKind = "network" | "unauthorized" | "conflict" | "other";

export class GitHubApiError extends Error {
  readonly kind: GitHubErrorKind;
  /** 通信そのものが失敗した場合は 0 */
  readonly status: number;

  constructor(message: string, kind: GitHubErrorKind, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.kind = kind;
    this.status = status;
  }
}

function kindOf(status: number): GitHubErrorKind {
  if (status === 401) return "unauthorized";
  // 409 は衝突、422 は ref の早送りができないとき
  if (status === 409 || status === 422) return "conflict";
  return "other";
}

interface RequestOptions {
  method?: string;
  /** JSON にして送る。GET では渡さない */
  body?: unknown;
}

interface ErrorBody {
  message?: string;
}

/**
 * 認証付きの `fetch`（spec §15）。
 *
 * 失敗は必ず `GitHubApiError` にして投げます。呼び出し側が状態コードを
 * 直接読まずに済むよう、出し分けたい区別だけを `kind` に畳んでいます。
 */
export async function githubRequest<T>(
  token: string,
  path: string,
  { method = "GET", body }: RequestOptions = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      // ブラウザに応答を再利用させない。古い先端の上にコミットを作ると
      // ref を早送りできず、最新ツリーによる衝突検出も効かなくなる
      cache: "no-store",
      headers: body
        ? { ...authHeaders(token), "Content-Type": "application/json" }
        : authHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // ネットワーク断のほか、CORS で弾かれた場合もここに来る
    throw new GitHubApiError(
      "GitHub に接続できませんでした。通信状態を確かめてください。",
      "network",
      0
    );
  }

  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new GitHubApiError(
      failure.message || `GitHub への要求が失敗しました（HTTP ${response.status}）`,
      kindOf(response.status),
      response.status
    );
  }

  // 204 など本文を返さない応答がある
  return (await response.json().catch(() => null)) as T;
}
