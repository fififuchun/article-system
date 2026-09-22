import { useEffect, useState } from "react";
import type {
  Article,
  ArticleDetailClassNames,
  ArticleStudioClassNames,
  GitHubConfig,
} from "../types";
import { cx } from "../cx";
import { validateArticle, type Issue } from "../validate";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleList } from "./ArticleList";
import { DownloadIcon } from "../icons/DownloadIcon";
import { WarningIcon } from "../icons/WarningIcon";
import { buildDraftArticle } from "../studio/buildDraftArticle";
import { buildFilename } from "../studio/buildFilename";
import { buildTemplate } from "../studio/buildTemplate";
import { downloadBlob, downloadMarkdown } from "../studio/downloadFile";
import { renameImageInMarkdown } from "../studio/renameImage";
import { collectImageNames } from "../studio/collectImageNames";
import { findMissingImages } from "../studio/probeImages";
import { loadDraft, saveDraft } from "../studio/draftStorage";
import { resolveGitHubConfig } from "../github/resolveConfig";
import { useGitHubToken } from "../github/useGitHubToken";
import { commitArticle, type CommitImage } from "../github/commitArticle";

/** ドロップして仮登録した画像。アップロードはしない（spec §9） */
interface DroppedImage {
  /** md に書かれる名前。Studio 上で変更できる */
  name: string;
  /** ブラウザ内だけの一時URL。リロードで無効になる */
  url: string;
  file: File;
}

/** 一覧プレビューで編集中の記事を見分けるための印 */
const DRAFT_MARK = "#draft-preview";

/** 一覧プレビューに出す件数（spec §9） */
const LIST_PREVIEW_COUNT = 6;

interface Props {
  /**
   * 既存記事。**必須です。**
   *
   * 渡さないとファイル名の衝突を検出できず、既存記事が上書きで消えます（spec §6）。
   * 記事が0件のプロジェクトでも createArticles({}) の戻り値をそのまま渡してください。
   */
  articles: Article[];
  /** localStorage の保存先を分ける（spec §9） */
  storageKey?: string;
  imageBasePath?: string;
  dateLabel?: string;
  classNames?: ArticleStudioClassNames;
  articleClassNames?: ArticleDetailClassNames;
  /** 渡すとダウンロードではなくリポジトリへコミットする（spec §15） */
  github?: GitHubConfig;
}

/**
 * 本番を出す先。`github` を渡したときだけ GitHubGate から降りてくる（spec §15）。
 *
 * StudioEditor に GitHub のことを知らせないための境界です。エディタ側は
 * 「文言」と「押されたら呼ぶもの」だけを受け取ります。
 */
interface Publisher {
  label: string;
  commit: (payload: {
    filename: string;
    markdown: string;
    title: string;
    images: CommitImage[];
  }) => Promise<void>;
}

interface EditorProps extends Props {
  publisher?: Publisher;
}

/**
 * Studio の本体。`github` を渡した場合は、ログインを通ったときだけ描画される。
 */
function StudioEditor({
  publisher,
  articles,
  storageKey,
  imageBasePath,
  dateLabel,
  classNames = {},
  articleClassNames,
}: EditorProps) {
  // 生の md を1枚の textarea で編集する。フォーム化しないことで
  // エディタとのコピーペーストが自由に行き来できる（spec §9）
  // 復帰する下書きがあればテンプレートを出さない。出すと保存内容を上書きしてしまう。
  // ?? を使うのは空文字を「下書きなし」と扱わないため（spec §9）
  const [raw, setRaw] = useState(() => loadDraft(storageKey) ?? buildTemplate());
  const [tab, setTab] = useState<"detail" | "list">("detail");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [images, setImages] = useState<DroppedImage[]>([]);
  // 本番を出した後、仮登録の画像がまだリポジトリに置かれていない状態
  const [placementPending, setPlacementPending] = useState(false);

  // 入力のたびに保存する。ボタンを押す必要がないため保存忘れが原理的に起きない（spec §9）
  useEffect(() => {
    saveDraft(storageKey, raw);
  }, [storageKey, raw]);

  // ArticleDetail をそのまま使うことで、プレビューと本番の一致が
  // 構造的に保証される（spec §9）
  const draft = buildDraftArticle(raw, articles);

  // 手書きのファイル名だけ実在を確かめる。ドロップした画像はサーバーに無くて当然（spec §6）
  const basePath = imageBasePath ?? "/article_imgs/";
  const probeNames = collectImageNames(draft.content, draft.thumbnail).filter(
    (name) => !images.some((image) => image.name === name)
  );

  // 仮登録した画像は md にファイル名で書かれる。プレビューだけ blob URL に差し替える
  const toPreviewSrc = (value: string) =>
    images.reduce((text, image) => text.split(image.name).join(image.url), value);

  const previewArticle = {
    ...draft,
    thumbnail: toPreviewSrc(draft.thumbnail),
    content: toPreviewSrc(draft.content),
  };

  // 自動では決して消さない。押されたときだけ、確認を取ってから戻す（spec §9）
  const startNewArticle = () => {
    if (!window.confirm("編集中の内容を消して新しく書き始めます。よろしいですか？")) return;
    setRaw(buildTemplate());
    setIssues([]);
  };

  // リネーム後の名前で保存できるので、スマホだけで作業が完結する（spec §9）
  const downloadImage = (image: DroppedImage) => {
    downloadBlob(image.name, image.file);
  };

  // スマホから選ぶと IMG_1234.jpg になるため、その場で直せることが必須（spec §9）
  const renameImage = (index: number, nextName: string) => {
    const target = images[index];
    setImages(images.map((image, i) => (i === index ? { ...image, name: nextName } : image)));
    setRaw(renameImageInMarkdown(raw, target.name, nextName));
  };

  // アップロードは行わない。ブラウザ内の一時URLで見せるだけ（spec §9）
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const dropped = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (dropped.length === 0) return;

    event.preventDefault();
    const added = dropped.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    }));

    setImages((current) => [...current, ...added]);
    // 次の記事の画像なので、前回の配置依頼は畳む
    setPlacementPending(false);
    const markdown = added.map((image) => `![](${image.name})`).join("\n\n");
    setRaw(`${raw}\n\n${markdown}\n`);
  };

  // 既存記事に混ぜて日付の新しい順の直近6件。隣の記事と並べることで
  // タイトルの折り返しやサムネイルの雰囲気を比較できる（spec §9）。
  // 編集中の記事は先に確保する。過去日を書いたとき、id がずれるかを
  // 確認したい場面でこそ一覧から漏れてしまうため
  const byDateDesc = (a: Article, b: Article) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

  const listPreview = [
    ...[...articles].sort(byDateDesc).slice(0, LIST_PREVIEW_COUNT - 1),
    draft,
  ].sort(byDateDesc);

  // 下書きは検証せずそのまま出す。押した後も編集を続けられる（spec §9）
  const downloadDraft = () => {
    downloadMarkdown(buildFilename(draft.date, draft.title, { draft: true }), raw);
  };

  // 本番は検証必須。エラーがゼロでないと出せない（spec §9）。
  // 画像の確認もここで初めて行う。執筆中に確かめると打鍵ごとに要求が飛ぶ
  const downloadForPublish = async () => {
    const filename = buildFilename(draft.date, draft.title);
    const missingNames = await findMissingImages(probeNames, basePath);
    const missing = missingNames.map((name) => ({
      level: "error" as const,
      message: `画像 ${name} が ${basePath} に見つかりません。名前が違うか、まだ配置していない可能性があります。`,
    }));
    const found = [...validateArticle(raw, { articles, filename }), ...missing];
    setIssues(found);

    if (found.length > 0) return;

    // github を渡された場合はダウンロードせずコミットする（spec §15）
    if (publisher) {
      try {
        await publisher.commit({
          filename,
          markdown: raw,
          title: draft.title,
          images: images.map((image) => ({ name: image.name, file: image.file })),
        });
      } catch (reason: unknown) {
        setIssues([
          {
            level: "error",
            message:
              reason instanceof Error ? reason.message : "コミットに失敗しました。",
          },
        ]);
      }
      return;
    }

    downloadMarkdown(filename, raw);
    // 編集内容はそのまま残す。消したいときは消せばよい
    // ドロップした画像はアップロードしていないので、置いてもらう必要がある（spec §9）
    setPlacementPending(images.length > 0);
  };

  return (
    <div className={cx("as-studio", classNames.wrapper)}>
      {/* 操作は上端の帯にまとめる。狭い画面では CSS で各ペインの側に戻す（spec §9） */}
      <div className={cx("as-studio-actions", classNames.actions)}>
        <button type="button" onClick={downloadForPublish}>
          {publisher?.label ?? "本番ダウンロード"}
        </button>
        <button type="button" onClick={downloadDraft}>
          下書きダウンロード
        </button>
        <button type="button" onClick={startNewArticle}>
          新しく書く
        </button>
      </div>

      <div className={cx("as-studio-tabs", classNames.tabs)} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "detail"} onClick={() => setTab("detail")}>
          詳細
        </button>
        <button type="button" role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")}>
          一覧
        </button>
      </div>

      <div
        className={cx("as-studio-editor", classNames.editorPane)}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        {/* 押したボタンの真下に出す。textarea の下だと画面外に出て気づかない */}
        {issues.length > 0 && (
          <div className={cx("as-studio-issues", classNames.issues)} role="alert">
            <ul>
              {issues.map((issue, index) => (
                <li key={index}>
                  <WarningIcon className="as-studio-issue-icon" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <textarea
          className={cx("as-studio-textarea", classNames.textarea)}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
        />

        {images.length > 0 && (
          <div className={cx("as-studio-images", classNames.imagePane)}>
            {placementPending && (
              <p className="as-studio-images-note">
                以下の画像を {basePath} に配置してください。md だけでは表示されません。
              </p>
            )}
            <ul>
              {images.map((image, index) => (
                <li key={image.url}>
                  <img src={image.url} alt="" />
                  <input
                    type="text"
                    aria-label="画像の名前"
                    value={image.name}
                    onChange={(event) => renameImage(index, event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`${image.name} をダウンロード`}
                    onClick={() => downloadImage(image)}
                  >
                    <DownloadIcon className="as-studio-image-download-icon" />
                  </button>
                  {placementPending && (
                    <span className="as-studio-image-pending">未配置</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>

      <div className={cx("as-studio-preview", classNames.previewPane)}>
        {tab === "detail" ? (
          <ArticleDetail
            article={previewArticle}
            imageBasePath={imageBasePath}
            dateLabel={dateLabel}
            classNames={articleClassNames}
          />
        ) : (
          <ArticleList
            articles={listPreview}
            imageBasePath={imageBasePath}
            // 遷移はしないので div で包む。編集中の記事だけ印を付けて見分ける。
            // id で見分けると、既存記事と番号が重なったとき両方に出てしまう
            getArticleUrl={(article) => (article === draft ? DRAFT_MARK : "#")}
            renderLink={(url, children, key) =>
              url === DRAFT_MARK ? (
                // 予告はカードに重ねる。積むとカードが押し下げられ高さが揃わない
                <div key={key} className="as-studio-draft-card">
                  <span className="as-studio-id-preview">id は {draft.id} になります</span>
                  {children}
                </div>
              ) : (
                <div key={key}>{children}</div>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

/**
 * GitHub トークンの関門（spec §15）。
 *
 * 書き込めるトークンを受け取るまで編集画面を描画しません。書き込み権限は
 * GitHub 側（トークンのスコープ）で決まるため、ライブラリが認可を持つ
 * 必要がありません。
 */
function GitHubGate({ github, ...props }: Props & { github: GitHubConfig }) {
  const config = resolveGitHubConfig(github);
  const auth = useGitHubToken(config.repo, props.storageKey);
  const [draftToken, setDraftToken] = useState("");

  if (auth.status === "ready") {
    const token = auth.token as string;

    return (
      <StudioEditor
        {...props}
        publisher={{
          label: "本番コミット",
          commit: async ({ filename, markdown, title, images }) =>
            void (await commitArticle({
              token,
              config,
              filename,
              markdown,
              message: `記事を追加: ${title}`,
              images,
            })),
        }}
      />
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await auth.submit(draftToken);
    // 受け入れても断られても、入力欄に残さない
    setDraftToken("");
  };

  return (
    <div className={cx("as-studio-login", props.classNames?.login)}>
      <form className="as-studio-login-form" onSubmit={(event) => void submit(event)}>
        <p>
          {config.repo} に記事をコミットします。書き込めるトークンを貼ってください。
        </p>

        {auth.error && (
          <p className="as-studio-login-error" role="alert">
            <WarningIcon className="as-studio-issue-icon" />
            <span>{auth.error}</span>
          </p>
        )}

        <label className="as-studio-login-label">
          <span>GitHub トークン</span>
          {/* 肩越しに見られても読めないようにする（spec §15） */}
          <input
            type="password"
            value={draftToken}
            onChange={(event) => setDraftToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <button type="submit" disabled={auth.status === "verifying"}>
          {auth.status === "verifying" ? "確認しています…" : "保存して始める"}
        </button>

        <p className="as-studio-login-note">
          GitHub の Settings → Developer settings → Personal access tokens →
          Fine-grained tokens で、対象を {config.repo} だけにし、Contents を
          Read and write にして作ります。
        </p>
      </form>
    </div>
  );
}
/**
 * 記事を書く画面。
 *
 * `github` を渡すとトークンが必須になり、ダウンロードの代わりに
 * リポジトリへコミットします。渡さなければ挙動は変わりません（spec §15）。
 */
export function ArticleStudio(props: Props) {
  // コンポーネントを分けているのは、github を渡さない利用側で
  // 認証のコードが一切動かないようにするため
  return props.github ? (
    <GitHubGate {...props} github={props.github} />
  ) : (
    <StudioEditor {...props} />
  );
}
