# docs — プロジェクト解析ドキュメント

`@fififuchun/article-system` のコードベースを読んで分かったことをまとめたものです。
利用手順そのものはリポジトリ直下の [README.md](../README.md) を参照してください。ここは「中がどうなっているか」「使うときに何に気をつけるか」を扱います。

| ドキュメント | 内容 |
| --- | --- |
| [overview.md](./overview.md) | プロジェクトの正体・技術スタック・リポジトリ構成 |
| [architecture.md](./architecture.md) | データフローと各モジュールの責務、設計思想 |
| [api.md](./api.md) | 公開API（型・関数・コンポーネント）のリファレンス |
| [findings.md](./findings.md) | 解析で判明した注意点・仕様上の制約・改善候補 |
| [design-decisions.md](./design-decisions.md) | v0.2 に向けた設計方針の決定事項（grill セッションの結果） |

作成日: 2026-08-16 / 解析対象コミット: `ce86c36`
