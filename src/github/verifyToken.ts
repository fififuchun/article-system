/** REST API の入口。ここは CORS 対応なのでブラウザから叩ける（spec §15） */
export const GITHUB_API_BASE = "https://api.github.com";

/** 明示しないと、既定版が上がったときに黙って壊れる */
export const GITHUB_API_VERSION = "2022-11-28";

interface RepoResponse {
  permissions?: { push?: boolean };
  message?: string;
}

/** 認証付きリクエストの共通ヘッダー。トークンはURLに載せない */
export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

/**
 * 貼られたトークンをその場で確かめる（spec §15）。
 *
 * 確かめずに受け入れると、記事を書き終えてコミットを押した時点で初めて
 * 「権限がありません」と分かります。貼った直後なら作り直すだけで済みます。
 *
 * 通れば解決し、通らなければ理由を持つ例外を投げます。
 */
export async function verifyToken(token: string, repo: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}/repos/${repo}`, {
      headers: authHeaders(token),
    });
  } catch {
    // ネットワーク断のほか、CORS で弾かれた場合もここに来る
    throw new Error("GitHub に接続できませんでした。通信状態を確かめてください。");
  }

  if (response.status === 401) {
    throw new Error("トークンが無効です。GitHub で作り直して貼り直してください。");
  }

  if (response.status === 404) {
    // GitHub は権限の無いリポジトリにも 404 を返す。存在を漏らさないため
    throw new Error(
      `リポジトリ ${repo} が見つかりません。名前の綴りと、トークンがこのリポジトリを対象にしているかを確かめてください。`
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as RepoResponse;
    throw new Error(
      body.message
        ? `GitHub が拒否しました: ${body.message}`
        : `GitHub への問い合わせに失敗しました（HTTP ${response.status}）`
    );
  }

  const repository = (await response.json()) as RepoResponse;
  if (!repository.permissions?.push) {
    throw new Error(
      "このトークンには書き込み権限がありません。Contents を Read and write にしてください。"
    );
  }
}
