import { Link } from "react-router";
import type { Route } from "./+types/_index";
import { getArticles } from "~/lib/notion.server";
import { cached } from "~/lib/cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const articles = await cached(env.CACHE, "articles:list", () =>
    getArticles(env),
  );
  return { articles: articles.slice(0, 5) };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "effect.moe -- LLMO & DX Media" },
    {
      name: "description",
      content:
        "AI時代のWebマーケティングを再定義する LLMO & DX メディア",
    },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { articles } = loaderData;

  return (
    <div>
      <section className="mb-12">
        <h1 className="mb-4 text-3xl font-bold">effect.moe</h1>
        <p className="text-lg text-gray-600">
          LLMO (Large Language Model Optimization) & DX
          に特化したメディアサイト
        </p>
      </section>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Articles</h2>
          <Link
            to="/articles"
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="text-gray-500">No articles published yet.</p>
        ) : (
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
                  <h3 className="mt-1 text-xl font-semibold group-hover:text-blue-600">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="mt-2 text-gray-600">
                      {article.description}
                    </p>
                  )}
                  {article.publishedAt && (
                    <time className="mt-2 block text-sm text-gray-400">
                      {new Date(
                        article.publishedAt,
                      ).toLocaleDateString("ja-JP")}
                    </time>
                  )}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
