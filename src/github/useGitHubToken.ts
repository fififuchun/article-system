import { useState } from "react";
import { verifyToken } from "./verifyToken";
import { clearToken, loadToken, saveToken } from "./tokenStorage";

export type GitHubTokenStatus = "missing" | "verifying" | "ready" | "error";

export interface GitHubToken {
  status: GitHubTokenStatus;
  /** アクセストークン。未設定なら `null`。画面には出さない */
  token: string | null;
  /** 通らなかった理由。利用者に見せる文言 */
  error: string | null;
  /** 貼られた値を確かめて受け入れる */
  submit: (value: string) => Promise<void>;
  /** 保存を捨てる */
  clear: () => void;
}

/**
 * 貼られた fine-grained PAT を扱う（spec §15）。
 *
 * 保存済みのトークンは読み込み時に検証し直しません。貼った時点で確かめて
 * あり、失効はコミット時の 401 で気づけるためです。毎回の読み込みで
 * 通信すると、書き始めるまでの待ち時間が増えます。
 */
export function useGitHubToken(repo: string, storageKey?: string): GitHubToken {
  const [token, setToken] = useState<string | null>(
    () => loadToken(storageKey)?.accessToken ?? null
  );
  const [status, setStatus] = useState<GitHubTokenStatus>(() =>
    loadToken(storageKey) ? "ready" : "missing"
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    // 貼り付けで前後に空白や改行が入ることがある
    const candidate = value.trim();

    if (!candidate) {
      setStatus("error");
      setError("トークンを入力してください。");
      return;
    }

    setStatus("verifying");
    setError(null);

    try {
      await verifyToken(candidate, repo);
    } catch (reason: unknown) {
      // 通らなかったトークンは保存しない。残すと次の読み込みで通った気になる
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "トークンを確認できませんでした。");
      return;
    }

    saveToken(storageKey, { accessToken: candidate });
    setToken(candidate);
    setStatus("ready");
  };

  const clear = () => {
    clearToken(storageKey);
    setToken(null);
    setError(null);
    setStatus("missing");
  };

  return { status, token, error, submit, clear };
}
