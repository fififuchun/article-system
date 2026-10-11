import { useEffect, useRef, useState } from "react";
import type {
  Article,
  ArticleDetailClassNames,
  ArticleStudioClassNames,
  GitHubConfig,
} from "../types";
import { cx } from "../cx";
import { ArticleStudio } from "./ArticleStudio";
import { CloseIcon } from "../icons/CloseIcon";
import { clearHash, matchesHash, subscribeToHash } from "../studio/hashRoute";

/** 既定の入り口。読者が普通に見ているだけでは辿り着かない（spec §9 設置方法） */
const DEFAULT_HASH_PATH = "#/studio";

interface Props {
  articles: Article[];
  storageKey?: string;
  imageBasePath?: string;
  dateLabel?: string;
  classNames?: ArticleStudioClassNames;
  articleClassNames?: ArticleDetailClassNames;
  github?: GitHubConfig;
  /** 入り口のハッシュ。既定 `#/studio` */
  hashPath?: string;
}

/**
 * 執筆画面をハッシュで開く（spec §9 設置方法）。
 *
 * `App.tsx` に1行置けば `#/studio` で全画面の Studio が開きます。利用側が
 * ページを作って `<Route>` を定義する必要がありません。
 *
 * **一致しないときは何も描画しません。** だから置き場所はどこでも構いません。
 *
 * `<dialog>` を `showModal()` で開くのは、`z-index` の数字で殴らずに
 * トップレイヤーで最前面を取るためです。Esc で閉じられ、背後が `inert` に
 * なるのも付いてきます。
 */
export function ArticleStudioRoute({ hashPath = DEFAULT_HASH_PATH, ...props }: Props) {
  const [open, setOpen] = useState(() => matchesHash(hashPath));
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => subscribeToHash(() => setOpen(matchesHash(hashPath))), [hashPath]);

  useEffect(() => {
    // 開いたままもう一度呼ぶと例外になるブラウザがある
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      className={cx("as-studio-dialog", props.classNames?.dialog)}
      // Esc・×・close() のどれで閉じてもここに来る
      onClose={() => {
        clearHash();
        setOpen(false);
      }}
    >
      {/* 操作帯に重ねない。重ねると帯の高さが変わるたびにボタンが
          はみ出したり欠けたりする（spec §9 設置方法） */}
      <div className="as-studio-dialog-bar">
        <button
          type="button"
          className="as-studio-dialog-close"
          aria-label="執筆画面を閉じる"
          onClick={() => dialog.current?.close()}
        >
          <CloseIcon />
        </button>
      </div>

      <ArticleStudio {...props} />
    </dialog>
  );
}
