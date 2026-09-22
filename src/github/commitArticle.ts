import { githubRequest, GitHubApiError } from "./api";
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

/** コミットに含める画像。`imageDir` の下に置く */
export interface CommitImage {
  name: string;
  file: Blob;
}

/**
 * 同名の画像が既にある。上書きすると、その画像を使っている**別の記事**が
 * 壊れる（spec §15）。
 */
export class ImageExistsError extends Error {
  constructor(names: string[]) {
    super(
      `${names.join("、")} は GitHub に既にあります。Studio で名前を変えてから出し直してください（上書きすると、その画像を使っている別の記事が壊れます）。`
    );
    this.name = "ImageExistsError";
  }
}

/**
 * リポジトリにコミットが1つも無い。空のリポジトリには既定ブランチも存在しない。
 *
 * GitHub は "Git Repository is empty." を返すが、それでは何をすればよいか分からない。
 */
export class EmptyRepositoryError extends Error {
  constructor(repo: string) {
    super(
      `${repo} にまだコミットが1つもありません。GitHub で README などを1つコミットしてから出し直してください。`
    );
    this.name = "EmptyRepositoryError";
  }
}

/** 指定のブランチが無い。既定は main なので、master などだと踏む */
export class MissingBranchError extends Error {
  constructor(repo: string, branch: string) {
    super(
      `${repo} に ${branch} ブランチがありません。既定は main です。違う名前なら github の branch に指定してください。`
    );
    this.name = "MissingBranchError";
  }
}

interface CommitParams {
  token: string;
  config: ResolvedGitHubConfig;
  /** 拡張子付きのファイル名。`mdDir` の下に置く */
  filename: string;
  markdown: string;
  message: string;
  images?: CommitImage[];
}

/**
 * 画像を base64 にする。GitHub の blob API はバイナリを直接受け取れない。
 *
 * 一度に spread すると大きな画像で引数の上限を超えるため、小分けにする。
 */
async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
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
  images = [],
}: CommitParams): Promise<string> {
  const { repo, branch, mdDir } = config;
  const path = `${mdDir}/${filename}`;

  // 1. いまの先端
  let ref: RefResponse;
  try {
    ref = await githubRequest<RefResponse>(token, `/repos/${repo}/git/ref/heads/${branch}`);
  } catch (reason: unknown) {
    // GitHub の文言（"Git Repository is empty." / "Not Found"）では
    // 何をすればよいか分からない
    if (reason instanceof GitHubApiError) {
      if (reason.status === 409) throw new EmptyRepositoryError(repo);
      if (reason.status === 404) throw new MissingBranchError(repo, branch);
    }
    throw reason;
  }
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
  const taken = new Set(baseTree.tree.map((entry) => entry.path));

  if (taken.has(path)) {
    throw new ArticleExistsError(path);
  }

  // md の衝突を先に出す。日付を変えれば画像の話はそもそも起きない
  const clashingImages = images
    .filter((image) => taken.has(`${config.imageDir}/${image.name}`))
    .map((image) => image.name);

  if (clashingImages.length > 0) {
    throw new ImageExistsError(clashingImages);
  }

  // 4. 中身を預ける。ここではまだどこにも現れない
  const blob = await githubRequest<BlobResponse>(token, `/repos/${repo}/git/blobs`, {
    method: "POST",
    body: { content: markdown, encoding: "utf-8" },
  });

  // 画像も同じコミットに入れる。別コミットにすると、途中で失敗したとき
  // 画像だけがリポジトリに残る（spec §15）
  const imageEntries = await Promise.all(
    images.map(async (image) => {
      const uploaded = await githubRequest<BlobResponse>(token, `/repos/${repo}/git/blobs`, {
        method: "POST",
        body: { content: await toBase64(image.file), encoding: "base64" },
      });

      return {
        path: `${config.imageDir}/${image.name}`,
        mode: FILE_MODE,
        type: "blob" as const,
        sha: uploaded.sha,
      };
    })
  );

  // 5. 置き場所を決めたツリー。base_tree を渡さないと既存のファイルが全部消える
  const tree = await githubRequest<TreeResponse>(token, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree: [{ path, mode: FILE_MODE, type: "blob", sha: blob.sha }, ...imageEntries],
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
