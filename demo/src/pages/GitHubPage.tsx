import { useState } from "react";
import { ArticleStudio } from "@fififuchun/article-system";
import { articles } from "../lib/articles";

const REPO_KEY = "article-system-demo-repo";

/**
 * GitHub 連携の実地確認ページ。
 *
 * 自動テストは fetch をスタブするため、本物の GitHub と通信できることを
 * 証明しません（spec §15）。ここで目で確かめます。
 *
 * リポジトリ名だけをこのページが預かり、トークンは Studio が受け取ります。
 * デモのコードにも localStorage にも、トークンは置きません。
 */
export default function GitHubPage() {
  const [repo, setRepo] = useState(() => localStorage.getItem(REPO_KEY) ?? "");
  const [confirmed, setConfirmed] = useState(() => Boolean(localStorage.getItem(REPO_KEY)));

  if (confirmed && repo) {
    return (
      <>
        <div className="github-banner">
          <strong>{repo}</strong> に本当にコミットします。
          <button
            type="button"
            className="back-button github-banner-button"
            onClick={() => {
              localStorage.removeItem(REPO_KEY);
              setConfirmed(false);
            }}
          >
            リポジトリを変える
          </button>
        </div>

        <ArticleStudio
          articles={articles}
          storageKey="article-system-demo-github"
          imageBasePath="https://placehold.co/800x400/e8e8e8/999999?text="
          dateLabel="最終更新日時"
          github={{ repo }}
        />
      </>
    );
  }

  return (
    <form
      className="github-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (!repo.trim()) return;
        localStorage.setItem(REPO_KEY, repo.trim());
        setConfirmed(true);
      }}
    >
      <h2>GitHub 連携を試す</h2>

      <p className="github-warning">
        このページの「本番コミット」は<strong>本物のリポジトリに書き込みます。</strong>
        試すだけなら、捨ててよいリポジトリを作ってから使ってください。
      </p>

      <label className="github-field">
        <span>リポジトリ（owner/name）</span>
        <input
          type="text"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          placeholder="yourname/your-blog"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <button type="submit">次へ</button>

      <p className="github-note">
        次の画面でトークンを聞かれます。作り方もそこに出ます。
        <br />
        既定では <code>src/articles</code> に md、<code>public/article_imgs</code> に画像を置きます。
      </p>
    </form>
  );
}
