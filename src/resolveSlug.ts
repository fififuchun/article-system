/**
 * 記事の slug を決める（spec §3）。
 *
 * フロントマターの `slug` 優先、無ければファイル名から拡張子を除いたもの。
 *
 * **`createArticles` と Vite プラグインの両方がこれを呼びます。** 片方だけで
 * 決めると、ブラウザ側とビルド側で違う URL になり、OGタグが別の記事を指します。
 * どちらも静かに起きるので、決め方は1か所にしか置きません（spec §18）。
 */
export function resolveSlug(filename: string, frontmatterSlug?: string): string {
  return frontmatterSlug?.trim() || filename.replace(/\.md$/, "");
}
