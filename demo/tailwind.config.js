/** Tailwind v3 の preflight との同居を確かめるためだけの設定（spec §10） */
export default {
  // 既定のデモには効かせない。再現ページのファイルだけを見る
  content: ["./tailwind.html", "./src/main-tailwind.tsx", "./src/TailwindRepro.tsx"],
  theme: { extend: {} },
  plugins: [],
};
