import { useRef, useState, useCallback, useEffect } from "react";
import { data, Link, useNavigate } from "react-router";
import type { Route } from "./+types/articles.$slug.p$page";
import {
  getArticleWithPanels,
  getAdjacentArticles,
  type PanelData,
  type ArticleFull,
  type ArticleSummary,
} from "~/lib/d1.server";
import { cached } from "~/lib/cache.server";
import { useAudioSync } from "~/hooks/use-audio-sync";
import { JsonLd } from "~/components/json-ld";
import { generateComicIssueJsonLd } from "~/lib/jsonld";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const slug = params.slug;
  const page = parseInt(params.page, 10);

  if (isNaN(page) || page < 1) {
    throw data(null, { status: 400 });
  }

  const result = await cached(env.CACHE, `article:${slug}`, () =>
    getArticleWithPanels(env.DB, slug),
  );

  if (!result) {
    throw data(null, { status: 404 });
  }

  const { article, panels } = result;

  if (page > panels.length + 1) {
    // +1 for knowledge landing
    throw data(null, { status: 404 });
  }

  let adjacent: { prev: ArticleSummary | null; next: ArticleSummary | null } =
    { prev: null, next: null };
  if (article.cluster_id) {
    adjacent = await cached(
      env.CACHE,
      `adjacent:${article.cluster_id}:${article.order_in_cluster}`,
      () =>
        getAdjacentArticles(
          env.DB,
          article.cluster_id!,
          article.order_in_cluster,
        ),
    );
  }

  return { article, panels, page, adjacent, siteUrl: env.SITE_URL };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not Found -- effect.moe" }];
  const { article, page } = loaderData;
  return [
    { title: `${article.title} (${page}) -- effect.moe` },
    { name: "description", content: article.description },
  ];
}

export default function MangaReaderRoute({
  loaderData,
}: Route.ComponentProps) {
  const { article, panels, page, adjacent, siteUrl } = loaderData;
  const navigate = useNavigate();
  const swiperRef = useRef<SwiperType | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const textPaneRef = useRef<HTMLDivElement | null>(null);

  const {
    audioRef,
    isPlaying,
    isAutoMode,
    currentPanel,
    progress,
    play,
    pause,
    toggleAutoMode,
  } = useAudioSync({
    audioUrl: article.audio_url,
    anchors: article.audio_anchors ?? [],
    swiperRef,
    onPanelChange: (panel) => setCurrentPage(panel),
  });

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      const newPage = swiper.activeIndex + 1;
      setCurrentPage(newPage);
      // Update URL without full navigation
      window.history.replaceState(
        null,
        "",
        `/articles/${article.slug}/p${newPage}`,
      );
    },
    [article.slug],
  );

  // Close reader -> back to article
  const handleClose = useCallback(() => {
    navigate(`/articles/${article.slug}`);
  }, [navigate, article.slug]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const swiper = swiperRef.current;
      if (!swiper) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        swiper.slideNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        swiper.slidePrev();
      } else if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Auto-scroll TextPane to current panel's transcript
  useEffect(() => {
    const container = textPaneRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-panel="${currentPage}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

  const totalSlides = panels.length + 1; // +1 for knowledge landing
  const isOnLanding = currentPage > panels.length;
  const currentPanelData = isOnLanding
    ? null
    : panels[currentPage - 1] ?? null;

  const transcripts = panels
    .map((p) => p.transcript)
    .filter((t): t is string => t !== null);

  const jsonLdData = generateComicIssueJsonLd(
    {
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
      transcripts,
    },
    siteUrl,
  );

  return (
    <div className="fixed inset-0 z-50 bg-gray-950">
      <JsonLd data={jsonLdData} />
      {/* Hidden audio element */}
      {article.audio_url && <audio ref={audioRef} preload="none" />}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <button
          onClick={handleClose}
          className="rounded-sm px-2 py-1 text-xs text-white/70 transition-colors duration-150 hover:text-white"
        >
          Close
        </button>
        <span className="text-xs tabular-nums text-white/50">
          {currentPage} / {panels.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="absolute left-0 right-0 top-0 z-10 h-0.5 bg-white/10">
        <div
          className="h-full bg-white/40 transition-[width] duration-150 ease-in-out"
          style={{
            width: `${(currentPage / totalSlides) * 100}%`,
          }}
        />
      </div>

      {/* Main layout: mobile = full Swiper, desktop = split */}
      <div className="flex h-full pt-10">
        {/* Left: Swiper (full on mobile, 60% on desktop) */}
        <div className="h-full w-full md:w-3/5">
          <Swiper
            initialSlide={page - 1}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            onSlideChange={handleSlideChange}
            className="h-full w-full"
            slidesPerView={1}
            speed={200}
          >
            {panels.map((panel) => (
              <SwiperSlide key={panel.id}>
                <PanelSlide panel={panel} />
              </SwiperSlide>
            ))}
            <SwiperSlide>
              <KnowledgeLanding
                article={article}
                panels={panels}
                adjacent={adjacent}
              />
            </SwiperSlide>
          </Swiper>
        </div>

        {/* Spine: Audio controls (desktop only, vertical) */}
        {article.audio_url && (
          <div className="hidden w-12 flex-col items-center gap-2 border-l border-white/10 py-4 md:flex">
            <button
              onClick={isPlaying ? pause : play}
              className="rounded-sm bg-white/10 p-2 text-[10px] font-medium text-white transition-colors duration-150 hover:bg-white/20"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "||" : "\u25B6"}
            </button>
            <button
              onClick={toggleAutoMode}
              className={`rounded-sm p-2 text-[10px] font-medium transition-colors duration-150 ${
                isAutoMode
                  ? "bg-white text-gray-900"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title="Auto mode"
            >
              A
            </button>
            {isAutoMode && (
              <div className="mx-auto h-24 w-1 rounded-sm bg-white/10">
                <div
                  className="w-full rounded-sm bg-white/40 transition-[height] duration-150"
                  style={{ height: `${progress * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Right: TextPane (desktop only) */}
        <div
          ref={textPaneRef}
          className="hidden h-full overflow-y-auto border-l border-white/10 md:block md:w-2/5"
        >
          <div className="p-6">
            {/* Article header */}
            <h2 className="mb-1 text-sm font-semibold text-white">
              {article.title}
            </h2>
            {article.description && (
              <p className="mb-4 text-xs text-white/50">
                {article.description}
              </p>
            )}

            {/* Global LLM text */}
            {article.global_llm_text && (
              <div className="mb-6 border-b border-white/10 pb-4 text-xs leading-relaxed text-white/40">
                {article.global_llm_text}
              </div>
            )}

            {/* Panel transcripts */}
            <div className="space-y-4">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  data-panel={panel.panel_order}
                  className={`rounded-sm border-l-2 py-2 pl-3 transition-colors duration-200 ${
                    panel.panel_order === currentPage
                      ? "border-white/60 bg-white/5"
                      : "border-white/10"
                  }`}
                >
                  <span className="text-[10px] tabular-nums text-white/30">
                    Panel {panel.panel_order}
                  </span>
                  {panel.transcript ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {panel.transcript}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-white/20">
                      No transcript
                    </p>
                  )}
                  {panel.ai_context && (
                    <p className="mt-1 text-[11px] text-white/25">
                      {panel.ai_context}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation at bottom */}
            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
              {adjacent.prev ? (
                <Link
                  to={`/articles/${adjacent.prev.slug}`}
                  className="text-xs text-white/40 hover:text-white/60"
                >
                  Prev: {adjacent.prev.title}
                </Link>
              ) : (
                <span />
              )}
              {adjacent.next && (
                <Link
                  to={`/articles/${adjacent.next.slug}`}
                  className="text-xs text-white/40 hover:text-white/60"
                >
                  Next: {adjacent.next.title}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile audio controls (bottom bar, hidden on desktop) */}
      {article.audio_url && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-3 bg-gray-900/80 px-4 py-3 md:hidden">
          <button
            onClick={isPlaying ? pause : play}
            className="rounded-sm bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/20"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={toggleAutoMode}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isAutoMode
                ? "bg-white text-gray-900"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Auto
          </button>
          {isAutoMode && (
            <div className="ml-2 h-1 flex-1 rounded-sm bg-white/10">
              <div
                className="h-full rounded-sm bg-white/40 transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function PanelSlide({ panel }: { panel: PanelData }) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <img
        src={panel.image_url}
        alt={panel.transcript ?? `Panel ${panel.panel_order}`}
        className="max-h-full max-w-full object-contain"
        width={panel.image_width ?? undefined}
        height={panel.image_height ?? undefined}
      />
    </div>
  );
}

function KnowledgeLanding({
  article,
  panels,
  adjacent,
}: {
  article: ArticleFull;
  panels: PanelData[];
  adjacent: { prev: ArticleSummary | null; next: ArticleSummary | null };
}) {
  const transcripts = panels
    .map((p) => p.transcript)
    .filter((t): t is string => t !== null);

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <article className="mx-auto max-w-lg">
        {/* Series context */}
        {article.cluster_name && (
          <p className="mb-3 text-center text-[11px] uppercase tracking-wider text-white/30">
            {article.cluster_name} #{article.order_in_cluster}
          </p>
        )}

        <h2 className="mb-2 text-center text-lg font-semibold text-white">
          {article.title}
        </h2>

        {/* Meta: date, panel count, tags */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/40">
          {article.published_at && (
            <time dateTime={article.published_at}>
              {new Date(article.published_at).toLocaleDateString("ja-JP")}
            </time>
          )}
          <span>{panels.length} panels</span>
          {article.tags.length > 0 &&
            article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-white/10 px-1.5 py-0.5"
              >
                {tag}
              </span>
            ))}
        </div>

        {article.description && (
          <p className="mb-4 text-center text-sm text-white/60">
            {article.description}
          </p>
        )}

        {/* Global LLM text for AI crawlers */}
        {article.global_llm_text && (
          <div className="mb-6 text-left text-xs leading-relaxed text-white/40">
            {article.global_llm_text}
          </div>
        )}

        {/* Transcript summary for LLMO */}
        {transcripts.length > 0 && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-white/30">
              Transcript ({transcripts.length} panels)
            </summary>
            <div className="mt-2 space-y-1 text-xs text-white/30">
              {transcripts.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </div>
          </details>
        )}

        {/* AI context summary (hidden visually, available for crawlers) */}
        {panels.some((p) => p.ai_context) && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-white/20">
              Scene descriptions
            </summary>
            <div className="mt-2 space-y-1 text-xs text-white/20">
              {panels
                .filter((p) => p.ai_context)
                .map((p) => (
                  <p key={p.id}>
                    Panel {p.panel_order}: {p.ai_context}
                  </p>
                ))}
            </div>
          </details>
        )}

        {/* Navigation */}
        <nav className="flex items-center justify-center gap-4">
          {adjacent.prev && (
            <Link
              to={`/articles/${adjacent.prev.slug}`}
              className="rounded-sm border border-white/20 px-4 py-2 text-xs text-white/60 transition-colors duration-150 hover:border-white/40 hover:text-white"
            >
              Prev: {adjacent.prev.title}
            </Link>
          )}
          {adjacent.next && (
            <Link
              to={`/articles/${adjacent.next.slug}`}
              className="rounded-sm border border-white/20 px-4 py-2 text-xs text-white/60 transition-colors duration-150 hover:border-white/40 hover:text-white"
            >
              Next: {adjacent.next.title}
            </Link>
          )}
        </nav>

        <div className="mt-6 text-center">
          <Link
            to={`/articles/${article.slug}`}
            className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60"
          >
            Back to article
          </Link>
        </div>
      </article>
    </div>
  );
}
