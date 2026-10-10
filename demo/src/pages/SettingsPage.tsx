const REPO_KEY = "article-system-demo-repo";

/** localStorage に預けたリポジトリ名を読む。トークンは Studio が預かる */
export function loadRepo(): string {
  return localStorage.getItem(REPO_KEY) ?? "";
}

interface Props {
  repo: string;
  onChange: (repo: string) => void;
}

/**
 * GitHub 連携の設定（実地確認用）。
 *
 * リポジトリ名だけをここで預かります。トークンは Studio の関門が受け取るので、
 * デモのコードにも localStorage にも秘密を置きません。
 */
export default function SettingsPage({ repo, onChange }: Props) {
  return (
    <form
      className="github-setup"
      onSubmit={(event) => {
        event.preventDefault();
        localStorage.setItem(REPO_KEY, repo.trim());
        window.location.hash = "#/studio";
      }}
    >
      <h2>GitHub 連携の設定</h2>

      <p className="github-warning">
        ここにリポジトリを設定すると、執筆画面の「本番コミット」が
        <strong>本物のリポジトリに書き込みます。</strong>
        試すだけなら、捨ててよいリポジトリを作ってから使ってください。
      </p>

      <label className="github-field">
        <span>リポジトリ（owner/name）</span>
        <input
          type="text"
          value={repo}
          onChange={(event) => onChange(event.target.value)}
          placeholder="yourname/your-blog"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <button type="submit">保存して執筆画面へ</button>

      <p className="github-note">
        空のままにすると、執筆画面はダウンロードのみで動きます。
        <br />
        既定では <code>src/articles</code> に md、<code>public/article_imgs</code> に画像を置きます。
      </p>
    </form>
  );
}
