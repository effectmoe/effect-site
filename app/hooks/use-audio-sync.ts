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
  isAutoMode: boolean;
  currentPanel: number;
  progress: number;
  play: () => void;
  pause: () => void;
  toggleAutoMode: () => void;
  seekToPanel: (panel: number) => void;
}

export function useAudioSync({
  audioUrl,
  anchors,
  swiperRef,
  onPanelChange,
}: UseAudioSyncOptions): UseAudioSyncReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(1);
  const [progress, setProgress] = useState(0);

  // Swipe-to-Seek: user swipes -> seek audio to panel start
  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      const panelNum = swiper.activeIndex + 1;
      const anchor = anchors.find((a) => a.panel === panelNum);
      if (!anchor || !audioRef.current) return;

      audioRef.current.currentTime = anchor.start;
      setCurrentPanel(panelNum);

      // Manual Override: disable auto-mode on manual swipe
      if (isAutoMode) {
        setIsAutoMode(false);
      }

      onPanelChange?.(panelNum);
    },
    [anchors, isAutoMode, onPanelChange],
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

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (!audio.src) {
      audio.src = audioUrl;
    }
    void audio.play();
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
    isAutoMode,
    currentPanel,
    progress,
    play,
    pause,
    toggleAutoMode,
    seekToPanel,
  };
}
