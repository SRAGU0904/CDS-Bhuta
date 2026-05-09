"use client";

import { useEffect, useRef, useState } from "react";
import type { ControlMode } from "./types";

export function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.35;
    audio.loop = true;
  }, []);

  const toggleMusic = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (!isPlaying) {
        audio.muted = false;
        audio.currentTime = audio.currentTime || 0;
        await audio.play();
        setIsPlaying(true);
        setIsMuted(false);
        return;
      }
      audio.muted = !audio.muted;
      setIsMuted(audio.muted);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bg-2.mp3" preload="auto" />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={toggleMusic}
        className="fixed right-6 top-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Toggle music"
      >
        {isPlaying && !isMuted ? "🔊" : "🔇"}
      </button>
    </>
  );
}

export function ControlModeToggle({
  mode,
  onToggle,
}: {
  mode: ControlMode;
  onToggle: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onToggle}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-black/70"
      aria-label="Toggle rotation control mode"
    >
      {mode === "phone" ? "Phone Control" : "Mouse Control"}
    </button>
  );
}

export function ViewFrames() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <div className="absolute left-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
      <div className="absolute right-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
    </div>
  );
}
