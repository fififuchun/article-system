import { randomUrlSafeToken } from "./pkce";

/** GitHub の認可画面。ここへ遷移させる（spec §15） */
export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

interface AuthorizeParams {
  clientId: string;
  /** GitHub App に登録した Callback URL と完全一致させる */
  redirectUri: string;
  /** 戻ってきたときに突き合わせる使い捨ての値 */
  state: string;
  /** code_verifier の SHA-256（base64url） */
  codeChallenge: string;
}

/**
 * 戻ってきた認可が自分の出したものか確かめるための使い捨て値。
 *
 * 固定値にすると、他サイトが仕込んだ `code` をそのまま掴まされます（CSRF）。
 */
export function createState(): string {
  return randomUrlSafeToken(16);
}

/**
 * 認可画面のURLを組み立てる（spec §15）。
 *
 * `client_secret` は載せません。ブラウザに秘密は置けないため、代わりに
 * PKCE の `code_challenge` を渡します。`plain` を許すと PKCE の意味が
 * 無くなるので `S256` で固定します。
 */
export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: AuthorizeParams): string {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${GITHUB_AUTHORIZE_URL}?${query}`;
}
