import { useState } from "react";
import type {
  Article,
  ArticleDetailClassNames,
  ArticleStudioClassNames,
} from "../types";
import { cx } from "../cx";
import { buildTemplate } from "../studio/buildTemplate";

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

export function ArticleStudio({ classNames = {} }: Props) {
  // 生の md を1枚の textarea で編集する。フォーム化しないことで
  // エディタとのコピーペーストが自由に行き来できる（spec §9）
  const [raw, setRaw] = useState(buildTemplate);

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
    </div>
  );
}
