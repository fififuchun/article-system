import { useEffect, useState } from "react";
import type {
  Article,
  ArticleDetailClassNames,
  ArticleStudioClassNames,
} from "../types";
import { cx } from "../cx";
import { validateArticle, type Issue } from "../validate";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleList } from "./ArticleList";
import { WarningIcon } from "../icons/WarningIcon";
import { buildDraftArticle } from "../studio/buildDraftArticle";
import { buildFilename } from "../studio/buildFilename";
import { buildTemplate } from "../studio/buildTemplate";
import { downloadMarkdown } from "../studio/downloadFile";
import { renameImageInMarkdown } from "../studio/renameImage";
import { loadDraft, loadPublished, savePublished, saveDraft } from "../studio/draftStorage";

/** ドロップして仮登録した画像。アップロードはしない（spec §9） */
interface DroppedImage {
  /** md に書かれる名前。Studio 上で変更できる */
  name: string;
  /** ブラウザ内だけの一時URL。リロードで無効になる */
  url: string;
  file: File;
}

/** 一覧プレビューに出す件数（spec §9） */
const LIST_PREVIEW_COUNT = 6;

interface Props {
  /** 衝突検出と一覧プレビューに使う既存記事 */
  articles?: Article[];
  /** localStorage の保存先を分ける（spec §9） */
  storageKey?: string;
  imageBasePath?: string;
  dateLabel?: string;
  classNames?: ArticleStudioClassNames;
  articleClassNames?: ArticleDetailClassNames;
}

export function ArticleStudio({
  articles,
  storageKey,
  imageBasePath,
  dateLabel,
  classNames = {},
  articleClassNames,
}: Props) {
  // 生の md を1枚の textarea で編集する。フォーム化しないことで
  // エディタとのコピーペーストが自由に行き来できる（spec §9）
  // 復帰する下書きがあればテンプレートを出さない。出すと保存内容を上書きしてしまう。
  // ?? を使うのは空文字を「下書きなし」と扱わないため（spec §9）
  const [raw, setRaw] = useState(() => loadDraft(storageKey) ?? buildTemplate());
  const [tab, setTab] = useState<"detail" | "list">("detail");
  const [issues, setIssues] = useState<Issue[]>([]);
  // テンプレートに戻った直後だけ true。編集すると降りる（リロードでも残らない）
  const [justPublished, setJustPublished] = useState(false);
  const [images, setImages] = useState<DroppedImage[]>([]);

  // 入力のたびに保存する。ボタンを押す必要がないため保存忘れが原理的に起きない（spec §9）
  useEffect(() => {
    saveDraft(storageKey, raw);
  }, [storageKey, raw]);

  // ArticleDetail をそのまま使うことで、プレビューと本番の一致が
  // 構造的に保証される（spec §9）
  const editRaw = (value: string) => {
    setRaw(value);
    // 書きかけを上書きする事故を防ぐため、編集を始めたら救済ボタンを引っ込める
    setJustPublished(false);
  };

  const draft = buildDraftArticle(raw, articles);

  // 仮登録した画像は md にファイル名で書かれる。プレビューだけ blob URL に差し替える
  const toPreviewSrc = (value: string) =>
    images.reduce((text, image) => text.split(image.name).join(image.url), value);

  const previewArticle = {
    ...draft,
    thumbnail: toPreviewSrc(draft.thumbnail),
    content: toPreviewSrc(draft.content),
  };

  // スマホから選ぶと IMG_1234.jpg になるため、その場で直せることが必須（spec §9）
  const renameImage = (index: number, nextName: string) => {
    const target = images[index];
    setImages(images.map((image, i) => (i === index ? { ...image, name: nextName } : image)));
    editRaw(renameImageInMarkdown(raw, target.name, nextName));
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
    const markdown = added.map((image) => `![](${image.name})`).join("\n\n");
    editRaw(`${raw}\n\n${markdown}\n`);
  };

  // 既存記事に混ぜて日付の新しい順の直近6件。隣の記事と並べることで
  // タイトルの折り返しやサムネイルの雰囲気を比較できる（spec §9）
  const listPreview = [...(articles ?? []), draft]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, LIST_PREVIEW_COUNT);

  // 下書きは検証せずそのまま出す。押した後も編集を続けられる（spec §9）
  const downloadDraft = () => {
    downloadMarkdown(buildFilename(draft.date, draft.title, { draft: true }), raw);
  };

  // 本番は検証必須。エラーがゼロでないと出せない（spec §9）
  const downloadForPublish = () => {
    const filename = buildFilename(draft.date, draft.title);
    const found = validateArticle(raw, { articles, filename });
    setIssues(found);

    if (found.length > 0) return;

    downloadMarkdown(filename, raw);
    // 白紙に戻すが、出した直後に typo に気づいても取り返せるよう退避しておく（spec §9）
    savePublished(storageKey, raw);
    setRaw(buildTemplate());
    setJustPublished(true);
  };

  const restorePublished = () => {
    const published = loadPublished(storageKey);
    if (published !== null) setRaw(published);
    setJustPublished(false);
  };

  return (
    <div className={cx("as-studio", classNames.wrapper)}>
      <div className={cx("as-studio-editor", classNames.editorPane)}>
        <textarea
          className={cx("as-studio-textarea", classNames.textarea)}
          value={raw}
          onChange={(event) => editRaw(event.target.value)}
          spellCheck={false}
        />

        {images.length > 0 && (
          <div className={cx("as-studio-images", classNames.imagePane)}>
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
                </li>
              ))}
            </ul>
          </div>
        )}

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

        <div className={cx("as-studio-actions", classNames.actions)}>
          <button type="button" onClick={downloadForPublish}>
            本番ダウンロード
          </button>
          <button type="button" onClick={downloadDraft}>
            下書きダウンロード
          </button>
          {justPublished && (
            <button type="button" onClick={restorePublished}>
              直前の記事に戻す
            </button>
          )}
        </div>
      </div>

      <div className={cx("as-studio-preview", classNames.previewPane)}>
        <div className={cx("as-studio-tabs", classNames.tabs)} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "detail"} onClick={() => setTab("detail")}>
            詳細
          </button>
          <button type="button" role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")}>
            一覧
          </button>
        </div>

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
            getArticleUrl={() => "#"}
            // プレビューなので遷移させない。リンクにせず div で包む
            renderLink={(_url, children, key) => <div key={key}>{children}</div>}
          />
        )}
      </div>
    </div>
  );
}
