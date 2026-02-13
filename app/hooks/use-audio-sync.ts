import { useRef, useState, useCallback, useEffect } from "react";
import type { Swiper as SwiperType } from "swiper";
import type { AudioAnchor } from "~/lib/d1.server";

interface UseAudioSyncOptions {
  audioUrl: string | null;
  anchors: AudioAnchor[];
  swiperRef: React.RefObject<SwiperType | null>;
  onPanelChange?: (panel: number) => void;
}

interface UseAudioSyncReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  isBuffering: boolean;
  playError: string | null;
  isAutoMode: boolean;
  currentPanel: number;
  progress: number;
  play: () => void;
  pause: () => void;
  toggleAutoMode: () => void;
  seekToPanel: (panel: number) => void;
}

const SEEK_DEBOUNCE_MS = 150;

export function useAudioSync({
  audioUrl,
  anchors,
  swiperRef,
  onPanelChange,
}: UseAudioSyncOptions): UseAudioSyncReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(1);
  const [progress, setProgress] = useState(0);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Buffering state: waiting/canplay/error events
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

  // Debounced seek: only apply the last seek within SEEK_DEBOUNCE_MS
  const debouncedSeek = useCallback(
    (targetTime: number) => {
      if (seekTimerRef.current) {
        clearTimeout(seekTimerRef.current);
      }
      setIsBuffering(true);
      seekTimerRef.current = setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = targetTime;
        }
        seekTimerRef.current = null;
      }, SEEK_DEBOUNCE_MS);
    },
    [],
  );

  // Swipe-to-Seek: user swipes -> debounced seek audio to panel start
  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      const panelNum = swiper.activeIndex + 1;
      const anchor = anchors.find((a) => a.panel === panelNum);
      if (!anchor || !audioRef.current) return;

      debouncedSeek(anchor.start);
      setCurrentPanel(panelNum);

      // Manual Override: disable auto-mode on manual swipe
      if (isAutoMode) {
        setIsAutoMode(false);
      }

      onPanelChange?.(panelNum);
    },
    [anchors, isAutoMode, onPanelChange, debouncedSeek],
  );

  // Bind slideChange to Swiper
  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    swiper.on("slideChange", handleSlideChange);
    return () => {
      swiper.off("slideChange", handleSlideChange);
    };
  }, [swiperRef, handleSlideChange]);

  // Play-to-Swipe: audio plays -> advance Swiper on panel boundary
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isAutoMode) return;

    const t = audio.currentTime;
    const current = anchors.find((a) => t >= a.start && t < a.end);
    if (!current) return;

    const duration = current.end - current.start;
    setProgress(duration > 0 ? (t - current.start) / duration : 0);

    if (current.panel !== currentPanel) {
      setCurrentPanel(current.panel);
      const swiper = swiperRef.current;
      if (swiper) {
        swiper.slideTo(current.panel - 1);
      }
    }
  }, [anchors, isAutoMode, currentPanel, swiperRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [handleTimeUpdate]);

  // Audio ended -> reset
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      setIsPlaying(false);
      setIsAutoMode(false);
    };
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (seekTimerRef.current) {
        clearTimeout(seekTimerRef.current);
      }
    };
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (!audio.src) {
      audio.src = audioUrl;
    }
    setPlayError(null);
    audio.play().catch((err: Error) => {
      if (err.name === "AbortError") {
        // Previous play was interrupted by a new seek/play — safe to ignore
        return;
      }
      if (err.name === "NotAllowedError") {
        setPlayError("Tap to enable audio playback");
      } else {
        setPlayError("Failed to play audio");
      }
      setIsPlaying(false);
    });
    setIsPlaying(true);
  }, [audioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsAutoMode(false);
  }, []);

  const toggleAutoMode = useCallback(() => {
    setIsAutoMode((prev) => !prev);
    if (!isPlaying) {
      play();
    }
  }, [isPlaying, play]);

  const seekToPanel = useCallback(
    (panel: number) => {
      const anchor = anchors.find((a) => a.panel === panel);
      if (!anchor || !audioRef.current) return;
      audioRef.current.currentTime = anchor.start;
      setCurrentPanel(panel);
      swiperRef.current?.slideTo(panel - 1);
    },
    [anchors, swiperRef],
  );

  return {
    audioRef,
    isPlaying,
    isBuffering,
    playError,
    isAutoMode,
    currentPanel,
    progress,
    play,
    pause,
    toggleAutoMode,
    seekToPanel,
  };
}
