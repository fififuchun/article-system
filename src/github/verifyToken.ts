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
      "このアカウントにはこのリポジトリへの書き込み権限がありません。"
    );
  }

  // ここまでは Metadata 権限だけで通る。`permissions` は**所有者の**
  // リポジトリ権限を映すので、トークンに Contents が付いているかは分からない。
  // Contents を要求する呼び出しを1つ実際に試す（spec §15）
  await verifyContentsAccess(token, repo);
}

/**
 * Contents 権限が付いているかを、読み取り1回で確かめる。
 *
 * 書き込みだけを試す手段は無い（試せば書いてしまう）ため、確かめられるのは
 * 読み取りまでです。とはいえ「Contents を付け忘れた」がいちばん多い間違いで、
 * それはここで捕まえられます。
 */
async function verifyContentsAccess(token: string, repo: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}/repos/${repo}/commits?per_page=1`, {
      headers: authHeaders(token),
    });
  } catch {
    throw new Error("GitHub に接続できませんでした。通信状態を確かめてください。");
  }

  // 空のリポジトリ。トークン自体は通っているので受け入れる
  if (response.status === 409) return;

  if (response.status === 401) {
    throw new Error("トークンが無効です。GitHub で作り直して貼り直してください。");
  }

  if (response.status === 403) {
    throw new Error(
      "このトークンに Contents の権限がありません。Permissions → Contents を Read and write にしてください。組織のリポジトリなら、組織側で fine-grained token の許可も必要です。"
    );
  }

  if (!response.ok) {
    throw new Error(
      `トークンを確認できませんでした（HTTP ${response.status}）。`
    );
  }
}
