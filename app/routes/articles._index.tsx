import { Link } from "react-router";
import type { Route } from "./+types/articles._index";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env.CACHE, "articles:list", () =>
    getArticles(env),
  );
  return { articles };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Articles -- effect.moe" },
    {
      name: "description",
      content: "LLMO & DX に関する記事一覧",
    },
  ];
}

export default function ArticleList({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  if (articles.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold">Articles</h1>
        <p className="text-gray-500">No articles published yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">Articles</h1>
      <div className="space-y-6">
        {articles.map((article) => (
          <article
            key={article.id}
            className="border-b border-gray-100 pb-6"
          >
            <Link
              to={`/articles/${article.slug}`}
              className="group block"
            >
              {article.category && (
                <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  {article.category}
                </span>
              )}
              <h2 className="mt-1 text-xl font-semibold group-hover:text-blue-600">
                {article.title}
              </h2>
              {article.description && (
                <p className="mt-2 text-gray-600">
                  {article.description}
                </p>
              )}
              {article.publishedAt && (
                <time className="mt-2 block text-sm text-gray-400">
                  {new Date(article.publishedAt).toLocaleDateString(
                    "ja-JP",
                  )}
                </time>
              )}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
