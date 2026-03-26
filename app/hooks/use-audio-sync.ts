import { useRef, useState, useCallback, useEffect } from "react";
import type { Swiper as SwiperType } from "swiper";
import type { AudioAnchor } from "~/lib/d1.server";

interface UseAudioSyncOptions {
  audioUrl: string | null;
  anchors: AudioAnchor[];
  swiperRef: React.RefObject<SwiperType | null>;
  initialPanel?: number;
  onPanelChange?: (panel: number) => void;
}

interface UseAudioSyncReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  playError: string | null;
  isAutoMode: boolean;
  isMuted: boolean;
  currentPanel: number;
  progress: number;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  toggleAutoMode: () => void;
  toggleMute: () => void;
  seekToPanel: (panel: number) => void;
  syncAudioToPanel: (panel: number) => void;
  skipCue: (direction: "prev" | "next") => void;
  togglePlayFromPanel: (panel: number) => void;
}

// The concatenated audio has 0.8s silence between panels.
// anchor.end = next anchor.start (contiguous). Actual content ends at anchor.end - 0.8.
// We detect boundary 0.05s before anchor.end (well within silence).
// RAF polling at ~16ms guarantees we catch it with negligible overshoot.
const BOUNDARY_MARGIN = 0.05;

export function useAudioSync({
  audioUrl,
  anchors,
  swiperRef,
  initialPanel = 0,
}: UseAudioSyncOptions): UseAudioSyncReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(initialPanel);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs for synchronous access (no stale closures)
  const currentPanelRef = useRef(initialPanel);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;

  const isProgrammaticSlideRef = useRef(false);
  const isSeekingRef = useRef(false);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef(0);
  // Store pending Swiper transition callback for cleanup
  const pendingTransitionCbRef = useRef<(() => void) | null>(null);

  const updatePanel = useCallback((panel: number) => {
    currentPanelRef.current = panel;
    setCurrentPanel(panel);
  }, []);

  // --- Buffering / error ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onError = () => {
      setIsBuffering(false);
      const err = audio.error;
      if (err) {
        setPlayError(
          err.code === MediaError.MEDIA_ERR_NETWORK
            ? "Network error"
            : err.code === MediaError.MEDIA_ERR_DECODE
              ? "Audio decode error"
              : err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                ? "Audio format not supported"
                : "Audio error",
        );
      }
      setIsPlaying(false);
      setIsAutoMode(false);
    };
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // --- Swipe-to-Seek (+ resume if was playing) ---
  const syncAudioToPanel = useCallback(
    (panel: number) => {
      if (isProgrammaticSlideRef.current) {
        updatePanel(panel);
        return;
      }

      const anch = anchorsRef.current;
      const anchor = anch.find((a) => a.panel === panel);
      if (!anchor) return;

      const audio = audioRef.current;
      if (!audio) return;

      // Remember if audio was playing before we pause for seeking
      const wasPlaying = !audio.paused;

      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }

      audio.pause();
      isSeekingRef.current = true;
      updatePanel(panel);
      setProgress(0);

      if (!audio.src && audioUrl) {
        audio.src = audioUrl;
        audio.load();
      }

      const doSeek = () => {
        try {
          audio.currentTime = anchor.start;
        } catch {
          /* not seekable */
        }
        isSeekingRef.current = false;
        // Resume playback if audio was playing before the swipe
        if (wasPlaying) {
          audio.play().catch(() => {});
          setIsPlaying(true);
        }
      };

      if (audio.readyState < 1) {
        const onReady = () => {
          audio.removeEventListener("loadedmetadata", onReady);
          doSeek();
        };
        audio.addEventListener("loadedmetadata", onReady);
      } else {
        doSeek();
      }
    },
    [audioUrl, updatePanel],
  );

  // --- RAF polling loop (replaces timeupdate for precise boundary detection) ---
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      rafIdRef.current = 0;
      return;
    }

    const t = audio.currentTime;
    setCurrentTime(t);
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    if (!isSeekingRef.current) {
      const anch = anchorsRef.current;
      const panel = currentPanelRef.current;
      const cur = anch.find((a) => a.panel === panel);

      if (cur) {
        // Sanity: skip if audio is way outside this anchor
        if (t >= cur.start - 0.5 && t <= cur.end + 0.5) {
          const segDur = cur.end - cur.start;
          setProgress(
            segDur > 0 ? Math.min((t - cur.start) / segDur, 1) : 0,
          );

          // Boundary: ~16ms precision means we land within 0.05s of target
          if (t >= cur.end - BOUNDARY_MARGIN) {
            audio.pause();
            isSeekingRef.current = true;
            setProgress(1);

            const curIdx = anch.findIndex((a) => a.panel === panel);
            const next =
              curIdx >= 0 && curIdx < anch.length - 1
                ? anch[curIdx + 1]
                : null;

            if (next) {
              updatePanel(next.panel);
              isProgrammaticSlideRef.current = true;

              const swiper = swiperRef.current;
              if (swiper) {
                swiper.slideTo(next.panel);
              }

              // Helper: seek to next anchor start, wait for seeked, then play
              const resumeNextPanel = () => {
                isProgrammaticSlideRef.current = false;
                const a = audioRef.current;
                if (a && !a.ended) {
                  a.currentTime = next.start;
                  const onSeeked = () => {
                    a.removeEventListener("seeked", onSeeked);
                    isSeekingRef.current = false;
                    a.play().catch(() => {});
                    setIsPlaying(true);
                  };
                  a.addEventListener("seeked", onSeeked);
                } else {
                  isSeekingRef.current = false;
                }
              };

              // Wait for Swiper slide transition to complete visually,
              // then add 250ms comfort pause before narration starts.
              if (swiper) {
                const onTransitionEnd = () => {
                  swiper.off("slideChangeTransitionEnd", onTransitionEnd);
                  pendingTransitionCbRef.current = null;
                  // Clear the fallback timer
                  if (gapTimerRef.current) {
                    clearTimeout(gapTimerRef.current);
                  }
                  gapTimerRef.current = setTimeout(() => {
                    gapTimerRef.current = null;
                    resumeNextPanel();
                  }, 250);
                };
                pendingTransitionCbRef.current = onTransitionEnd;
                swiper.on("slideChangeTransitionEnd", onTransitionEnd);

                // Fallback: if transitionEnd never fires (edge case), play after 1s
                gapTimerRef.current = setTimeout(() => {
                  swiper.off("slideChangeTransitionEnd", onTransitionEnd);
                  pendingTransitionCbRef.current = null;
                  gapTimerRef.current = null;
                  resumeNextPanel();
                }, 1000);
              } else {
                gapTimerRef.current = setTimeout(() => {
                  gapTimerRef.current = null;
                  resumeNextPanel();
                }, 600);
              }
            } else {
              isSeekingRef.current = false;
              setIsPlaying(false);
            }
            return; // Don't schedule next RAF — audio is paused
          }
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(tick);
  }, [updatePanel, swiperRef]);

  // Start/stop RAF loop when audio plays/pauses
  const startRaf = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("play", startRaf);
    audio.addEventListener("pause", stopRaf);
    return () => {
      audio.removeEventListener("play", startRaf);
      audio.removeEventListener("pause", stopRaf);
      stopRaf();
    };
  }, [startRaf, stopRaf]);

  // Audio ended -> reset
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      setIsAutoMode(false);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (pendingTransitionCbRef.current && swiperRef.current) {
        swiperRef.current.off("slideChangeTransitionEnd", pendingTransitionCbRef.current);
      }
    };
  }, [swiperRef]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (!audio.src) audio.src = audioUrl;
    setPlayError(null);
    audio.play().catch((err: Error) => {
      if (err.name === "AbortError") return;
      setPlayError(
        err.name === "NotAllowedError"
          ? "Tap to enable audio playback"
          : "Failed to play audio",
      );
      setIsPlaying(false);
    });
    setIsPlaying(true);
  }, [audioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    // Clean up pending Swiper transition listener
    if (pendingTransitionCbRef.current && swiperRef.current) {
      swiperRef.current.off("slideChangeTransitionEnd", pendingTransitionCbRef.current);
      pendingTransitionCbRef.current = null;
    }
    isProgrammaticSlideRef.current = false;
    isSeekingRef.current = false;
    setIsPlaying(false);
  }, [swiperRef]);

  const toggleAutoMode = useCallback(() => {
    setIsAutoMode((prev) => !prev);
    if (!isPlaying) play();
  }, [isPlaying, play]);

  const seekToPanel = useCallback(
    (panel: number) => {
      const anchor = anchors.find((a) => a.panel === panel);
      if (!anchor || !audioRef.current) return;
      audioRef.current.currentTime = anchor.start;
      updatePanel(panel);
      swiperRef.current?.slideTo(panel);
    },
    [anchors, swiperRef, updatePanel],
  );

  const skipCue = useCallback(
    (direction: "prev" | "next") => {
      const audio = audioRef.current;
      if (!audio || anchors.length === 0) return;
      const ci = anchors.findIndex((a) => a.panel === currentPanelRef.current);
      const target =
        direction === "prev"
          ? Math.max(ci - 1, 0)
          : Math.min(ci + 1, anchors.length - 1);
      const anchor = anchors[target];
      isSeekingRef.current = true;
      updatePanel(anchor.panel);
      audio.pause();
      audio.currentTime = anchor.start;
      setCurrentTime(anchor.start);
      setProgress(0);
      swiperRef.current?.slideTo(anchor.panel);
      requestAnimationFrame(() => {
        isSeekingRef.current = false;
        audio.play().catch(() => {});
      });
    },
    [anchors, swiperRef, updatePanel],
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const togglePlayFromPanel = useCallback(
    (panel: number) => {
      const audio = audioRef.current;
      if (!audio || !audioUrl) return;
      const anchor = anchors.find((a) => a.panel === panel);
      if (!anchor) return;

      if (!audio.paused && currentPanelRef.current === panel) {
        audio.pause();
        setIsPlaying(false);
        return;
      }

      if (audio.paused && currentPanelRef.current === panel && audio.src) {
        isSeekingRef.current = false;
        audio.play().catch(() => {});
        setIsPlaying(true);
        return;
      }

      const needsLoad = !audio.src;
      if (needsLoad) {
        audio.src = audioUrl;
        audio.load();
      }
      isSeekingRef.current = true;
      updatePanel(panel);
      audio.pause();
      setCurrentTime(anchor.start);
      setProgress(0);

      const doSeekAndPlay = () => {
        try {
          audio.currentTime = anchor.start;
        } catch {
          /* not seekable yet */
        }
        isSeekingRef.current = false;
        setPlayError(null);
        audio.play().catch((err: Error) => {
          if (err.name !== "AbortError") {
            setPlayError("Tap to enable audio playback");
            setIsPlaying(false);
          }
        });
        setIsPlaying(true);
      };

      if (audio.readyState < 1) {
        const onReady = () => {
          audio.removeEventListener("loadedmetadata", onReady);
          doSeekAndPlay();
        };
        audio.addEventListener("loadedmetadata", onReady);
      } else {
        doSeekAndPlay();
      }
    },
    [anchors, audioUrl, updatePanel],
  );

  return {
    audioRef,
    isPlaying,
    isBuffering,
    playError,
    isAutoMode,
    isMuted,
    currentPanel,
    progress,
    currentTime,
    duration,
    play,
    pause,
    toggleAutoMode,
    toggleMute,
    seekToPanel,
    syncAudioToPanel,
    skipCue,
    togglePlayFromPanel,
  };
}
