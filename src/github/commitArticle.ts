import { githubRequest } from "./api";
import type { ResolvedGitHubConfig } from "./resolveConfig";

/** 同名のファイルが既にある。コミットすれば消してしまう（spec §6 / §15） */
export class ArticleExistsError extends Error {
  constructor(path: string) {
    super(
      `${path} は GitHub に既にあります。日付かタイトルを変えてください（上書きすると元の記事が消えます）。`
    );
    this.name = "ArticleExistsError";
  }
}

interface CommitParams {
  token: string;
  config: ResolvedGitHubConfig;
  /** 拡張子付きのファイル名。`mdDir` の下に置く */
  filename: string;
  markdown: string;
  message: string;
}

interface RefResponse {
  object: { sha: string };
}

interface CommitResponse {
  sha: string;
  tree: { sha: string };
}

interface TreeResponse {
  sha: string;
  tree: { path: string; type: string }[];
}

interface BlobResponse {
  sha: string;
}

/** 通常のファイル。実行ビットは立てない */
const FILE_MODE = "100644";

/**
 * 記事を1コミットでリポジトリに置く（spec §15）。
 *
 * Contents API は 1リクエスト＝1ファイル＝1コミットなので、複数のファイルを
 * 順に置くと、途中で失敗したとき中途半端な状態が公開されたまま残ります。
 * Git Data API なら blob → tree → commit と組み立て、**最後の ref 更新まで
 * リポジトリには何も現れません**。
 *
 * 新しいコミットの SHA を返します。
 */
export async function commitArticle({
  token,
  config,
  filename,
  markdown,
  message,
}: CommitParams): Promise<string> {
  const { repo, branch, mdDir } = config;
  const path = `${mdDir}/${filename}`;

  // 1. いまの先端
  const ref = await githubRequest<RefResponse>(
    token,
    `/repos/${repo}/git/ref/heads/${branch}`
  );
  const parentSha = ref.object.sha;

  // 2. その中身（base_tree に要る）
  const parent = await githubRequest<CommitResponse>(
    token,
    `/repos/${repo}/git/commits/${parentSha}`
  );
  const baseTreeSha = parent.tree.sha;

  // 3. 衝突を確かめる。`articles` はビルド時のスナップショットなので、
  //    同じセッションで先にコミットした記事を黙って上書きしてしまう
  const baseTree = await githubRequest<TreeResponse>(
    token,
    `/repos/${repo}/git/trees/${baseTreeSha}?recursive=1`
  );
  if (baseTree.tree.some((entry) => entry.path === path)) {
    throw new ArticleExistsError(path);
  }

  // 4. 中身を預ける。ここではまだどこにも現れない
  const blob = await githubRequest<BlobResponse>(token, `/repos/${repo}/git/blobs`, {
    method: "POST",
    body: { content: markdown, encoding: "utf-8" },
  });

  // 5. 置き場所を決めたツリー。base_tree を渡さないと既存のファイルが全部消える
  const tree = await githubRequest<TreeResponse>(token, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree: [{ path, mode: FILE_MODE, type: "blob", sha: blob.sha }],
    },
  });

  // 6. コミット。まだ枝は指していない
  const commit = await githubRequest<CommitResponse>(token, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [parentSha] },
  });

  // 7. ここで初めて公開される。force は付けない — 付けると他人のコミットを消す
  await githubRequest(token, `/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: { sha: commit.sha },
  });

  return commit.sha;
}
