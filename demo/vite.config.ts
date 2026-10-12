import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { articleOgTags } from "@fififuchun/article-system/vite";

export default defineConfig({
  plugins: [
    react(),
    // 共有したときのサムネイル（spec §18）。ビルドの最後に
    // dist/article/{slug}/index.html を書き出す。
    // siteUrl はこのデモでは vite preview の既定のアドレスにしている
    articleOgTags({
      siteUrl: "http://localhost:4173",
      path: "/article/:slug",
      imageBasePath: "https://placehold.co/800x400/e8e8e8/999999?text=",
      siteName: "article-system demo",
    }),
  ],
});
