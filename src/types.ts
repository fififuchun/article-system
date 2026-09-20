export interface Article {
  id: number;
  /** 拡張子付きファイル名。衝突検出と既存記事の編集に使う。URL には使わない（spec §3） */
  filename: string;
  title: string;
  date: string;
  latestUpdate: string;
  staff: string;
  thumbnail: string;
  content: string;
}

export interface ArticleDetailClassNames {
  wrapper?: string;
  headerWrapper?: string;
  dateWrapper?: string;
  dateYear?: string;
  dateDay?: string;
  title?: string;
  latestUpdate?: string;
  dateIcon?: string;
  thumbnail?: string;
  heading?: string;
  subheading?: string;
  subsubheading?: string;
  paragraph?: string;
  image?: string;
  footer?: string;
}

export interface ArticleListClassNames {
  grid?: string;
  card?: string;
  cardImage?: string;
  cardTitle?: string;
  cardDate?: string;
  cardDateIcon?: string;
}


/** ArticleStudio のクラス名（spec §9 のレイアウト図に対応） */
export interface ArticleStudioClassNames {
  wrapper?: string;     // 2ペイン全体のラッパー
  editorPane?: string;  // 左（スマホでは上）の編集領域
  textarea?: string;    // 生の md を編集する textarea
  previewPane?: string; // 右（スマホでは下）のプレビュー領域
  tabs?: string;        // 詳細 / 一覧の切り替え
  issues?: string;      // 検証で見つかった Issue の一覧
  imagePane?: string;   // 仮登録した画像の一覧（名前とダウンロード）
  actions?: string;     // 本番DL / 下書きDL のボタン列
  login?: string;       // GitHub ログインを促す画面（spec §15）
}

/**
 * GitHub 連携の設定（spec §15）。
 *
 * 渡すと ArticleStudio がダウンロードではなくリポジトリへコミットします。
 * 渡さなければ挙動は変わりません。
 */
export interface GitHubConfig {
  /** GitHub App のクライアントID。App は利用側が作る */
  clientId: string;
  /** "owner/name" */
  repo: string;
  /** 既定 "main" */
  branch?: string;
  /** md の置き場所。既定 "src/articles" */
  mdDir?: string;
  /** 画像の置き場所。`imageBasePath`（表示用URL）とは別物。既定 "public/article_imgs" */
  imageDir?: string;
  /** 既定は現在のページURL。GitHub App に登録した Callback URL と完全一致させる */
  redirectUri?: string;
}
