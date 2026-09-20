import type { GitHubConfig } from "../types";

/** 既定値を埋めたあとの設定。すべての項目が揃っている */
export interface ResolvedGitHubConfig {
  repo: string;
  branch: string;
  mdDir: string;
  imageDir: string;
}

/**
 * 前後のスラッシュを落とす。
 *
 * パスは `${mdDir}/${filename}` の形で組み立てるため、`/src/articles/` の
 * ままだと `//src/articles//2026-...md` になり GitHub 側で別のパスになる。
 */
function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

/**
 * `github` prop に既定値を埋める（spec §15）。
 *
 * 既定は spec §2 の構成に合わせています。空文字は「省略」と同じ扱いです —
 * 既定が消えると、意図しないパスに書き込んでしまうためです。
 */
export function resolveGitHubConfig(config: GitHubConfig): ResolvedGitHubConfig {
  return {
    repo: config.repo,
    branch: config.branch || "main",
    mdDir: trimSlashes(config.mdDir || "src/articles"),
    imageDir: trimSlashes(config.imageDir || "public/article_imgs"),
  };
}
