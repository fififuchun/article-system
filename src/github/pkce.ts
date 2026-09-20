/**
 * PKCE（RFC 7636）。GitHub App の SPA クライアントでは必須です（spec §15）。
 *
 * ブラウザに client secret を置けないため、代わりに毎回使い捨ての秘密
 * （code_verifier）を作り、そのハッシュ（code_challenge）だけを先に
 * GitHub へ渡します。横取りされた code だけでは交換できません。
 */

/** バイト列を base64url に直す。+ / = はURLで壊れるため使えない */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** URL で安全なランダム文字列。code_verifier と state の両方で使う */
export function randomUrlSafeToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** 使い捨ての秘密を作る。32バイトを base64url にすると43文字になる */
export function createCodeVerifier(): string {
  return randomUrlSafeToken(32);
}

/** verifier の SHA-256 を base64url で返す（S256 方式） */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return toBase64Url(new Uint8Array(digest));
}
