import { useEffect, useRef, useState } from "react";
import type { ResolvedGitHubConfig } from "./resolveConfig";
import { buildAuthorizeUrl, createState } from "./authUrl";
import { createCodeChallenge, createCodeVerifier } from "./pkce";
import { exchangeCodeForToken } from "./exchangeCode";
import { redirectTo } from "./navigate";
import {
  clearPendingAuth,
  clearToken,
  loadPendingAuth,
  loadToken,
  savePendingAuth,
  saveToken,
} from "./tokenStorage";

export type GitHubAuthStatus = "loading" | "anonymous" | "authenticated" | "error";

export interface GitHubAuth {
  status: GitHubAuthStatus;
  /** アクセストークン。未ログインなら `null`。画面には出さない */
  token: string | null;
  /** 失敗した理由。利用者に見せる文言 */
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
}

/** リダイレクトで戻ってきた `?code=` と `?state=` を読む */
function readCallback(): { code: string; state: string } | null {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const state = query.get("state");

  return code === null ? null : { code, state: state ?? "" };
}

/**
 * 交換に使い終わった `?code=` をURLから消す。
 *
 * 残したままリロードすると、使用済みの code を再送して必ず失敗します。
 */
function stripCallbackQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * GitHub App のログイン（spec §15）。
 *
 * バックエンドを持たないため、PKCE で「認可を始めたのは自分だ」を証明します。
 * トークンは sessionStorage に置き、戻り値以外には出しません。
 */
export function useGitHubAuth(
  config: ResolvedGitHubConfig,
  storageKey?: string
): GitHubAuth {
  const callback = useRef(readCallback()).current;

  const [token, setToken] = useState<string | null>(
    () => (callback ? null : (loadToken(storageKey)?.accessToken ?? null))
  );
  const [status, setStatus] = useState<GitHubAuthStatus>(() => {
    if (callback) return "loading";
    return loadToken(storageKey) ? "authenticated" : "anonymous";
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callback) return;

    let cancelled = false;
    const pending = loadPendingAuth(storageKey);

    // 使い終わった code を先に消す。成功しても失敗してもURLには残さない
    stripCallbackQuery();
    clearPendingAuth(storageKey);

    // ログイン操作をしていないのに ?code= だけ付けて開かれた場合
    if (!pending) {
      setStatus("error");
      setError("ログインの途中経過が見つかりません。もう一度ログインしてください。");
      return;
    }

    exchangeCodeForToken({
      clientId: config.clientId,
      code: callback.code,
      redirectUri: config.redirectUri,
      codeVerifier: pending.codeVerifier,
      state: callback.state,
      expectedState: pending.state,
    })
      .then((stored) => {
        if (cancelled) return;
        saveToken(storageKey, stored);
        setToken(stored.accessToken);
        setStatus("authenticated");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "ログインに失敗しました。");
      });

    return () => {
      cancelled = true;
    };
  }, [callback, config.clientId, config.redirectUri, storageKey]);

  const login = async () => {
    const codeVerifier = createCodeVerifier();
    const state = createState();

    // 遷移するとページが破棄されるので、先に預ける
    savePendingAuth(storageKey, { state, codeVerifier });

    redirectTo(
      buildAuthorizeUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        state,
        codeChallenge: await createCodeChallenge(codeVerifier),
      })
    );
  };

  const logout = () => {
    clearToken(storageKey);
    clearPendingAuth(storageKey);
    setToken(null);
    setError(null);
    setStatus("anonymous");
  };

  return { status, token, error, login, logout };
}
