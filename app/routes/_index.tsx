import { Link } from "react-router";
import type { Route } from "./+types/_index";
import { getClustersWithArticles, getStandaloneArticles } from "~/lib/d1.server";
import { cached } from "~/lib/cache.server";
import { ClusterSection } from "~/components/cluster-section";
import { categoryBadgeClass } from "~/components/article-card";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const [clusters, standalone] = await Promise.all([
    cached(env.CACHE, "grid:clusters", () => getClustersWithArticles(env.DB)),
    cached(env.CACHE, "standalone:articles", () => getStandaloneArticles(env.DB)),
  ]);

  return { clusters, standalone, siteUrl: env.SITE_URL };
}

export function meta({}: Route.MetaArgs) {
  const description =
    "AI時代のWebマーケティングをマンガで学ぶメディア。LLMO・SEO・構造化データの実践ガイド。";
  return [
    { title: "effect.moe -- LLMO & DX Media" },
    { name: "description", content: description },
    { property: "og:title", content: "effect.moe -- LLMO & DX Media" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "effect.moe" },
    { property: "og:locale", content: "ja_JP" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "effect.moe -- LLMO & DX Media" },
    { name: "twitter:description", content: description },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { clusters, standalone } = loaderData;
  const hasContent = clusters.length > 0 || standalone.length > 0;

  return (
    <div className="lg:flex lg:gap-8">
      {/* Desktop sidebar */}
      <nav className="hidden lg:block lg:w-48 lg:shrink-0">
        <div className="sticky top-24">
          {clusters.length > 0 && (
            <>
              <h2 className="mb-3 text-xs font-medium tracking-wider text-gray-400">
                シリーズ
              </h2>
              <ul className="space-y-1">
                {clusters.map((cluster) => (
                  <li key={cluster.id}>
                    <a
                      href={`#cluster-${cluster.slug}`}
                      className="block rounded-sm px-2 py-1.5 text-sm text-gray-600 transition-colors duration-150 ease-in-out hover:bg-gray-50 hover:text-gray-900"
                    >
                      {cluster.name}
                      <span className="ml-1.5 text-xs text-gray-400">
                        {cluster.articles.length}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {standalone.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-xs font-medium tracking-wider text-gray-400">
                記事
              </h2>
              <ul className="space-y-1">
                {standalone.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/articles/${a.slug}`}
                      className="block rounded-sm px-2 py-1.5 text-sm text-gray-600 transition-colors duration-150 ease-in-out hover:bg-gray-50 hover:text-gray-900"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </nav>

      {/* Main grid */}
      <main className="min-w-0 flex-1">
        <section className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">effect.moe</h1>
          <p className="mt-1 text-sm text-gray-500">AI Webマーケティング マンガメディア</p>
        </section>

        {!hasContent ? (
          <p className="text-gray-500">No articles published yet.</p>
        ) : (
          <div className="space-y-12">
            {clusters.map((cluster) => (
              <ClusterSection key={cluster.id} cluster={cluster} />
            ))}

            {standalone.length > 0 && (
              <section>
                {clusters.length > 0 && (
                  <h2 className="mb-4 text-xs font-medium tracking-wider text-gray-400">
                    新着記事
                  </h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {standalone.map((a) => (
                    <Link
                      key={a.id}
                      to={`/articles/${a.slug}`}
                      className="group block overflow-hidden rounded-lg border border-gray-200 transition-shadow hover:shadow-md"
                    >
                      {a.cover_image_url && (
                        <img
                          src={a.cover_image_url}
                          alt={a.title}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      )}
                      <div className="p-4">
                        {a.category && (
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${categoryBadgeClass(a.category)}`}>
                            {a.category}
                          </span>
                        )}
                        <h3 className="mt-1 font-semibold text-gray-900 group-hover:text-blue-600">
                          {a.title}
                        </h3>
                        {a.description && (
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {a.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
