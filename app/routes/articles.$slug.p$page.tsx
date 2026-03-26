import { useRef, useState, useCallback, useEffect } from "react";
import { data, Link, useNavigate } from "react-router";
import type { Route } from "./+types/articles.$slug.p$page";
import {
  getArticleWithPanels,
  getAdjacentArticles,
  type PanelData,
  type PanelFaq,
  type PanelGlossary,
  type ArticleFull,
  type ArticleSummary,
} from "~/lib/d1.server";
import { panelImageUrl } from "~/lib/panel-image";
import { cached } from "~/lib/cache.server";
import { useAudioSync } from "~/hooks/use-audio-sync";
import { JsonLd } from "~/components/json-ld";
import { generateComicIssueJsonLd } from "~/lib/jsonld";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import { Zoom } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/zoom";

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
    // Allow pinch-zoom; interactive-widget keeps layout stable on mobile
    {
      name: "viewport",
      content:
        "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, interactive-widget=resizes-content",
    },
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

  // Swipe guide: show briefly on first visit
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    const key = "manga-guide-seen";
    if (!localStorage.getItem(key)) {
      setShowGuide(true);
      const t = setTimeout(() => {
        setShowGuide(false);
        localStorage.setItem(key, "1");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const {
    audioRef,
    isPlaying,
    isBuffering,
    playError,
    isAutoMode,
    isMuted,
    currentPanel,
    progress,
    currentTime: audioCurrentTime,
    duration: audioDuration,
    play,
    pause,
    toggleAutoMode,
    toggleMute,
    syncAudioToPanel,
    skipCue,
    togglePlayFromPanel,
  } = useAudioSync({
    audioUrl: article.audio_url,
    anchors: article.audio_anchors ?? [],
    swiperRef,
    initialPanel: page - 1,
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
        `/articles/${article.slug}/p/${newPage}`,
      );
      // Sync audio position to the new panel
      // Anchors use 0-based panel numbers (panel_order from D1), activeIndex is 0-based
      // Always sync if audio has been loaded (syncAudioToPanel handles auto-resume)
      if (article.audio_url) {
        syncAudioToPanel(swiper.activeIndex);
      }
    },
    [article.slug, article.audio_url, syncAudioToPanel],
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
      `[data-panel="${currentPage - 1}"]`,
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

  // FAQ drawer state (mobile)
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  // Glossary drawer state (mobile)
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Close drawers when page changes
  useEffect(() => {
    setIsFaqOpen(false);
    setIsGlossaryOpen(false);
  }, [currentPage]);

  const hasFaqs = !isOnLanding && currentPanelData && currentPanelData.faqs.length > 0;
  const hasGlossary = !isOnLanding && currentPanelData && (currentPanelData.glossary?.length ?? 0) > 0;

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

  // FAQPage JSON-LD for panels that have FAQs
  const faqJsonLd = panels
    .filter((p) => p.faqs.length > 0)
    .map((p) => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "name": `${article.title} - Panel ${p.panel_order} FAQ`,
      "mainEntity": p.faqs.map((f) => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": { "@type": "Answer", "text": f.answer },
      })),
    }));

  // DefinedTermSet JSON-LD for glossary terms (SEO/LLMO)
  const glossaryJsonLd = panels
    .filter((p) => (p.glossary?.length ?? 0) > 0)
    .map((p) => ({
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "name": `${article.title} - ${p.panel_order}ページ 用語集`,
      "hasDefinedTerm": p.glossary.map((g) => ({
        "@type": "DefinedTerm",
        "name": g.term,
        "description": g.description,
      })),
    }));

  return (
    <div className="fixed inset-0 z-50 bg-[#0F0F23]">
      <JsonLd data={jsonLdData} />
      {faqJsonLd.map((ld, i) => (
        <JsonLd key={`faq-${i}`} data={ld} />
      ))}
      {glossaryJsonLd.map((ld, i) => (
        <JsonLd key={`gloss-${i}`} data={ld} />
      ))}
      {/* Hidden audio element */}
      {article.audio_url && <audio ref={audioRef} preload="none" />}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <button
          onClick={handleClose}
          className="cursor-pointer rounded-sm px-2 py-1 text-xs text-white/70 transition-colors duration-200 hover:text-white"
        >
          閉じる
        </button>
        <span className="text-xs tabular-nums text-white/50">
          {currentPage} / {panels.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="absolute left-0 right-0 top-0 z-10 h-0.5 bg-white/10">
        <div
          className="h-full bg-orange-500/60 transition-[width] duration-200 ease-out"
          style={{
            width: `${(currentPage / totalSlides) * 100}%`,
          }}
        />
      </div>

      {/* Main layout: mobile = full Swiper, desktop = split */}
      <div className="flex h-full pt-10">
        {/* Left: Swiper (full on mobile, 60% on desktop) */}
        <div className="h-full w-full pb-36 md:w-3/5 md:pb-0">
          <Swiper
            modules={[Zoom]}
            zoom={{ maxRatio: 3, minRatio: 1 }}
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
                <div
                  className="h-full cursor-pointer"
                  onClick={() => {
                    if (article.audio_url) {
                      togglePlayFromPanel(panel.panel_order);
                    }
                  }}
                >
                  <PanelSlide panel={panel} />
                </div>
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

        {/* Right: TextPane (desktop only) */}
        <div
          ref={textPaneRef}
          className="hidden h-full overflow-y-auto border-l border-white/10 bg-[#0F0F23] md:block md:w-2/5"
        >
          {/* Sticky desktop audio controls — always visible while scrolling */}
          {article.audio_url && (
            <div className="sticky top-0 z-10 bg-[#0F0F23] px-6 pb-2 pt-4">
              <div className="overflow-hidden rounded-xl bg-[#1E1B4B]/40 p-3">
                {/* Seek bar */}
                <div
                  className="group mb-2 flex h-4 w-full cursor-pointer items-center"
                  onClick={(e) => {
                    const audio = audioRef.current;
                    if (!audio || !audioDuration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                    audio.currentTime = ratio * audioDuration;
                  }}
                  role="slider"
                  aria-label="Desktop seek"
                  aria-valuenow={Math.round(audioCurrentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(audioDuration)}
                >
                  <div className="h-1 w-full rounded-full bg-white/10">
                    <div
                      className="relative h-full rounded-full bg-orange-500/70 transition-[width] duration-100"
                      style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                    >
                      <div className="absolute -right-1.5 -top-1 h-3 w-3 rounded-full bg-orange-400 opacity-0 shadow-sm shadow-orange-500/40 transition-opacity duration-200 group-hover:opacity-100" />
                    </div>
                  </div>
                </div>
                {/* Controls row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => skipCue("prev")}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors duration-200 hover:bg-white/5 hover:text-white"
                    title="前のコマ"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                  </button>
                  <button
                    onClick={isPlaying ? pause : play}
                    className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-all duration-200 ${
                      isPlaying
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                    title={isPlaying ? "一時停止" : "再生"}
                  >
                    {isPlaying ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  <button
                    onClick={() => skipCue("next")}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors duration-200 hover:bg-white/5 hover:text-white"
                    title="次のコマ"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                  </button>
                  <div className="mx-1 h-5 w-px bg-white/10" />
                  <button
                    onClick={toggleAutoMode}
                    className={`flex h-8 cursor-pointer items-center rounded-lg px-3 text-[10px] font-semibold tracking-wide transition-all duration-200 ${
                      isAutoMode
                        ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                        : "text-white/40 hover:bg-white/5 hover:text-white/60"
                    }`}
                    title="自動再生"
                  >
                    AUTO
                  </button>
                  <button
                    onClick={toggleMute}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white/50 transition-colors duration-200 hover:bg-white/5 hover:text-white"
                    title={isMuted ? "ミュート解除" : "ミュート"}
                  >
                    {isMuted ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                    )}
                  </button>
                  <span className="ml-auto text-[10px] tabular-nums text-white/30">
                    {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                  </span>
                </div>
                {playError && (
                  <p className="mt-1 text-[10px] text-red-400">{playError}</p>
                )}
              </div>
            </div>
          )}

          <div className={`px-6 pb-6 ${article.audio_url ? "pt-2" : "pt-6"}`}>
            {/* Article header */}
            <h2 className="mb-1 text-sm font-semibold text-white">
              {article.title}
            </h2>
            {article.description && (
              <p className="mb-4 text-xs text-white/50">
                {article.description}
              </p>
            )}

            {/* Global LLM text — collapsed for UX, still indexed by crawlers */}
            {article.global_llm_text && (
              <details className="mb-6 border-b border-white/10 pb-4">
                <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50">
                  記事テキストを表示
                </summary>
                <div
                  className="article-body-reader mt-2 text-xs leading-relaxed text-white/40"
                  dangerouslySetInnerHTML={{ __html: article.global_llm_text }}
                />
              </details>
            )}

            {/* Panel transcripts */}
            <div className="space-y-4">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  data-panel={panel.panel_order}
                  className={`rounded-sm border-l-2 py-2 pl-3 transition-colors duration-200 ${
                    panel.panel_order === currentPage - 1
                      ? "border-white/60 bg-white/5"
                      : "border-white/10"
                  }`}
                >
                  <span className="text-[10px] tabular-nums text-white/30">
                    {panel.panel_order}ページ
                  </span>
                  {panel.transcript ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      {panel.transcript}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-white/20">
                      テキストなし
                    </p>
                  )}
                  {panel.ai_context && (
                    <p className="mt-1 text-[11px] text-white/25">
                      {panel.ai_context}
                    </p>
                  )}
                  {/* Inline Glossary (desktop) */}
                  {(panel.glossary?.length ?? 0) > 0 && (
                    <div className="mt-2 border-t border-white/5 pt-2">
                      <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-emerald-400/60">
                        用語
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(panel.glossary ?? []).map((g) => (
                          <a
                            key={g.id}
                            href={`/glossary#${encodeURIComponent(g.term)}`}
                            className="group relative rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-300/80 transition-colors hover:bg-emerald-900/50"
                            title={`${g.description}${g.category === "related" ? "（関連語）" : ""}`}
                          >
                            {g.term}
                            {g.category === "related" && (
                              <span className="ml-0.5 text-[8px] text-emerald-400/40">*</span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Inline FAQs (desktop) */}
                  {panel.faqs.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
                      {panel.faqs.map((faq) => (
                        <div key={faq.id} className="rounded-sm bg-white/5 px-2 py-1.5">
                          <p className="text-[10px] font-medium text-blue-300/80">
                            Q. {faq.question}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-white/50">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
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
                  前へ: {adjacent.prev.title}
                </Link>
              ) : (
                <span />
              )}
              {adjacent.next && (
                <Link
                  to={`/articles/${adjacent.next.slug}`}
                  className="text-xs text-white/40 hover:text-white/60"
                >
                  次へ: {adjacent.next.title}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Swipe guide overlay (mobile, first visit only) */}
      {showGuide && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center md:hidden">
          <div className="flex flex-col items-center gap-2 rounded-lg bg-black/70 px-6 py-4 text-white">
            <div className="flex items-center gap-3 text-2xl">
              <span>←</span>
              <span className="text-sm font-medium">左右にスワイプ</span>
              <span>→</span>
            </div>
            <p className="text-xs text-white/60">ピンチで拡大できます</p>
          </div>
        </div>
      )}

      {/* CM ticker (mobile) */}
      <div
        className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 h-7 overflow-hidden rounded-xl bg-[#1E1B4B]/20 md:hidden"
        aria-hidden="true"
      >
        {/* Gradient fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#0F0F23] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#0F0F23] to-transparent" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes ticker-scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `,
          }}
        />
        <div
          className="flex h-full items-center whitespace-nowrap text-[10px] tracking-wide text-white/40 motion-reduce:animate-none"
          style={{
            animation: "ticker-scroll 30s linear infinite",
            width: "max-content",
          }}
        >
          <span className="px-8">
            LLMO対策で検索結果を独占しよう &rarr; effect.moe
          </span>
          <span className="px-8">
            AIクローラー対応の構造化データで差をつける
          </span>
          <span className="px-8">
            記事マンガ + SEO/LLMO 最適化 = 次世代メディア戦略
          </span>
          {/* Duplicate for seamless loop */}
          <span className="px-8">
            LLMO対策で検索結果を独占しよう &rarr; effect.moe
          </span>
          <span className="px-8">
            AIクローラー対応の構造化データで差をつける
          </span>
          <span className="px-8">
            記事マンガ + SEO/LLMO 最適化 = 次世代メディア戦略
          </span>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl bg-[#0F0F23]/95 backdrop-blur-sm px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-lg shadow-black/40 md:hidden">
        {/* Audio seek slider */}
        {article.audio_url && (
          <div
            className="group relative mb-1.5 flex h-6 w-full cursor-pointer touch-none items-center"
            onClick={(e) => {
              const audio = audioRef.current;
              if (!audio || !audioDuration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
              audio.currentTime = ratio * audioDuration;
            }}
            onPointerDown={(e) => {
              const audio = audioRef.current;
              if (!audio || !audioDuration) return;
              const bar = e.currentTarget;
              bar.setPointerCapture(e.pointerId);
              const seek = (ev: PointerEvent) => {
                const rect = bar.getBoundingClientRect();
                const ratio = Math.max(0, Math.min((ev.clientX - rect.left) / rect.width, 1));
                audio.currentTime = ratio * audioDuration;
              };
              seek(e.nativeEvent);
              const onMove = (ev: PointerEvent) => seek(ev);
              const onUp = () => {
                bar.removeEventListener("pointermove", onMove);
                bar.removeEventListener("pointerup", onUp);
              };
              bar.addEventListener("pointermove", onMove);
              bar.addEventListener("pointerup", onUp);
            }}
            role="slider"
            aria-label="再生位置"
            aria-valuenow={Math.round(audioCurrentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(audioDuration)}
          >
            <div className="h-1 w-full rounded-full bg-white/10">
              <div
                className="relative h-full rounded-full bg-orange-500/70 transition-[width] duration-100"
                style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
              >
                <div className="absolute -right-2 -top-1.5 h-4 w-4 rounded-full bg-orange-400 shadow-md shadow-orange-500/30 transition-transform duration-150 group-active:scale-125" />
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {article.audio_url && (
            <>
              {/* Play/Pause — 44x44 touch target */}
              <button
                onClick={isPlaying ? pause : play}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-all duration-200 ${
                  isPlaying
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : "bg-white/10 text-white"
                }`}
                aria-label={isPlaying ? "一時停止" : "再生"}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              {/* Mute — 44x44 touch target */}
              <button
                onClick={toggleMute}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors duration-200 active:bg-white/10"
                aria-label={isMuted ? "ミュート解除" : "ミュート"}
              >
                {isMuted ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
              </button>
              {playError && (
                <span className="text-[10px] text-red-400 truncate max-w-24">{playError}</span>
              )}
            </>
          )}
          {!article.audio_url && <div className="flex-1" />}
          {/* Glossary + FAQ buttons */}
          {!isOnLanding && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => setIsGlossaryOpen(true)}
                className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-all duration-200 ${
                  hasGlossary
                    ? "bg-[#312E81] text-indigo-200 ring-1 ring-indigo-400/30 active:bg-[#3730A3]"
                    : "bg-white/5 text-white/40"
                }`}
                title="このページの用語解説"
              >
                <span>単語</span>
                {hasGlossary && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-400/20 px-1 text-[9px] text-indigo-200">
                    {currentPanelData!.glossary?.length ?? 0}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsFaqOpen(true)}
                className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-all duration-200 ${
                  hasFaqs
                    ? "bg-orange-600/80 text-orange-100 ring-1 ring-orange-400/30 active:bg-orange-600"
                    : "bg-white/5 text-white/40"
                }`}
                title="このページのFAQ"
              >
                <span>FAQ</span>
                {hasFaqs && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400/20 px-1 text-[9px] text-orange-100">
                    {currentPanelData!.faqs.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Glossary Drawer (mobile) */}
      {!isOnLanding && currentPanelData && (
        <PanelGlossaryDrawer
          panel={currentPanelData}
          isOpen={isGlossaryOpen}
          onClose={() => setIsGlossaryOpen(false)}
        />
      )}

      {/* FAQ Drawer (mobile) */}
      {!isOnLanding && currentPanelData && (
        <PanelFaqDrawer
          panel={currentPanelData}
          isOpen={isFaqOpen}
          onClose={() => setIsFaqOpen(false)}
        />
      )}
    </div>
  );
}

// --- Helpers ---

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Sub-components ---

function PanelGlossaryDrawer({
  panel,
  isOpen,
  onClose,
}: {
  panel: PanelData;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const glossary = panel.glossary ?? [];
  const primaryTerms = glossary.filter((g) => g.category === "primary");
  const relatedTerms = glossary.filter((g) => g.category === "related");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/50 md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[75vh] flex-col rounded-t-2xl bg-gray-900 shadow-2xl md:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] text-white/30">{panel.panel_order}ページ</p>
            <h3 className="text-sm font-semibold text-white">用語解説</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:text-white"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Glossary content */}
        <div className="space-y-3 overflow-y-auto px-4 pb-4">
          {/* Primary terms */}
          {primaryTerms.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium tracking-wider text-emerald-400/70">
                このページの用語
              </p>
              <div className="space-y-2">
                {primaryTerms.map((g) => (
                  <GlossaryCard key={g.id} entry={g} />
                ))}
              </div>
            </div>
          )}

          {/* Related terms */}
          {relatedTerms.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium tracking-wider text-white/30">
                関連用語
              </p>
              <div className="space-y-2">
                {relatedTerms.map((g) => (
                  <GlossaryCard key={g.id} entry={g} />
                ))}
              </div>
            </div>
          )}

          {(panel.glossary?.length ?? 0) === 0 && (
            <p className="py-4 text-center text-xs text-white/30">
              このページの用語データはまだありません
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function GlossaryCard({ entry }: { entry: PanelGlossary }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-emerald-300">
          {entry.term}
        </span>
        {entry.category === "related" && (
          <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-white/40">
            関連
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/70">
        {entry.description}
      </p>
    </div>
  );
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function PanelFaqDrawer({
  panel,
  isOpen,
  onClose,
}: {
  panel: PanelData;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          pageContext: panel.transcript ?? panel.ai_context ?? "",
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "回答を生成できませんでした。",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "接続エラーが発生しました。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/50 md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex max-h-[75vh] flex-col rounded-t-2xl bg-gray-900 shadow-2xl md:hidden">
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] text-white/30">{panel.panel_order}ページ</p>
            <h3 className="text-sm font-semibold text-white">
              {panel.faqs.length > 0 ? "よくある質問" : "このページについて質問"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white/50 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Static FAQs */}
        {panel.faqs.length > 0 && (
          <div className="space-y-2 overflow-y-auto px-4 pb-2">
            {panel.faqs.map((faq) => (
              <div key={faq.id} className="rounded-lg bg-gray-800 px-3 py-2.5">
                <p className="text-xs font-medium text-blue-300">Q. {faq.question}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{faq.answer}</p>
              </div>
            ))}
          </div>
        )}

        {/* Live chat */}
        {messages.length > 0 && (
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-white/80"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-700 px-3 py-2 text-xs text-white/50">
                  ...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="このページについて質問する..."
              className="flex-1 rounded-full border border-white/20 bg-gray-800 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PanelSlide({ panel }: { panel: PanelData }) {
  return (
    <div className="flex h-full items-start justify-center pt-4 md:items-center md:pt-0">
      {/* swiper-zoom-container enables pinch-to-zoom via Swiper Zoom module */}
      <div className="swiper-zoom-container flex h-full w-full items-start justify-center md:items-center">
        <img
          src={panelImageUrl(panel)}
          alt={panel.transcript ?? `Panel ${panel.panel_order}`}
          className="max-h-full max-w-full object-contain"
          width={panel.image_width ?? undefined}
          height={panel.image_height ?? undefined}
        />
      </div>
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
          <span>{panels.length}ページ</span>
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

        {/* Global LLM text for AI crawlers — collapsed <details> is fully indexed by Google */}
        {article.global_llm_text && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50">
              この記事のテキスト版を読む
            </summary>
            <div
              className="article-body-reader mt-3 text-xs leading-relaxed text-white/40"
              dangerouslySetInnerHTML={{ __html: article.global_llm_text }}
            />
          </details>
        )}

        {/* Transcript summary for LLMO */}
        {transcripts.length > 0 && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-xs text-white/30">
              書き起こし（{transcripts.length}ページ分）
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
              シーン解説
            </summary>
            <div className="mt-2 space-y-1 text-xs text-white/20">
              {panels
                .filter((p) => p.ai_context)
                .map((p) => (
                  <p key={p.id}>
                    {p.panel_order}ページ: {p.ai_context}
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
              前へ: {adjacent.prev.title}
            </Link>
          )}
          {adjacent.next && (
            <Link
              to={`/articles/${adjacent.next.slug}`}
              className="rounded-sm border border-white/20 px-4 py-2 text-xs text-white/60 transition-colors duration-150 hover:border-white/40 hover:text-white"
            >
              次へ: {adjacent.next.title}
            </Link>
          )}
        </nav>

        <div className="mt-6 text-center">
          <Link
            to={`/articles/${article.slug}`}
            className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60"
          >
            記事に戻る
          </Link>
        </div>
      </article>
    </div>
  );
}
