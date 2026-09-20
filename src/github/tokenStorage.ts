const PREFIX = "as-github-token";

/** GitHub から受け取ったトークン一式（spec §15） */
export interface StoredToken {
  accessToken: string;
  /**
   * 失効する時刻（epoch ミリ秒）。
   *
   * PAT には期限情報が無いため省略できます。その場合はタブを閉じるまで保ちます。
   */
  expiresAt?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
}

/**
 * トークンの保存先キー。
 *
 * `vite dev` はどのプロジェクトでも既定で同じオリジンを使うため、
 * 下書きと同じく `storageKey` で分けます（spec §9）。
 */
export function tokenKey(storageKey = "default"): string {
  return `${PREFIX}:${storageKey}`;
}

/**
 * トークンを sessionStorage に保存する（spec §15）。
 *
 * localStorage を使わないのは、タブを閉じたあとも端末に残さないためです。
 * 保存できない環境でも落としません — ログインし直せば書ける状態に戻ります。
 */
export function saveToken(storageKey: string | undefined, token: StoredToken): void {
  try {
    sessionStorage.setItem(tokenKey(storageKey), JSON.stringify(token));
  } catch {
    // プライベートブラウジングや容量超過
  }
}

/**
 * トークンを読む。無ければ `null`。
 *
 * **期限切れは `null` を返し、保存も消します。** 返してしまうと、使えない
 * トークンでコミットを試みて 401 になり、原因が分かりにくくなります。
 */
export function loadToken(storageKey?: string): StoredToken | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(tokenKey(storageKey));
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: StoredToken;
  try {
    parsed = JSON.parse(raw) as StoredToken;
  } catch {
    // 手で書き換えられた場合。ここで落とすとログイン画面すら出せない
    clearToken(storageKey);
    return null;
  }

  if (typeof parsed?.accessToken !== "string") {
    clearToken(storageKey);
    return null;
  }

  // 期限を持つのは GitHub App のトークンだけ。PAT は持たない
  if (typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now()) {
    clearToken(storageKey);
    return null;
  }

  return parsed;
}

/** トークンを捨てる。ログアウトと、期限切れを見つけたときに使う */
export function clearToken(storageKey?: string): void {
  try {
    sessionStorage.removeItem(tokenKey(storageKey));
  } catch {
    // 消せないだけ。期限が来れば loadToken が弾く
  }
}

