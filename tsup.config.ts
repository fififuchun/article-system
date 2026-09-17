import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/styles.css"],
  format: ["esm"],
  // CSS エントリに型定義は要らないので index.ts だけを対象にする
  dts: { entry: "src/index.ts" },
  clean: true,
  external: ["react", "react-dom", "react-markdown", "remark-gfm", "remark-breaks"],
});
