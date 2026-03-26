import { useEffect, useRef } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/articles.$slug";
import {
  getArticleWithPanels,
  getClusterArticles,
  getGlossaryTermList,
  getRelatedKnowledge,
  type KnowledgeArticleSummary,
} from "~/lib/d1.server";
import { addGlossaryLinks } from "~/lib/glossary-linker.server";
import { panelImageUrl } from "~/lib/panel-image";
import { cached } from "~/lib/cache.server";
import { JsonLd } from "~/components/json-ld";
import {
  generateComicIssueJsonLd,
  generateComicSeriesJsonLd,
  generateFaqPageJsonLd,
  type JsonLdFaq,
} from "~/lib/jsonld";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { categoryBadgeClass } from "~/components/article-card";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TocItem {
  id: string;
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

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

  let clusterArticles: Awaited<ReturnType<typeof getClusterArticles>> = [];
  if (article.cluster_id) {
    clusterArticles = await cached(
      env.CACHE,
      `cluster-articles:${article.cluster_id}`,
      () => getClusterArticles(env.DB, article.cluster_id!),
    );
  }

  const allPanelFaqs = panels.flatMap((p) => p.faqs);
  const articleFaqs: JsonLdFaq[] = [];
  if (allPanelFaqs.length > 0) {
    const seen = new Set<string>();
    for (const panel of panels) {
      for (const faq of panel.faqs) {
        if (articleFaqs.length >= 6) break;
        if (!seen.has(faq.question)) {
          seen.add(faq.question);
          articleFaqs.push({ question: faq.question, answer: faq.answer });
        }
      }
      if (articleFaqs.length >= 6) break;
    }
  }

  // Auto-link glossary terms in article body
  if (article.global_llm_text) {
    const glossaryTerms = await cached(
      env.CACHE,
      "glossary:terms",
      () => getGlossaryTermList(env.DB),
    );
    article.global_llm_text = addGlossaryLinks(
      article.global_llm_text,
      glossaryTerms,
    );
  }

  // Reading time: Japanese ~500 chars/min + 30s per manga panel
  const textLen =
    article.global_llm_text?.replace(/<[^>]*>/g, "").length ?? 0;
  const readingMin = Math.max(
    1,
    Math.ceil(textLen / 500 + panels.length * 0.5),
  );

  // Extract TOC from H2 tags in global_llm_text
  const toc: TocItem[] = [];
  if (article.global_llm_text) {
    const h2Re = /<h2[^>]+id="([^"]+)"[^>]*>([^<]+)<\/h2>/g;
    let m;
    while ((m = h2Re.exec(article.global_llm_text)) !== null) {
      toc.push({ id: m[1], text: m[2] });
    }
  }

  // Related knowledge base articles (triple-link)
  const relatedKnowledge = await cached(
    env.CACHE,
    `related-knowledge:${slug}`,
    () => getRelatedKnowledge(env.DB, slug),
  );

  return {
    article,
    panels,
    clusterArticles,
    articleFaqs,
    relatedKnowledge,
    readingMin,
    toc,
    siteUrl: env.SITE_URL,
  };
}

/* ------------------------------------------------------------------ */
/*  Meta                                                               */
/* ------------------------------------------------------------------ */

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found -- effect.moe" }];
  const { article, siteUrl } = loaderData;
  const pageUrl = `${siteUrl}/articles/${article.slug}`;

  return [
    { title: `${article.title} -- effect.moe` },
    { name: "description", content: article.description },
    { tagName: "link" as const, rel: "canonical", href: pageUrl },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: pageUrl },
    { property: "og:site_name", content: "effect.moe" },
    { property: "og:locale", content: "ja_JP" },
    ...(article.cover_image_url
      ? [{ property: "og:image", content: article.cover_image_url }]
      : []),
    {
      name: "twitter:card",
      content: article.cover_image_url ? "summary_large_image" : "summary",
    },
    { name: "twitter:title", content: article.title },
    { name: "twitter:description", content: article.description },
    ...(article.cover_image_url
      ? [{ name: "twitter:image", content: article.cover_image_url }]
      : []),
    ...(article.published_at
      ? [
          {
            property: "article:published_time",
            content: article.published_at,
          },
        ]
      : []),
    ...(article.category
      ? [{ property: "article:section", content: article.category }]
      : []),
    ...article.tags.map((tag: string) => ({
      property: "article:tag",
      content: tag,
    })),
  ];
}

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconPages({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden="true"
    >
      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06V4.94a.75.75 0 00-.546-.722A9.006 9.006 0 0015 3.86a9.006 9.006 0 00-4.25 1.065v11.895zM9.25 4.925A9.006 9.006 0 005 3.86a9.006 9.006 0 00-2.454.358A.75.75 0 002 4.94v10.12a.75.75 0 00.954.722A7.462 7.462 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.925z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-3.5 w-3.5"}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconHeadphones({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? "h-4 w-4"}
      aria-hidden="true"
    >
      <path d="M10 3.75a6.25 6.25 0 00-6.25 6.25v.893a3.001 3.001 0 011.5 5.19V16A3.75 3.75 0 009 12.25h.25v-2H9A5.75 5.75 0 003.25 16v.088a3.001 3.001 0 01-1.5-5.19V10a8.25 8.25 0 0116.5 0v.898a3.001 3.001 0 01-1.5 5.19V16A5.75 5.75 0 0011 10.25h-.25v2H11A3.75 3.75 0 0114.75 16v.088a3.001 3.001 0 011.5-5.19V10A6.25 6.25 0 0010 3.75z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Prose class string (editorial typography)                          */
/* ------------------------------------------------------------------ */

const PROSE_CLASSES = "prose max-w-none article-body";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ArticlePage({
  loaderData,
}: Route.ComponentProps) {
  const {
    article,
    panels,
    clusterArticles,
    articleFaqs,
    relatedKnowledge,
    readingMin,
    toc,
    siteUrl,
  } = loaderData;
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      articleRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [article.slug]);

  /* ---- JSON-LD ---- */

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

  const faqJsonLd =
    articleFaqs.length > 0
      ? generateFaqPageJsonLd(
          articleFaqs,
          `${siteUrl}/articles/${article.slug}`,
        )
      : null;

  return (
    <>
      <JsonLd data={generateComicIssueJsonLd(jsonLdArticle, siteUrl)} />
      {seriesJsonLd && <JsonLd data={seriesJsonLd} />}
      {faqJsonLd && <JsonLd data={faqJsonLd} />}

      <article ref={articleRef} className="mx-auto w-full max-w-2xl">
        {/* ── Breadcrumb ── */}
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-400">
            <li>
              <Link to="/" className="transition-colors hover:text-gray-600">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <IconChevron className="h-3 w-3 text-gray-300" />
            </li>
            <li>
              <Link
                to="/articles"
                className="transition-colors hover:text-gray-600"
              >
                Articles
              </Link>
            </li>
            {article.cluster_name && (
              <>
                <li aria-hidden="true">
                  <IconChevron className="h-3 w-3 text-gray-300" />
                </li>
                <li>
                  <span>{article.cluster_name}</span>
                </li>
              </>
            )}
            <li aria-hidden="true">
              <IconChevron className="h-3 w-3 text-gray-300" />
            </li>
            <li>
              <span className="text-gray-600" aria-current="page">
                {article.title}
              </span>
            </li>
          </ol>
        </nav>

        {/* ── Cluster navigation ── */}
        {article.cluster_id && clusterArticles.length > 1 && (
          <nav
            aria-label="Series navigation"
            className="mb-8 border-b border-gray-100 pb-5"
          >
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-gray-400">
              {article.cluster_name ?? "Series"}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {clusterArticles.map((ca) => (
                <Link
                  key={ca.id}
                  to={`/articles/${ca.slug}`}
                  prefetch="intent"
                  aria-current={
                    ca.slug === article.slug ? "page" : undefined
                  }
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                    ca.slug === article.slug
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                  }`}
                >
                  #{ca.order_in_cluster}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* ── Header ── */}
        <header className="mb-4">
          {article.category && (
            <span className={`inline-block rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${categoryBadgeClass(article.category)}`}>
              {article.category}
            </span>
          )}

          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-gray-900 md:text-3xl">
            {article.title}
          </h1>

          {article.description && (
            <p className="mt-2 text-base leading-relaxed text-gray-500 md:text-lg">
              {article.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-gray-100 pt-2 text-xs text-gray-400">
            <Link
              to="/about"
              className="text-gray-500 transition-colors hover:text-gray-900"
            >
              Tony Chu Studio
            </Link>
            {article.published_at && (
              <time
                dateTime={article.published_at}
                className="flex items-center gap-1.5"
              >
                <IconCalendar />
                {new Date(article.published_at).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
            {panels.length > 0 && (
              <span className="flex items-center gap-1.5">
                <IconPages />
                {panels.length}ページ
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <IconClock />
              {readingMin}分で読める
            </span>
          </div>

          {article.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* ── Manga preview ── */}
        {panels.length > 0 && (
          <section aria-label="Manga preview">
            {/* Cover */}
            <figure>
              <Link
                to={`/articles/${article.slug}/p/1`}
                prefetch="intent"
                className="group relative block overflow-hidden rounded-xl border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <img
                  src={panelImageUrl(panels[0])}
                  alt={panels[0].transcript ?? article.title}
                  className="w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                  width={panels[0].image_width ?? undefined}
                  height={panels[0].image_height ?? undefined}
                />
                <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent transition-colors duration-200 group-hover:from-black/60">
                  <span className="mb-5 flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-105">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" />
                    </svg>
                    タップしてマンガを読む
                  </span>
                </div>
              </Link>
            </figure>

            {/* Audio teaser — card style */}
            {article.audio_url && (
              <aside aria-label="Audio narration" className="mt-5">
                <Link
                  to={`/articles/${article.slug}/p/1`}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <IconHeadphones className="h-5 w-5 text-gray-600" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      音声ナレーション付き
                    </span>
                    <span className="block text-xs text-gray-400">
                      マンガを聴きながら読めます
                    </span>
                  </span>
                  <span className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700">
                    聴く
                  </span>
                </Link>
              </aside>
            )}

            {/* Panel thumbnails */}
            {panels.length > 1 && (
              <section aria-label="Page thumbnails" className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">
                    ページ一覧
                  </h2>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <IconChevron className="h-3 w-3" />
                    スワイプ
                  </span>
                </div>
                <Swiper
                  modules={[FreeMode]}
                  freeMode={{ enabled: true, momentumRatio: 0.8 }}
                  slidesPerView="auto"
                  spaceBetween={12}
                  className="!overflow-visible"
                >
                  {panels.map((panel, index) => (
                    <SwiperSlide
                      key={panel.id}
                      className="!w-44 sm:!w-48 md:!w-52"
                    >
                      <Link
                        to={`/articles/${article.slug}/p/${index + 1}`}
                        prefetch="intent"
                        className="group relative block overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow-md"
                      >
                        <div className="aspect-[3/4]">
                          <img
                            src={panelImageUrl(panel)}
                            alt={
                              panel.transcript ??
                              `${article.title} - ${index + 1}ページ`
                            }
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                          />
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-gray-900/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
                          {index + 1}
                        </span>
                      </Link>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </section>
            )}
          </section>
        )}

        {/* ── Table of Contents ── */}
        {toc.length > 2 && (
          <details
            className="group mt-12 rounded-xl border border-gray-200 bg-gray-50/60"
            open
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold text-gray-900">
                目次
              </span>
              <IconChevronDown className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <nav className="border-t border-gray-200 px-6 pb-5 pt-4">
              <ol className="space-y-2.5">
                {toc.map((item, i) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="flex items-baseline gap-3 text-sm text-gray-500 transition-colors hover:text-gray-900"
                    >
                      <span className="shrink-0 text-xs tabular-nums text-gray-300">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>
        )}

        {/* ── Infographic ── */}
        {article.infographic_url && (
          <section className="mt-8 mb-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <div
                className="overflow-auto"
                style={{ touchAction: "pinch-zoom pan-x pan-y" }}
              >
                <img
                  src={article.infographic_url}
                  alt={`${article.title} インフォグラフィック`}
                  className="w-full"
                  loading="lazy"
                />
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">
              ピンチで拡大できます
            </p>
          </section>
        )}

        {/* ── Article body ── */}
        {article.global_llm_text && (
          <section
            aria-labelledby="article-body-heading"
            className="mt-12 border-t border-gray-200 pt-10"
          >
            <h2 id="article-body-heading" className="sr-only">
              解説記事
            </h2>
            <div
              className={PROSE_CLASSES}
              dangerouslySetInnerHTML={{ __html: article.global_llm_text }}
            />
          </section>
        )}

        {/* Fallback */}
        {panels.length === 0 && !article.global_llm_text && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">Content coming soon.</p>
          </div>
        )}

        {/* ── FAQ ── */}
        {articleFaqs.length > 0 && (
          <section
            aria-labelledby="faq-heading"
            className="-mx-4 mt-14 rounded-2xl bg-gray-50 px-4 py-10 sm:mx-0 sm:px-8"
          >
            <h2
              id="faq-heading"
              className="mb-6 text-xl font-bold text-gray-900"
            >
              よくある質問
            </h2>
            <dl className="space-y-3">
              {articleFaqs.map((faq, i) => (
                <details
                  key={i}
                  open
                  className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
                      Q
                    </span>
                    <dt className="flex-1 text-sm font-semibold text-gray-900 md:text-base">
                      {faq.question}
                    </dt>
                    <IconChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <dd className="border-t border-gray-100 px-5 pb-5 pt-3 pl-14 text-sm leading-relaxed text-gray-600">
                    {faq.answer}
                  </dd>
                </details>
              ))}
            </dl>
          </section>
        )}

        {/* ── Related Knowledge Base ── */}
        {relatedKnowledge.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Knowledge Base
            </h2>
            <div className="space-y-3">
              {relatedKnowledge.map((kb) => (
                <Link
                  key={kb.id}
                  to={`/knowledge/${kb.slug}`}
                  className="block rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4 transition-shadow hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-blue-900">
                    {kb.title}
                  </p>
                  {kb.description && (
                    <p className="mt-1 text-xs text-blue-700/70 line-clamp-2">
                      {kb.description}
                    </p>
                  )}
                  <span className="mt-2 inline-block text-xs text-blue-600">
                    {kb.reading_time_minutes}min read
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer CTA ── */}
        <footer className="mt-12 pb-4">
          {panels.length > 0 && (
            <Link
              to={`/articles/${article.slug}/p/1`}
              prefetch="intent"
              className="group flex items-center justify-between rounded-xl bg-gray-900 px-6 py-5 transition-colors duration-200 hover:bg-gray-800"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  マンガで読む
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {panels.length}ページ
                  {article.audio_url && " ・ 音声ナレーション付き"}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900 transition-transform duration-200 group-hover:scale-110">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </Link>
          )}

          {panels.length > 0 && articleFaqs.length > 0 && (
            <p className="mt-4 text-center text-xs text-gray-400">
              各ページにはさらに詳しいFAQと用語解説があります
            </p>
          )}
        </footer>
      </article>
    </>
  );
}
