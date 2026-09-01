import { useEffect, useState } from "react";
import type {
  Article,
  ArticleDetailClassNames,
  ArticleStudioClassNames,
} from "../types";
import { cx } from "../cx";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleList } from "./ArticleList";
import { buildDraftArticle } from "../studio/buildDraftArticle";
import { buildTemplate } from "../studio/buildTemplate";
import { loadDraft, saveDraft } from "../studio/draftStorage";

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

  // 入力のたびに保存する。ボタンを押す必要がないため保存忘れが原理的に起きない（spec §9）
  useEffect(() => {
    saveDraft(storageKey, raw);
  }, [storageKey, raw]);

  // ArticleDetail をそのまま使うことで、プレビューと本番の一致が
  // 構造的に保証される（spec §9）
  const draft = buildDraftArticle(raw, articles);

  return (
    <div className={cx("as-studio", classNames.wrapper)}>
      <div className={cx("as-studio-editor", classNames.editorPane)}>
        <textarea
          className={cx("as-studio-textarea", classNames.textarea)}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
        />
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
            article={draft}
            imageBasePath={imageBasePath}
            dateLabel={dateLabel}
            classNames={articleClassNames}
          />
        ) : (
          <ArticleList
            articles={[draft]}
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
