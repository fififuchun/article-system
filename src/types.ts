export interface Article {
  id: number;
  title: string;
  date: string;
  latestUpdate: string;
  staff: string;
  thumbnail: string;
  content: string;
}

export interface ArticleDetailClassNames {
  wrapper?: string;
  dateYear?: string;
  dateDay?: string;
  title?: string;
  latestUpdate?: string;
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
}

export interface ArticlePreviewClassNames {
  wrapper?: string;     // 2カラム全体のラッパー
  editorPane?: string;  // 左側エディタ領域
  textarea?: string;    // テキストエリア
  previewPane?: string; // 右側プレビュー領域
}
