import { authHeaders, GITHUB_API_BASE } from "./api";

interface RepoResponse {
  permissions?: { push?: boolean };
  message?: string;
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
