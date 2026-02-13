import { Link } from "react-router";
import type { Route } from "./+types/_index";
import { getClustersWithArticles } from "~/lib/d1.server";
import { cached } from "~/lib/cache.server";
import { ClusterSection } from "~/components/cluster-section";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const clusters = await cached(env.CACHE, "grid:clusters", () =>
    getClustersWithArticles(env.DB),
  );

  return { clusters };
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
  const { clusters } = loaderData;

  return (
    <div className="lg:flex lg:gap-8">
      {/* Desktop sidebar */}
      <nav className="hidden lg:block lg:w-48 lg:shrink-0">
        <div className="sticky top-24">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Series
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
        </div>
      </nav>

      {/* Main grid */}
      <main className="min-w-0 flex-1">
        <section className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">effect.moe</h1>
          <p className="mt-1 text-sm text-gray-500">
            LLMO & DX Manga Media
          </p>
        </section>

        {clusters.length === 0 ? (
          <p className="text-gray-500">No series published yet.</p>
        ) : (
          <div className="space-y-12">
            {clusters.map((cluster) => (
              <ClusterSection key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}

        {/* Fallback link to legacy articles list */}
        <div className="mt-16 border-t border-gray-100 pt-6">
          <Link
            to="/articles"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            View all articles (legacy)
          </Link>
        </div>
      </main>
    </div>
  );
}
