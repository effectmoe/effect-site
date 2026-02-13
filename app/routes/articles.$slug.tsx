import { data, Link } from "react-router";
import type { Route } from "./+types/articles.$slug";
import {
  getArticleWithPanels,
  getClusterArticles,
} from "~/lib/d1.server";
import { cached } from "~/lib/cache.server";
import { JsonLd } from "~/components/json-ld";
import {
  generateComicIssueJsonLd,
  generateComicSeriesJsonLd,
} from "~/lib/jsonld";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;

  const result = await cached(env.CACHE, `article:${slug}`, () =>
    getArticleWithPanels(env.DB, slug),
  );

  if (!result) {
    throw data(null, { status: 404 });
  }

  const { article, panels } = result;

  // Fetch sibling articles for timeline if article belongs to a cluster
  let clusterArticles: Awaited<ReturnType<typeof getClusterArticles>> = [];
  if (article.cluster_id) {
    clusterArticles = await cached(
      env.CACHE,
      `cluster-articles:${article.cluster_id}`,
      () => getClusterArticles(env.DB, article.cluster_id!),
    );
  }

  return { article, panels, clusterArticles, siteUrl: env.SITE_URL };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found -- effect.moe" }];
  const { article } = loaderData;
  return [
    { title: `${article.title} -- effect.moe` },
    { name: "description", content: article.description },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.description },
    { property: "og:type", content: "article" },
    ...(article.cover_image_url
      ? [{ property: "og:image", content: article.cover_image_url }]
      : []),
  ];
}

export default function ArticleTimeline({
  loaderData,
}: Route.ComponentProps) {
  const { article, panels, clusterArticles, siteUrl } = loaderData;

  const jsonLdArticle = {
    title: article.title,
    slug: article.slug,
    description: article.description ?? "",
    tags: article.tags,
    publishedAt: article.published_at ?? "",
    coverImage: article.cover_image_url ?? "",
    panelCount: panels.length,
    clusterName: article.cluster_name,
    clusterSlug: article.cluster_slug,
    orderInCluster: article.order_in_cluster,
    transcripts: panels
      .map((p) => p.transcript)
      .filter((t): t is string => t !== null),
  };

  const seriesJsonLd =
    article.cluster_id && clusterArticles.length > 1
      ? generateComicSeriesJsonLd(
          {
            name: article.cluster_name ?? "Series",
            slug: article.cluster_slug ?? article.cluster_id,
            description: null,
            issues: clusterArticles.map((ca) => ({
              title: ca.title,
              slug: ca.slug,
              orderInCluster: ca.order_in_cluster,
              coverImage: ca.cover_image_url,
            })),
          },
          siteUrl,
        )
      : null;

  return (
    <>
      <JsonLd data={generateComicIssueJsonLd(jsonLdArticle, siteUrl)} />
      {seriesJsonLd && <JsonLd data={seriesJsonLd} />}

      <div className="mx-auto max-w-2xl">
        {/* Cluster navigation */}
        {article.cluster_id && clusterArticles.length > 1 && (
          <nav className="mb-6 border-b border-gray-100 pb-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-gray-400">
              {article.cluster_name ?? "Series"}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {clusterArticles.map((ca) => (
                <Link
                  key={ca.id}
                  to={`/articles/${ca.slug}`}
                  prefetch="intent"
                  className={`shrink-0 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-in-out ${
                    ca.slug === article.slug
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  #{ca.order_in_cluster}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Article header */}
        <header className="mb-8">
          {article.category && (
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {article.category}
            </span>
          )}
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {article.title}
          </h1>
          {article.description && (
            <p className="mt-2 text-sm text-gray-500">
              {article.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
            {article.published_at && (
              <time>
                {new Date(article.published_at).toLocaleDateString("ja-JP")}
              </time>
            )}
            {panels.length > 0 && <span>{panels.length} panels</span>}
            {article.tags.length > 0 && (
              <div className="flex gap-1">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[11px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Manga panels preview / Enter reader */}
        {panels.length > 0 ? (
          <div>
            {/* Cover panel as entry point */}
            <Link
              to={`/articles/${article.slug}/p1`}
              prefetch="intent"
              className="group relative block overflow-hidden rounded-sm border border-gray-200"
            >
              <img
                src={panels[0].image_url}
                alt={panels[0].transcript ?? article.title}
                className="w-full transition-transform duration-200 ease-in-out group-hover:scale-[1.01]"
                width={panels[0].image_width ?? undefined}
                height={panels[0].image_height ?? undefined}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/0 transition-colors duration-200 ease-in-out group-hover:bg-gray-900/10">
                <span className="rounded-sm bg-white/90 px-4 py-2 text-sm font-medium text-gray-900 opacity-0 shadow-sm transition-opacity duration-200 ease-in-out group-hover:opacity-100">
                  Read manga
                </span>
              </div>
            </Link>

            {/* Audio teaser */}
            {article.audio_url && (
              <div className="mt-4 flex items-center gap-3 rounded-sm border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-xs font-medium text-gray-500">
                  Audio narration available
                </span>
                <Link
                  to={`/articles/${article.slug}/p1`}
                  className="ml-auto text-xs text-gray-900 underline underline-offset-2"
                >
                  Listen while reading
                </Link>
              </div>
            )}

            {/* Panel grid preview */}
            {panels.length > 1 && (
              <div className="mt-6">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Panels
                </h2>
                <div className="grid grid-cols-4 gap-1.5 md:grid-cols-6">
                  {panels.slice(0, 12).map((panel, i) => (
                    <Link
                      key={panel.id}
                      to={`/articles/${article.slug}/p${panel.panel_order}`}
                      prefetch="intent"
                      className="group relative aspect-[3/4] overflow-hidden rounded-sm border border-gray-100"
                    >
                      <img
                        src={panel.image_url}
                        alt={panel.transcript ?? `Panel ${panel.panel_order}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-gray-900/70 px-1 py-0.5 text-[9px] tabular-nums text-white">
                        {panel.panel_order}
                      </span>
                    </Link>
                  ))}
                  {panels.length > 12 && (
                    <Link
                      to={`/articles/${article.slug}/p13`}
                      className="flex aspect-[3/4] items-center justify-center rounded-sm border border-gray-200 bg-gray-50 text-xs text-gray-400"
                    >
                      +{panels.length - 12}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback: text-only article with global LLM text */
          <div className="prose prose-sm prose-gray max-w-none">
            {article.global_llm_text ? (
              <div
                dangerouslySetInnerHTML={{ __html: article.global_llm_text }}
              />
            ) : (
              <p className="text-gray-400">Content coming soon.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
