import type { StoredToken } from "./tokenStorage";

/** code をトークンに交換するエンドポイント。SPA として登録すると CORS が付く（spec §15） */
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

interface ExchangeParams {
  clientId: string;
  /** リダイレクトで戻ってきた `?code=` */
  code: string;
  /** 認可時と同じ値でなければ GitHub が弾く */
  redirectUri: string;
  /** 認可前に作って保存しておいた使い捨ての秘密 */
  codeVerifier: string;
  /** リダイレクトで戻ってきた `?state=` */
  state: string;
  /** 認可前に作って保存しておいた state */
  expectedState: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * `?code=` をトークンに交換する（spec §15）。
 *
 * `client_secret` は送りません。ブラウザに秘密を置けないため、認可前に作った
 * `code_verifier` を示すことで「認可を始めたのは自分だ」と証明します。
 */
export async function exchangeCodeForToken({
  clientId,
  code,
  redirectUri,
  codeVerifier,
  state,
  expectedState,
}: ExchangeParams): Promise<StoredToken> {
  // 交換より先に確かめる。通信してしまうと、他サイトが仕込んだ code で
  // トークンを取りに行くことになる（CSRF）。空同士の一致も認めない
  if (!expectedState || state !== expectedState) {
    throw new Error("認可の state が一致しません。ログインをやり直してください。");
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      // 既定では HTML が返る
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub のトークン取得に失敗しました（HTTP ${response.status}）`);
  }

  // GitHub は交換に失敗しても 200 を返し、本文に error を入れてくる
  const body = (await response.json()) as TokenResponse;
  if (body.error) {
    throw new Error(body.error_description || body.error);
  }

  if (!body.access_token) {
    throw new Error("GitHub からトークンが返りませんでした。");
  }

  // spec §15: 有効期限付きトークンが必須。期限が無い App は SPA から使えない
  if (typeof body.expires_in !== "number") {
    throw new Error(
      "GitHub App が有効期限付きトークンを返していません。App の設定で期限を有効にしてください。"
    );
  }

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    refreshToken: body.refresh_token,
    refreshTokenExpiresAt:
      typeof body.refresh_token_expires_in === "number"
        ? Date.now() + body.refresh_token_expires_in * 1000
        : undefined,
  };
}
