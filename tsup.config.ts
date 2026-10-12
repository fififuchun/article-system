import { defineConfig } from "tsup";

export default defineConfig([
  // 読者のバンドルに入る側。ブラウザで動く
  {
    entry: ["src/index.ts", "src/styles.css"],
    format: ["esm"],
    // CSS エントリに型定義は要らないので index.ts だけを対象にする
    dts: { entry: "src/index.ts" },
    clean: true,
    external: ["react", "react-dom", "react-markdown", "remark-gfm", "remark-breaks"],
  },
  // ビルド時に Node で走る側（spec §18）。
  // 出力は `node:fs` ではなく `fs` になる（esbuild が接頭辞を外す。
  // platform と target を node にしても変わらない）。読み込むのは Vite の
  // 設定読み込み時の Node だけなので、解決には困らない
  {
    entry: ["src/vite/index.ts"],
    // エントリが1つだけだと出力先が dist/index.js になり、
    // ブラウザ側の出力を上書きする
    outDir: "dist/vite",
    format: ["esm"],
    dts: { entry: "src/vite/index.ts" },
    platform: "node",
    target: "node18",
    // 1つ目の出力を消さない
    clean: false,
  },
]);
